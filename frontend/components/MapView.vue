<template>
  <div ref="cesiumContainerRef" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import type { PipeNode, Building, GeoJsonFeature } from '~/types'
import {
  PIPE_LAYER_NAMES,
  usePipeLayerLoader,
} from '~/composables/shared/usePipeLayerLoader'
import { useMapViewWorkorderHeat } from '~/composables/shared/useMapViewWorkorderHeat'
import { useMapViewSelection } from '~/composables/shared/useMapViewSelection'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'
import {
  appendCacheBust,
  buildModelScale,
  fetchPagedFeatureCollectionByBboxes,
  getCurrentViewBboxes,
  getModelNativeSizeMeters,
  MODEL_NATIVE_SIZE_FALLBACK,
  pickReplacementBuilding,
} from '~/utils/map-view-helpers'
import { styleBuildingEntity, styleGreenEntity, stylePipeNodeEntity } from '~/utils/map-entity-style'

const DEFAULT_CAMERA = {
  longitude: 119.1895,
  latitude: 26.0254,
  height: 500,
  heading: 30,
  pitch: -35,
}

type SelectItem = PipeNode | Building | GeoJsonFeature | null

type Viewport = { x: number; y: number; scale: number }

type MapLayers = {
  water: boolean
  sewage: boolean
  drain: boolean
  pipeNodes: boolean
  buildings: boolean
  green?: boolean
}

interface Props {
  selectedId: string | null
  selectedTargets?: {
    pipes?: string[]
    buildings?: string[]
    rooms?: string[]
  }
  viewport: Viewport
  layers: MapLayers
  backendBaseUrl: string
  weatherMode: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [item: SelectItem]
  'update:viewport': [value: Viewport]
}>()

const cesiumContainerRef = ref<HTMLDivElement | null>(null)
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null

const BUILDING_DISTANCE_CONDITION = new Cesium.DistanceDisplayCondition(0, 8000)
const PIPE_NODE_DISTANCE_CONDITION = new Cesium.DistanceDisplayCondition(0, 4500)

// Layer data sources
const dataSources = {
  water: new Cesium.CustomDataSource('water'),
  green: new Cesium.CustomDataSource('green'),
  buildings: new Cesium.CustomDataSource('buildings'),
  pipeNodes: new Cesium.CustomDataSource('pipeNodes'),
  sewage: new Cesium.CustomDataSource('sewage'),
  drain: new Cesium.CustomDataSource('drain'),
  models: new Cesium.CustomDataSource('models'),
  workorderHeat: new Cesium.CustomDataSource('workorderHeat'),
  focus: new Cesium.CustomDataSource('focus'),
}

const normalizedBackendBaseUrl = computed(() => normalizeBackendBaseUrl(props.backendBaseUrl))
type LayerName = keyof typeof dataSources

const MAP_LAYER_NAMES: LayerName[] = ['water', 'sewage', 'drain', 'pipeNodes', 'green', 'buildings']
const DYNAMIC_LAYER_PAGE_SIZE = 800
const DYNAMIC_LAYER_MAX_PAGES = 5
const DYNAMIC_LAYER_RELOAD_DEBOUNCE_MS = 350
const currentViewportBboxes = ref<string[]>([])
const dynamicLayerQueryKey = ref<Record<LayerName, string>>({
  water: '',
  sewage: '',
  drain: '',
  pipeNodes: '',
  buildings: '',
  green: '',
  models: '',
  workorderHeat: '',
  focus: '',
})
let dynamicLayerReloadTimer: ReturnType<typeof setTimeout> | null = null

const BUILDING_REPLACEMENT_MODEL = {
  name: 'Office 建筑模型',
  url: '/models/officeBuild.glb',
}
const BUILDING_REPLACEMENT_TARGET_ID = 'building_test_1'
const BUILDING_REPLACEMENT_TARGET_NAME = '测试建筑1'

function serializeBboxes(bboxes: string[]) {
  return bboxes.join('|')
}

// Watch for layer visibility changes
watchEffect(() => {
  if (!viewer) return
  for (const layerName of MAP_LAYER_NAMES) {
    const dataSource = dataSources[layerName]
    const layerProp = props.layers[layerName as keyof MapLayers]
    if (layerProp !== undefined) {
      dataSource.show = layerProp
    }
  }
  dataSources.models.show = Boolean(props.layers.buildings)
})
const { applySelectionHighlight } = useMapViewSelection({
  getViewer: () => viewer,
  dataSources,
  getSelectedId: () => props.selectedId,
  getSelectedTargets: () => props.selectedTargets,
})
const {
  cleanupWorkorderHeat,
  mountWorkorderHeatmap,
} = useMapViewWorkorderHeat({
  getViewer: () => viewer,
  dataSource: dataSources.workorderHeat,
  onPumpControlRefreshed: () => {
    scheduleDynamicLayerReload(true)
  },
})

onMounted(() => {
  if (!cesiumContainerRef.value) return

  viewer = new Cesium.Viewer(cesiumContainerRef.value, {
    creditContainer: document.createElement('div'),
    creditViewport: document.createElement('div'),
    // Using a darker base map to match the React example's mood
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: ['a', 'b', 'c', 'd'],
      })
    ),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
  })

  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.requestRenderMode = true
  viewer.scene.maximumRenderTimeChange = 0.2
  viewer.scene.globe.maximumScreenSpaceError = 2

  // Remove GeoJSON default labels/billboards (often show as blue markers)
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false

  // Set default camera
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(DEFAULT_CAMERA.heading),
      pitch: Cesium.Math.toRadians(DEFAULT_CAMERA.pitch),
      roll: 0.0,
    },
  })

  // Add all data sources to the viewer
  Object.values(dataSources).forEach(ds => viewer?.dataSources.add(ds))
  mountWorkorderHeatmap()
  currentViewportBboxes.value = getCurrentViewBboxes(viewer)

  // Load and process GeoJSON layers based on visibility
  loadGeoJsonLayers()

  // Setup click handler for selection
  setupClickHandler()
  
  // Setup viewport sync
  setupViewportSync()
  scheduleDynamicLayerReload(true)
})

/**
 * 设置地图点击事件处理器，用于选择地图上的实体
 * 当用户点击地图上的实体时，会触发 select 事件
 */
function setupClickHandler() {
  if (!viewer) return
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const pickedObject = viewer?.scene.pick(movement.position)
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      const entity = pickedObject.id
      const properties = viewer
        ? entity.properties?.getValue(viewer.clock.currentTime)
        : undefined

      if (properties && (properties as any).__workorderHeat) {
        const workorderId = String((properties as any).__workorderId || '').trim()
        if (workorderId && typeof window !== 'undefined') {
          const query = new URLSearchParams({
            tab: 'ops',
            sub: 'ops_linkage',
            third: 'ops_linkage_board',
            workorderId,
          })
          window.open(`/admin?${query.toString()}`, '_blank')
          return
        }
      }
      
      emit('select', {
        id: entity.id,
        type: 'geojson',
        properties: properties as Record<string, unknown> | undefined,
      } as GeoJsonFeature)
    } else {
      emit('select', null)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/**
 * 设置视口同步功能
 * 1. 当相机移动时，将当前视口信息发送给父组件
 * 2. 当父组件的 viewport prop 变化时，更新相机位置
 * 使用 requestAnimationFrame 节流以避免频繁更新
 */
function setupViewportSync() {
  if (!viewer) return

  // 1) Emit viewport on camera move
  const emitViewport = () => {
    if (!viewer) return
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
    emit('update:viewport', {
      x: Cesium.Math.toDegrees(carto.longitude),
      y: Cesium.Math.toDegrees(carto.latitude),
      scale: carto.height,
    })
  }

  // Throttle via RAF to avoid spamming updates
  let raf = 0
  const onChange = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      emitViewport()
      scheduleDynamicLayerReload()
    })
  }

  viewer.camera.changed.addEventListener(onChange)

  onBeforeUnmount(() => {
    viewer?.camera.changed.removeEventListener(onChange)
    if (raf) cancelAnimationFrame(raf)
  })

  // 2) Apply viewport from props
  watch(
    () => props.viewport,
    (vp) => {
      if (!viewer) return
      // Avoid hard loops by only flying if there's a meaningful change
      const current = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
      const lon = Cesium.Math.toDegrees(current.longitude)
      const lat = Cesium.Math.toDegrees(current.latitude)
      const h = current.height

      const eps = 1e-6
      const same =
        Math.abs(lon - vp.x) < eps &&
        Math.abs(lat - vp.y) < eps &&
        Math.abs(h - vp.scale) < 0.5

      if (same) return

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(vp.x, vp.y, vp.scale),
        duration: 0.6,
      })
    },
    { deep: true, immediate: true }
  )
}

const staticLayerFiles: Partial<Record<LayerName, string>> = {
  green: '/map/green.geojson',
}

/**
 * 已加载的图层状态
 */
const loadedLayers = ref<Set<string>>(new Set())

const pipeDataSources = {
  water: dataSources.water,
  drain: dataSources.drain,
  sewage: dataSources.sewage,
}

const { isPipeLayer, loadPipeLayers } = usePipeLayerLoader({
  getViewer: () => viewer,
  dataSources: pipeDataSources,
  loadedLayers,
  sourceUrl: `${normalizedBackendBaseUrl.value}/api/v1/features?layers=pipes&visible=true`,
  getQueryParams: () => ({
    bbox: serializeBboxes(currentViewportBboxes.value) || undefined,
  }),
  pageSize: DYNAMIC_LAYER_PAGE_SIZE,
  maxPages: DYNAMIC_LAYER_MAX_PAGES,
})

function getLayerSourceUrl(layerName: LayerName): string | null {
  if (layerName === 'buildings') {
    return `${normalizedBackendBaseUrl.value}/api/v1/features?layers=buildings&visible=true`
  }
  if (layerName === 'pipeNodes') {
    return `${normalizedBackendBaseUrl.value}/api/v1/twin/nodes`
  }
  return staticLayerFiles[layerName] || null
}

const dynamicLayerLoadSeq: Record<LayerName, number> = {
  water: 0,
  sewage: 0,
  drain: 0,
  pipeNodes: 0,
  buildings: 0,
  green: 0,
  models: 0,
  workorderHeat: 0,
  focus: 0,
}

function buildDynamicLayerQueryKey(layerName: LayerName) {
  const bboxKey = serializeBboxes(currentViewportBboxes.value) || 'none'
  return `${layerName}|bbox=${bboxKey}|size=${DYNAMIC_LAYER_PAGE_SIZE}`
}

/**
 * 加载单个图层数据
 * @param layerName - 图层名称
 */
function loadLayer(layerName: LayerName, force = false) {
  if (isPipeLayer(layerName)) {
    const queryKey = buildDynamicLayerQueryKey(layerName)
    if (!force && dynamicLayerQueryKey.value[layerName] === queryKey) return
    dynamicLayerQueryKey.value[layerName] = queryKey
    void loadPipeLayers(force).then(() => {
      applySelectionHighlight()
    })
    return
  }

  const dataSource = dataSources[layerName]
  if (!dataSource) return

  if (layerName === 'buildings' || layerName === 'pipeNodes') {
    if (!viewer) return
    const queryKey = buildDynamicLayerQueryKey(layerName)
    if (!force && loadedLayers.value.has(layerName) && dynamicLayerQueryKey.value[layerName] === queryKey) return

    const loadSeq = ++dynamicLayerLoadSeq[layerName]
    const sourceUrl = getLayerSourceUrl(layerName)
    if (!sourceUrl) return

    fetchPagedFeatureCollectionByBboxes(
      sourceUrl,
      currentViewportBboxes.value,
      DYNAMIC_LAYER_PAGE_SIZE,
      DYNAMIC_LAYER_MAX_PAGES,
    )
      .then(fc => Cesium.GeoJsonDataSource.load(fc, { clampToGround: true }))
      .then(layerDataSource => {
        if (!viewer || loadSeq !== dynamicLayerLoadSeq[layerName]) return
        dataSource.entities.removeAll()
        let replacement = null
        if (layerName === 'buildings') {
          dataSources.models.entities.removeAll()
          replacement = pickReplacementBuilding(
            layerDataSource.entities.values,
            viewer.clock.currentTime,
            BUILDING_REPLACEMENT_TARGET_ID,
            BUILDING_REPLACEMENT_TARGET_NAME,
          )
        }
        for (const entity of layerDataSource.entities.values) {
          entity.label = undefined
          entity.billboard = undefined
          entity.description = undefined
          if (layerName === 'buildings') {
            if (replacement && String(entity.id) === replacement.id) {
              const initialScale = buildModelScale(
                replacement.footprintTargetSize,
                MODEL_NATIVE_SIZE_FALLBACK,
              )
              const modelEntity = dataSources.models.entities.add({
                id: entity.id,
                name: BUILDING_REPLACEMENT_MODEL.name,
                position: replacement.center,
                orientation: Cesium.Transforms.headingPitchRollQuaternion(
                  replacement.center,
                  new Cesium.HeadingPitchRoll(replacement.heading, 0, 0),
                ),
                model: new Cesium.ModelGraphics({
                  uri: BUILDING_REPLACEMENT_MODEL.url,
                  scale: initialScale,
                  runAnimations: true,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                }),
                properties: new Cesium.PropertyBag({
                  ...replacement.originalProperties,
                  __assetType: 'building',
                  __renderMode: 'replacement-model',
                  __modelUrl: BUILDING_REPLACEMENT_MODEL.url,
                }),
              })

              void getModelNativeSizeMeters(viewer, BUILDING_REPLACEMENT_MODEL.url).then((nativeSizeMeters) => {
                if (!viewer || loadSeq !== dynamicLayerLoadSeq.buildings) return
                const latestModelEntity = dataSources.models.entities.getById(modelEntity.id)
                if (!latestModelEntity?.model) return
                latestModelEntity.model.scale = new Cesium.ConstantProperty(
                  buildModelScale(replacement.footprintTargetSize, nativeSizeMeters),
                )
                viewer.scene.requestRender()
              })
              continue
            }
            entity.point = undefined
            styleBuildingEntity(entity)
            if (entity.polygon) {
              entity.polygon.distanceDisplayCondition = new Cesium.ConstantProperty(
                BUILDING_DISTANCE_CONDITION
              )
            }
          } else {
            stylePipeNodeEntity(entity)
            if (entity.point) {
              entity.point.distanceDisplayCondition = new Cesium.ConstantProperty(
                PIPE_NODE_DISTANCE_CONDITION
              )
            }
          }
          dataSource.entities.add(entity)
        }
        loadedLayers.value.add(layerName)
        dynamicLayerQueryKey.value[layerName] = queryKey
        applySelectionHighlight()
      })
      .catch(err => {
        console.error(`Failed to load ${layerName} layer:`, sourceUrl, err)
      })
    return
  }

  if (!viewer || loadedLayers.value.has(layerName)) return
  const fileUrl = getLayerSourceUrl(layerName)
  if (!fileUrl) return

  const geoJsonUrl = appendCacheBust(fileUrl)
  
  Cesium.GeoJsonDataSource.load(geoJsonUrl, { clampToGround: true })
    .then(layerDataSource => {
      if (!viewer) return

      const entities = layerDataSource.entities.values
      for (const entity of entities) {
        // Remove any auto-generated labels/markers/points from GeoJSON features
        entity.label = undefined
        entity.billboard = undefined
        entity.point = undefined
        entity.description = undefined

        // Apply appropriate styling based on layer type
        if (layerName === 'green') {
          styleGreenEntity(entity)
        }

        dataSource.entities.add(entity)
      }

      loadedLayers.value.add(layerName)
      applySelectionHighlight()
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(`Failed to load ${layerName} layer:`, geoJsonUrl, err)
    })
}

/**
 * 卸载单个图层数据
 * @param layerName - 图层名称
 */
function unloadLayer(layerName: LayerName) {
  if (!viewer) return

  const dataSource = dataSources[layerName]
  if (!dataSource) return

  dataSource.entities.removeAll()
  if (layerName === 'buildings') {
    dataSources.models.entities.removeAll()
  }
  loadedLayers.value.delete(layerName)
  dynamicLayerQueryKey.value[layerName] = ''
}

function syncLayerLoadState(layerName: LayerName, visible: boolean | undefined) {
  const isLoaded = loadedLayers.value.has(layerName)
  if (visible && !isLoaded) {
    loadLayer(layerName)
    return
  }
  if (!visible && isLoaded) {
    unloadLayer(layerName)
  }
}

/**
 * 加载并处理 GeoJSON 图层数据
 * 根据 layers prop 的可见性按需加载各个图层
 */
function loadGeoJsonLayers() {
  for (const layerName of MAP_LAYER_NAMES) {
    syncLayerLoadState(layerName, props.layers[layerName as keyof MapLayers])
  }
}

function reloadDynamicLayers(force = false) {
  if (!viewer) return
  const latestBboxes = getCurrentViewBboxes(viewer)

  const latestBboxKey = serializeBboxes(latestBboxes)
  const currentBboxKey = serializeBboxes(currentViewportBboxes.value)
  const bboxChanged = latestBboxKey !== currentBboxKey
  currentViewportBboxes.value = latestBboxes
  if (!force && !bboxChanged) return

  const firstVisiblePipeLayer = PIPE_LAYER_NAMES.find(
    layer => props.layers[layer as keyof MapLayers]
  ) as LayerName | undefined
  if (firstVisiblePipeLayer) {
    loadLayer(firstVisiblePipeLayer, true)
  }

  if (props.layers.buildings) {
    loadLayer('buildings', true)
  }
  if (props.layers.pipeNodes) {
    loadLayer('pipeNodes', true)
  }
}

function scheduleDynamicLayerReload(force = false) {
  if (dynamicLayerReloadTimer) {
    clearTimeout(dynamicLayerReloadTimer)
  }
  dynamicLayerReloadTimer = setTimeout(() => {
    dynamicLayerReloadTimer = null
    reloadDynamicLayers(force)
  }, DYNAMIC_LAYER_RELOAD_DEBOUNCE_MS)
}

/**
 * 监听图层可见性变化，动态加载/卸载图层
 */
watch(
  () => props.layers,
  (newLayers) => {
    if (!viewer) return

    for (const layerName of MAP_LAYER_NAMES) {
      syncLayerLoadState(layerName, newLayers[layerName as keyof MapLayers])
    }
    scheduleDynamicLayerReload(true)
  },
  { deep: true, immediate: false }
)

watch(
  () => props.weatherMode,
  (enabled) => {
    if (!viewer) return

    // A simple "weather" mood: darker atmosphere + fog. (Cesium doesn't ship a full weather system.)
    viewer.scene.fog.enabled = enabled
    viewer.scene.fog.density = enabled ? 0.00015 : 0.0
    viewer.scene.fog.minimumBrightness = enabled ? 0.15 : 0.5

    // Night-ish lighting mood
    viewer.scene.globe.enableLighting = enabled
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true
    }
    if (viewer.scene.skyBox) {
      viewer.scene.skyBox.show = true
    }

    // Dim the base imagery a bit to match the React demo look
    const layer = viewer.imageryLayers.get(0)
    if (layer) {
      layer.brightness = enabled ? 0.6 : 1.0
      layer.contrast = enabled ? 1.2 : 1.0
      layer.saturation = enabled ? 0.8 : 1.0
    }

    // Set a fixed "time" similar to the React demo's clock setting
    if (enabled) {
      const now = Cesium.JulianDate.now()
      // 14:30 local-ish as a stable preview time
      const base = Cesium.JulianDate.toDate(now)
      base.setHours(14, 30, 0, 0)
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(base)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  cleanupWorkorderHeat()
  if (dynamicLayerReloadTimer) {
    clearTimeout(dynamicLayerReloadTimer)
    dynamicLayerReloadTimer = null
  }
  if (handler) {
    handler.destroy()
    handler = null
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>
