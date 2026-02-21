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
const DYNAMIC_LAYER_PAGE_SIZE = 800
const DYNAMIC_LAYER_MAX_PAGES = 5
const DYNAMIC_LAYER_RELOAD_DEBOUNCE_MS = 350
const currentViewportBboxes = ref<string[]>([])
const dynamicLayerQueryKey = ref<Record<LayerName, string>>({
  water: '',
  sewage: '',
  drain: '',
  buildings: '',
  green: '',
})
let dynamicLayerReloadTimer: ReturnType<typeof setTimeout> | null = null

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
  currentViewportBboxes.value = getCurrentViewBboxes()

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
  return staticLayerFiles[layerName] || null
}

function appendCacheBust(url: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Date.now()}`
}

function appendQuery(url: string, query: Record<string, string | number | undefined>) {
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') {
      u.searchParams.delete(key)
      continue
    }
    u.searchParams.set(key, String(value))
  }
  return u.toString()
}

function getCurrentViewBboxes() {
  if (!viewer) return []
  const rectangle = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid)
  if (!rectangle) return []

  const west = Cesium.Math.toDegrees(rectangle.west)
  const south = Cesium.Math.toDegrees(rectangle.south)
  const east = Cesium.Math.toDegrees(rectangle.east)
  const north = Cesium.Math.toDegrees(rectangle.north)
  const minLat = Math.max(-90, Math.min(south, north))
  const maxLat = Math.min(90, Math.max(south, north))

  if (![west, minLat, east, maxLat].every(Number.isFinite)) return []

  const normalizedWest = Math.max(-180, Math.min(180, west))
  const normalizedEast = Math.max(-180, Math.min(180, east))
  if (normalizedWest <= normalizedEast) {
    return [[normalizedWest, minLat, normalizedEast, maxLat].map(v => v.toFixed(6)).join(',')]
  }

  // When crossing anti-meridian, split into two envelopes.
  return [
    [normalizedWest, minLat, 180, maxLat].map(v => v.toFixed(6)).join(','),
    [-180, minLat, normalizedEast, maxLat].map(v => v.toFixed(6)).join(','),
  ]
}

async function fetchPagedFeatureCollection(baseUrl: string, bbox: string | null) {
  const features: Record<string, unknown>[] = []
  for (let page = 1; page <= DYNAMIC_LAYER_MAX_PAGES; page++) {
    const requestUrl = appendQuery(baseUrl, {
      bbox: bbox || undefined,
      page,
      limit: DYNAMIC_LAYER_PAGE_SIZE,
    })
    const res = await fetch(requestUrl)
    if (!res.ok) {
      throw new Error(`load_layer_http_${res.status}`)
    }
    const fc = (await res.json()) as { features?: Record<string, unknown>[] }
    const pageFeatures = Array.isArray(fc.features) ? fc.features : []
    features.push(...pageFeatures)
    if (pageFeatures.length < DYNAMIC_LAYER_PAGE_SIZE) break
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

async function fetchPagedFeatureCollectionByBboxes(baseUrl: string, bboxes: string[]) {
  const uniqueFeatures = new Map<string, Record<string, unknown>>()
  const featuresWithoutId: Record<string, unknown>[] = []
  const effectiveBboxes = bboxes.length ? bboxes : [null]

  for (const bbox of effectiveBboxes) {
    const fc = await fetchPagedFeatureCollection(baseUrl, bbox)
    for (const feature of fc.features) {
      const id = feature.id
      if (id === undefined || id === null) {
        featuresWithoutId.push(feature)
        continue
      }
      uniqueFeatures.set(String(id), feature)
    }
  }

  return {
    type: 'FeatureCollection',
    features: [...uniqueFeatures.values(), ...featuresWithoutId],
  }
}

const dynamicLayerLoadSeq: Record<LayerName, number> = {
  water: 0,
  sewage: 0,
  drain: 0,
  buildings: 0,
  green: 0,
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
    loadPipeLayers(force)
    return
  }

  const dataSource = dataSources[layerName]
  if (!dataSource) return

  if (layerName === 'buildings') {
    if (!viewer) return
    const queryKey = buildDynamicLayerQueryKey(layerName)
    if (!force && loadedLayers.value.has(layerName) && dynamicLayerQueryKey.value[layerName] === queryKey) return

    const loadSeq = ++dynamicLayerLoadSeq[layerName]
    const sourceUrl = getLayerSourceUrl(layerName)
    if (!sourceUrl) return

    fetchPagedFeatureCollectionByBboxes(sourceUrl, currentViewportBboxes.value)
      .then(fc => Cesium.GeoJsonDataSource.load(fc, { clampToGround: true }))
      .then(layerDataSource => {
        if (!viewer || loadSeq !== dynamicLayerLoadSeq[layerName]) return
        dataSource.entities.removeAll()
        for (const entity of layerDataSource.entities.values) {
          entity.label = undefined
          entity.billboard = undefined
          entity.point = undefined
          entity.description = undefined
          styleBuildingEntity(entity)
          dataSource.entities.add(entity)
        }
        loadedLayers.value.add(layerName)
        dynamicLayerQueryKey.value[layerName] = queryKey
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
  const latestBboxes = getCurrentViewBboxes()

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
