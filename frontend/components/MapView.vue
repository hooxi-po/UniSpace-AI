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
import { normalizeBackendBaseUrl } from '~/utils/backend-url'
import { styleBuildingEntity, styleGreenEntity } from '~/utils/map-entity-style'

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
  buildings: boolean
  green?: boolean
}

interface Props {
  selectedId: string | null
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
let highlightedEntity: Cesium.Entity | null = null
let highlightedOriginal: {
  polygonMaterial?: Cesium.MaterialProperty
  polylineMaterial?: Cesium.MaterialProperty
  polylineWidth?: number
} | null = null

// Layer data sources
const dataSources = {
  water: new Cesium.CustomDataSource('water'),
  green: new Cesium.CustomDataSource('green'),
  buildings: new Cesium.CustomDataSource('buildings'),
  sewage: new Cesium.CustomDataSource('sewage'),
  drain: new Cesium.CustomDataSource('drain'),
}

const normalizedBackendBaseUrl = computed(() => normalizeBackendBaseUrl(props.backendBaseUrl))
type LayerName = keyof typeof dataSources

const MAP_LAYER_NAMES: LayerName[] = ['water', 'sewage', 'drain', 'green', 'buildings']

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
})

watch(
  () => props.selectedId,
  () => {
    if (!viewer) return

    // Restore previous highlight
    if (highlightedEntity && highlightedOriginal) {
      if (highlightedEntity.polygon && highlightedOriginal.polygonMaterial) {
        highlightedEntity.polygon.material = highlightedOriginal.polygonMaterial
      }
      if (highlightedEntity.polyline) {
        if (highlightedOriginal.polylineMaterial) {
          highlightedEntity.polyline.material = highlightedOriginal.polylineMaterial
        }
        if (typeof highlightedOriginal.polylineWidth === 'number') {
          highlightedEntity.polyline.width = new Cesium.ConstantProperty(
            highlightedOriginal.polylineWidth
          )
        }
      }
    }

    highlightedEntity = null
    highlightedOriginal = null

    if (!props.selectedId) return

    // Find entity across all datasources
    let target: Cesium.Entity | null = null
    for (const ds of Object.values(dataSources)) {
      const e = ds.entities.getById(props.selectedId)
      if (e) {
        target = e
        break
      }
    }

    if (!target) return

    highlightedEntity = target
    highlightedOriginal = {
      polygonMaterial: target.polygon?.material,
      polylineMaterial: target.polyline?.material,
      polylineWidth: target.polyline?.width?.getValue(viewer.clock.currentTime),
    }

    const highlightColor = new Cesium.ColorMaterialProperty(
      Cesium.Color.YELLOW.withAlpha(0.9)
    )

    if (target.polygon) {
      target.polygon.material = highlightColor
      target.polygon.outline = new Cesium.ConstantProperty(true)
      target.polygon.outlineColor = new Cesium.ConstantProperty(
        Cesium.Color.YELLOW.withAlpha(0.9)
      )
    }

    if (target.polyline) {
      target.polyline.material = highlightColor
      target.polyline.width = new Cesium.ConstantProperty(6)
    }
  },
  { immediate: true }
)

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

  // Load and process GeoJSON layers based on visibility
  loadGeoJsonLayers()

  // Setup click handler for selection
  setupClickHandler()
  
  // Setup viewport sync
  setupViewportSync()
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
})

function getLayerSourceUrl(layerName: LayerName): string | null {
  if (layerName === 'buildings') {
    return `${normalizedBackendBaseUrl.value}/api/v1/features?layers=buildings&visible=true`
  }
  return staticLayerFiles[layerName] || null
}

function appendCacheBust(url: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Date.now()}`
}

/**
 * 加载单个图层数据
 * @param layerName - 图层名称
 */
function loadLayer(layerName: LayerName) {
  if (isPipeLayer(layerName)) {
    loadPipeLayers()
    return
  }

  if (!viewer || loadedLayers.value.has(layerName)) return

  const dataSource = dataSources[layerName]
  if (!dataSource) return

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
        } else if (layerName === 'buildings') {
          styleBuildingEntity(entity)
        }

        dataSource.entities.add(entity)
      }

      loadedLayers.value.add(layerName)
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
  loadedLayers.value.delete(layerName)
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
