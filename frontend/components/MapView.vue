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
  computeFootprintMetrics,
  fetchPagedFeatureCollectionByBboxes,
  getCurrentViewBboxes,
  getModelNativeSizeMeters,
  getPolygonPositions,
  MODEL_NATIVE_SIZE_FALLBACK,
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
type PickCoordinate = { lon: number; lat: number }
type PickerMarker = PickCoordinate & { label?: string }
type BuildingModelPreview = {
  id: string
  url: string
  heading: number
  pitch: number
  roll: number
  scaleMode: BuildingModelScaleMode
  scale: number
  position: PickCoordinate | null
}

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
  pickerMarker?: PickerMarker | null
  buildingModelPreview?: BuildingModelPreview | null
  coordinateDragTargetId?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [item: SelectItem]
  'update:viewport': [value: Viewport]
  'pick-coordinate': [value: PickCoordinate]
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
const pickerDataSource = new Cesium.CustomDataSource('picker')
const previewModelDataSource = new Cesium.CustomDataSource('preview-model')

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
const buildingPlacementCache = new Map<string, {
  center: Cesium.Cartesian3
  heading: number
  footprintTargetSize: number
}>()
let previewModelLoadSeq = 0
let coordinateDragActive = false
let suppressNextClickSelection = false

type BuildingModelScaleMode = 'auto' | 'fixed'

type BuildingModelConfig = {
  url: string
  heading: number
  pitch: number
  roll: number
  scaleMode: BuildingModelScaleMode
  scale: number
  position: PickCoordinate | null
}

function toFiniteNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) return fallback
    const next = Number.parseFloat(normalized)
    if (Number.isFinite(next)) return next
  }
  return fallback
}

function toPositiveNumber(value: unknown, fallback = 1) {
  const next = toFiniteNumber(value, fallback)
  return next > 0 ? next : fallback
}

function isModelEnabled(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return true
    return !['0', 'false', 'off', 'no'].includes(normalized)
  }
  return true
}

function normalizeModelUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  if (
    normalized.startsWith('/')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('data:')
    || normalized.startsWith('blob:')
  ) {
    return normalized
  }
  return `/${normalized.replace(/^\.?\//, '')}`
}

function readBuildingModelConfig(properties: Record<string, unknown>): BuildingModelConfig | null {
  if (!isModelEnabled(properties.modelEnabled)) return null

  const url = normalizeModelUrl(properties.modelUrl)
  if (!url) return null

  const rawScaleMode = String(properties.modelScaleMode || '').trim().toLowerCase()
  const scaleMode: BuildingModelScaleMode = ['fixed', 'manual'].includes(rawScaleMode) ? 'fixed' : 'auto'
  const modelLongitude = toFiniteNumber(
    properties.modelLongitude ?? properties.modelLon ?? properties.modelLng,
    Number.NaN,
  )
  const modelLatitude = toFiniteNumber(
    properties.modelLatitude ?? properties.modelLat,
    Number.NaN,
  )
  const hasCustomPosition = Number.isFinite(modelLongitude)
    && Number.isFinite(modelLatitude)
    && modelLongitude >= -180
    && modelLongitude <= 180
    && modelLatitude >= -90
    && modelLatitude <= 90

  return {
    url,
    heading: toFiniteNumber(properties.modelHeading),
    pitch: toFiniteNumber(properties.modelPitch),
    roll: toFiniteNumber(properties.modelRoll),
    scaleMode,
    scale: toPositiveNumber(properties.modelScale, 1),
    position: hasCustomPosition ? { lon: modelLongitude, lat: modelLatitude } : null,
  }
}

function resolveModelScale(
  config: BuildingModelConfig,
  footprintTargetSize: number,
  nativeSizeMeters: number,
) {
  if (config.scaleMode === 'fixed') {
    return config.scale
  }
  return buildModelScale(footprintTargetSize, nativeSizeMeters) * config.scale
}

function serializeBboxes(bboxes: string[]) {
  return bboxes.join('|')
}

function toLonLat(cartesian: Cesium.Cartesian3): PickCoordinate {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  return {
    lon: Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)),
    lat: Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)),
  }
}

function screenToLonLat(screenPosition: Cesium.Cartesian2): PickCoordinate | null {
  if (!viewer) return null

  if (viewer.scene.mode === Cesium.SceneMode.SCENE2D || viewer.scene.mode === Cesium.SceneMode.COLUMBUS_VIEW) {
    const ellipsoid = viewer.scene.globe?.ellipsoid
    if (!ellipsoid) return null
    const cartesian = viewer.camera.pickEllipsoid(screenPosition, ellipsoid)
    if (!cartesian) return null
    return toLonLat(cartesian)
  }

  const ray = viewer.camera.getPickRay(screenPosition)
  if (!ray) return null
  const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
  if (!cartesian) return null
  return toLonLat(cartesian)
}

function updatePickerMarker() {
  pickerDataSource.entities.removeAll()

  const marker = props.pickerMarker
  if (!viewer || !marker) return

  pickerDataSource.entities.add({
    id: 'picker-marker',
    position: Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 0),
    point: new Cesium.PointGraphics({
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString('#1664ff').withAlpha(0.95),
      outlineColor: Cesium.Color.WHITE.withAlpha(0.95),
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }),
    label: marker.label
      ? new Cesium.LabelGraphics({
          text: marker.label,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#1664ff').withAlpha(0.92),
          pixelOffset: new Cesium.Cartesian2(0, -24),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        })
      : undefined,
  })

  viewer.scene.requestRender()
}

function updateBuildingModelPreview() {
  previewModelDataSource.entities.removeAll()

  const preview = props.buildingModelPreview
  for (const entity of dataSources.models.entities.values) {
    entity.show = !preview || String(entity.id) !== preview.id
  }

  if (!viewer || !preview) {
    viewer?.scene.requestRender()
    return
  }

  const placement = buildingPlacementCache.get(preview.id) || (
    preview.position
      ? {
          center: Cesium.Cartesian3.fromDegrees(preview.position.lon, preview.position.lat, 0),
          heading: 0,
          footprintTargetSize: MODEL_NATIVE_SIZE_FALLBACK,
        }
      : null
  )
  if (!placement) {
    viewer.scene.requestRender()
    return
  }

  const position = preview.position
    ? Cesium.Cartesian3.fromDegrees(preview.position.lon, preview.position.lat, 0)
    : placement.center

  const initialScale = resolveModelScale(
    {
      url: preview.url,
      heading: preview.heading,
      pitch: preview.pitch,
      roll: preview.roll,
      scaleMode: preview.scaleMode,
      scale: preview.scale,
      position: preview.position,
    },
    placement.footprintTargetSize,
    MODEL_NATIVE_SIZE_FALLBACK,
  )

  const previewEntity = previewModelDataSource.entities.add({
    id: `preview-model:${preview.id}`,
    position,
    orientation: Cesium.Transforms.headingPitchRollQuaternion(
      position,
      new Cesium.HeadingPitchRoll(
        placement.heading + Cesium.Math.toRadians(preview.heading),
        Cesium.Math.toRadians(preview.pitch),
        Cesium.Math.toRadians(preview.roll),
      ),
    ),
    model: new Cesium.ModelGraphics({
      uri: preview.url,
      scale: initialScale,
      runAnimations: true,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      distanceDisplayCondition: new Cesium.ConstantProperty(BUILDING_DISTANCE_CONDITION),
    }),
  })

  if (preview.scaleMode === 'auto') {
    const loadSeq = ++previewModelLoadSeq
    void getModelNativeSizeMeters(viewer, preview.url).then((nativeSizeMeters) => {
      if (!viewer || loadSeq !== previewModelLoadSeq) return
      const latestEntity = previewModelDataSource.entities.getById(`preview-model:${preview.id}`)
      if (!latestEntity?.model) return
      latestEntity.model.scale = new Cesium.ConstantProperty(
        resolveModelScale(
          {
            url: preview.url,
            heading: preview.heading,
            pitch: preview.pitch,
            roll: preview.roll,
            scaleMode: preview.scaleMode,
            scale: preview.scale,
            position: preview.position,
          },
          placement.footprintTargetSize,
          nativeSizeMeters,
        ),
      )
      viewer.scene.requestRender()
    })
  }

  viewer.scene.requestRender()
}

function setCameraInteractionEnabled(enabled: boolean) {
  if (!viewer) return
  const controller = viewer.scene.screenSpaceCameraController
  controller.enableRotate = enabled
  controller.enableTranslate = enabled
  controller.enableZoom = enabled
  controller.enableTilt = enabled
  controller.enableLook = enabled
}

function isCoordinateDragTarget(pickedObject: unknown) {
  const targetId = props.coordinateDragTargetId?.trim()
  if (!targetId || !pickedObject || !Cesium.defined(pickedObject)) return false

  const picked = pickedObject as { id?: unknown }
  const entity = picked.id instanceof Cesium.Entity ? picked.id : null
  if (!entity) return false

  const entityId = String(entity.id || '')
  return entityId === 'picker-marker'
    || entityId === targetId
    || entityId === `preview-model:${targetId}`
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
  viewer.dataSources.add(pickerDataSource)
  viewer.dataSources.add(previewModelDataSource)
  mountWorkorderHeatmap()
  currentViewportBboxes.value = getCurrentViewBboxes(viewer)
  updatePickerMarker()
  updateBuildingModelPreview()

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
    if (!viewer) return
    const pickedObject = viewer.scene.pick(movement.position)
    if (!isCoordinateDragTarget(pickedObject)) return

    const pickedCoordinate = screenToLonLat(movement.position)
    if (pickedCoordinate) {
      emit('pick-coordinate', pickedCoordinate)
    }

    coordinateDragActive = true
    suppressNextClickSelection = true
    setCameraInteractionEnabled(false)
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    if (!coordinateDragActive) return
    const pickedCoordinate = screenToLonLat(movement.endPosition)
    if (!pickedCoordinate) return
    emit('pick-coordinate', pickedCoordinate)
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  handler.setInputAction(() => {
    if (!coordinateDragActive) return
    coordinateDragActive = false
    setCameraInteractionEnabled(true)
  }, Cesium.ScreenSpaceEventType.LEFT_UP)

  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (suppressNextClickSelection) {
      suppressNextClickSelection = false
      return
    }

    const pickedCoordinate = screenToLonLat(movement.position)
    if (pickedCoordinate) {
      emit('pick-coordinate', pickedCoordinate)
    }
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

watch(
  () => props.pickerMarker,
  () => {
    updatePickerMarker()
  },
  { deep: true, immediate: true },
)

watch(
  () => props.buildingModelPreview,
  () => {
    updateBuildingModelPreview()
  },
  { deep: true, immediate: true },
)

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
        if (layerName === 'buildings') {
          dataSources.models.entities.removeAll()
          buildingPlacementCache.clear()
        }
        for (const entity of layerDataSource.entities.values) {
          entity.label = undefined
          entity.billboard = undefined
          entity.description = undefined
          if (layerName === 'buildings') {
            const currentTime = viewer.clock.currentTime
            const originalProperties = (entity.properties?.getValue(currentTime) || {}) as Record<string, unknown>
            const modelConfig = readBuildingModelConfig(originalProperties)
            const polygonPositions = getPolygonPositions(entity, currentTime)

            if (polygonPositions) {
              const placement = computeFootprintMetrics(polygonPositions)
              buildingPlacementCache.set(String(entity.id), placement)
            }

            if (modelConfig && polygonPositions) {
              const placement = buildingPlacementCache.get(String(entity.id)) || computeFootprintMetrics(polygonPositions)
              const initialScale = resolveModelScale(
                modelConfig,
                placement.footprintTargetSize,
                MODEL_NATIVE_SIZE_FALLBACK,
              )
              const modelPosition = modelConfig.position
                ? Cesium.Cartesian3.fromDegrees(modelConfig.position.lon, modelConfig.position.lat, 0)
                : placement.center
              const modelEntity = dataSources.models.entities.add({
                id: entity.id,
                name: String(originalProperties.name || originalProperties.short_name || entity.id),
                position: modelPosition,
                orientation: Cesium.Transforms.headingPitchRollQuaternion(
                  modelPosition,
                  new Cesium.HeadingPitchRoll(
                    placement.heading + Cesium.Math.toRadians(modelConfig.heading),
                    Cesium.Math.toRadians(modelConfig.pitch),
                    Cesium.Math.toRadians(modelConfig.roll),
                  ),
                ),
                model: new Cesium.ModelGraphics({
                  uri: modelConfig.url,
                  scale: initialScale,
                  runAnimations: true,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                  distanceDisplayCondition: new Cesium.ConstantProperty(BUILDING_DISTANCE_CONDITION),
                }),
                properties: new Cesium.PropertyBag({
                  ...originalProperties,
                  __assetType: 'building',
                  __renderMode: 'model',
                  __modelUrl: modelConfig.url,
                }),
              })

              if (modelConfig.scaleMode === 'auto') {
                void getModelNativeSizeMeters(viewer, modelConfig.url).then((nativeSizeMeters) => {
                  if (!viewer || loadSeq !== dynamicLayerLoadSeq.buildings) return
                  const latestModelEntity = dataSources.models.entities.getById(modelEntity.id)
                  if (!latestModelEntity?.model) return
                  latestModelEntity.model.scale = new Cesium.ConstantProperty(
                    resolveModelScale(modelConfig, placement.footprintTargetSize, nativeSizeMeters),
                  )
                  viewer.scene.requestRender()
                })
              }
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
        if (layerName === 'buildings') {
          updateBuildingModelPreview()
        }
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
    buildingPlacementCache.clear()
    updateBuildingModelPreview()
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
  coordinateDragActive = false
  suppressNextClickSelection = false
  if (viewer) {
    setCameraInteractionEnabled(true)
    viewer.destroy()
    viewer = null
  }
})
</script>
