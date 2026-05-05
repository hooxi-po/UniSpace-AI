<script setup lang="ts">
import * as Cesium from 'cesium'
import { AlertTriangle, CheckCircle2, Layers3, MapPinned, Waves } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type {
  BuildingPreview,
  NodePreview,
  Pipe25DPreviewData,
} from '~/composables/admin/pipe2d-editor/useSelectedPipe25DPreview'
import { getModelNativeSizeMeters, buildModelScale, MODEL_NATIVE_SIZE_FALLBACK } from '~/utils/map-view-helpers'

const props = defineProps<{
  open: boolean
  preview: Pipe25DPreviewData | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const viewerContainerRef = ref<HTMLDivElement | null>(null)
const activeNodeId = ref<string | null>(null)
const viewerReady = ref(false)
const renderError = ref('')
const cameraMode = ref<'angled' | 'top'>('angled')
const nodeListItemRefs = new Map<string, HTMLElement>()

let viewer: Cesium.Viewer | null = null
let nodePickHandler: Cesium.ScreenSpaceEventHandler | null = null
let renderVersion = 0
const dataSource = new Cesium.CustomDataSource('pipe25d-preview')
const buildingModelEntities = new Map<string, Cesium.Entity>()

type SceneNode = {
  id: string
  name: string
  nodeType: string
  sourceType: NodePreview['sourceType']
  status: NodePreview['status']
  point: [number, number]
  elevation: number
  depthMeters: number
  pressure: number | null
  flowRate: number | null
  groundHeight: number
  displayHeight: number
  hasWorkorder: boolean
  workorderCount: number
}

const summaryStats = computed(() => {
  if (!props.preview) return []
  const critical = sceneNodes.value.filter(node => node.status === 'critical').length
  const warning = sceneNodes.value.filter(node => node.status === 'warning').length
  const withWorkorders = sceneNodes.value.filter(node => node.hasWorkorder).length
  return [
    { label: '节点', value: String(sceneNodes.value.length) },
    { label: '关联建筑', value: String(props.preview.buildings.length) },
    { label: '风险节点', value: String(critical + warning) },
    { label: '工单节点', value: String(withWorkorders) },
  ]
})

const activeNode = computed(() => {
  if (!sceneNodes.value.length) return null
  if (activeNodeId.value) {
    return sceneNodes.value.find(node => node.id === activeNodeId.value) || sceneNodes.value[0]
  }
  return sceneNodes.value[0]
})

const mediumLabel = computed(() => {
  const medium = String(props.preview?.medium || '').toLowerCase()
  if (medium === 'water') return '供水'
  if (medium === 'drainage' || medium === 'drain') return '排水'
  if (medium === 'sewage') return '污水'
  return props.preview?.medium || '未知'
})

const elevationRange = computed(() => {
  const nodes = sceneNodes.value || []
  if (!nodes.length) return null
  const min = Math.min(...nodes.map(node => node.elevation))
  const max = Math.max(...nodes.map(node => node.elevation))
  return {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
  }
})

const sceneNodes = computed(() => {
  const preview = props.preview
  if (!preview?.pipeProfiles.length) return []

  return preview.nodes.map(node => {
    const sample = findNearestProfileSample(preview.pipeProfiles, node.point)
    return {
      id: node.id,
      name: node.name,
      nodeType: node.nodeType,
      sourceType: node.sourceType,
      status: node.status,
      point: node.point,
      elevation: node.elevation,
      depthMeters: node.depthMeters,
      pressure: node.pressure,
      flowRate: node.flowRate,
      groundHeight: sample?.groundHeight ?? PIPE_GROUND_FALLBACK,
      displayHeight: sample?.displayHeight ?? PIPE_DISPLAY_FALLBACK,
      hasWorkorder: node.hasWorkorder,
      workorderCount: node.workorderCount,
    }
  })
})

const crossSection = computed(() => {
  const preview = props.preview
  if (!preview?.pipeProfiles.length) return null

  const samples = preview.pipeProfiles.flat()
  if (samples.length < 2) return null

  let totalDistance = 0
  const samplesWithDistance = samples.map((sample, index) => {
    if (index > 0) {
      totalDistance += metersBetweenPoints(samples[index - 1].point, sample.point)
    }
    return {
      ...sample,
      distance: totalDistance,
    }
  })

  const width = 560
  const height = 180
  const padding = { top: 20, right: 22, bottom: 32, left: 42 }
  const usableWidth = width - padding.left - padding.right
  const usableHeight = height - padding.top - padding.bottom
  const minHeight = Math.min(...samplesWithDistance.map(item => item.displayHeight))
  const maxHeight = Math.max(...samplesWithDistance.map(item => item.groundHeight))
  const heightSpan = Math.max(maxHeight - minHeight, 1)
  const totalSpan = Math.max(totalDistance, 1)

  const toX = (distance: number) => padding.left + (distance / totalSpan) * usableWidth
  const toY = (value: number) => padding.top + ((maxHeight - value) / heightSpan) * usableHeight

  const groundPolyline = samplesWithDistance
    .map(item => `${toX(item.distance).toFixed(2)},${toY(item.groundHeight).toFixed(2)}`)
    .join(' ')
  const pipePolyline = samplesWithDistance
    .map(item => `${toX(item.distance).toFixed(2)},${toY(item.displayHeight).toFixed(2)}`)
    .join(' ')

  const nodeMarkers = sceneNodes.value.map(node => {
    let best = samplesWithDistance[0]
    let bestDistance = Number.POSITIVE_INFINITY
    for (const sample of samplesWithDistance) {
      const distance = squaredPointDistance(sample.point, node.point)
      if (distance < bestDistance) {
        bestDistance = distance
        best = sample
      }
    }
    return {
      id: node.id,
      name: node.name,
      status: node.status,
      x: Number(toX(best.distance).toFixed(2)),
      y: Number(toY(best.displayHeight).toFixed(2)),
      groundY: Number(toY(best.groundHeight).toFixed(2)),
      depthMeters: node.depthMeters,
      elevation: node.elevation,
    }
  })

  const activeMarker = activeNodeId.value
    ? nodeMarkers.find(marker => marker.id === activeNodeId.value) || null
    : null

  const horizontalGuides = 4
  const gridLines = Array.from({ length: horizontalGuides + 1 }, (_, index) => {
    const ratio = index / horizontalGuides
    const value = maxHeight - ratio * heightSpan
    return {
      y: Number((padding.top + ratio * usableHeight).toFixed(2)),
      value: Number(value.toFixed(2)),
    }
  })

  return {
    width,
    height,
    totalDistance: Number(totalDistance.toFixed(1)),
    groundPolyline,
    pipePolyline,
    nodeMarkers,
    gridLines,
    activeMarker,
  }
})

function nodeTypeLabel(type: string) {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'valve') return '阀门'
  if (normalized === 'manhole') return '检查井'
  if (normalized === 'pump') return '泵'
  if (normalized === 'meter') return '测点'
  if (normalized === 'junction') return '连接点'
  return '节点'
}

function nodeStatusLabel(status: NodePreview['status']) {
  if (status === 'critical') return '故障'
  if (status === 'warning') return '预警'
  return '正常'
}

function formatMetric(value: number | null, unit = '') {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`
}

function formatDistanceMeters(value: number) {
  if (!Number.isFinite(value)) return '--'
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${value.toFixed(1)} m`
}

const PIPE_GROUND_FALLBACK = 10
const PIPE_DISPLAY_FALLBACK = 6

function findNearestProfileSample(
  profiles: Pipe25DPreviewData['pipeProfiles'],
  point: [number, number],
) {
  let bestSample: Pipe25DPreviewData['pipeProfiles'][number][number] | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const profile of profiles) {
    for (const sample of profile) {
      const distance = squaredPointDistance(sample.point, point)
      if (distance < bestDistance) {
        bestDistance = distance
        bestSample = sample
      }
    }
  }
  return bestSample
}

function getNodeColor(status: NodePreview['status']) {
  if (status === 'critical') return Cesium.Color.fromCssColorString('#ef4444')
  if (status === 'warning') return Cesium.Color.fromCssColorString('#f59e0b')
  return Cesium.Color.fromCssColorString('#14b8a6')
}

function getPipeColor(medium: string) {
  const normalized = String(medium || '').toLowerCase()
  if (normalized === 'sewage') return Cesium.Color.fromCssColorString('#7c3aed')
  if (normalized === 'drain' || normalized === 'drainage') return Cesium.Color.fromCssColorString('#0ea5e9')
  return Cesium.Color.fromCssColorString('#2563eb')
}

function ensureViewer() {
  if (viewer || !viewerContainerRef.value) return

  viewer = new Cesium.Viewer(viewerContainerRef.value, {
    creditContainer: document.createElement('div'),
    creditViewport: document.createElement('div'),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shadows: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  })

  viewer.scene.requestRenderMode = true
  viewer.scene.maximumRenderTimeChange = 0.2
  viewer.scene.globe.depthTestAgainstTerrain = false
  viewer.scene.screenSpaceCameraController.enableTilt = true
  viewer.scene.screenSpaceCameraController.enableLook = false
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = false
  }
  if (viewer.scene.sun) {
    viewer.scene.sun.show = false
  }
  if (viewer.scene.moon) {
    viewer.scene.moon.show = false
  }
  viewer.scene.globe.showGroundAtmosphere = false
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#f3f7ff')
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#eef4ff')
  viewer.scene.highDynamicRange = false
  viewer.clock.shouldAnimate = true
  viewer.scene.postProcessStages.fxaa.enabled = true
  viewer.imageryLayers.removeAll()
  viewer.dataSources.add(dataSource)
  nodePickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  nodePickHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (!viewer) return
    const picked = viewer.scene.pick(movement.position)
    const entity = picked?.id instanceof Cesium.Entity ? picked.id : null
    const rawId = String(entity?.id || '')
    const nodeId = rawId.startsWith('node-top:') || rawId.startsWith('node-column:')
      ? rawId.split(':')[1]
      : ''
    if (!nodeId) return
    setActiveNode(nodeId, { focusCamera: true, scrollIntoView: true })
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  viewerReady.value = true
}

function destroyViewer() {
  buildingModelEntities.clear()
  viewerReady.value = false
  renderError.value = ''
  dataSource.entities.removeAll()
  nodePickHandler?.destroy()
  nodePickHandler = null
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy()
  }
  viewer = null
}

function buildPipePositions(profile: Pipe25DPreviewData['pipeProfiles'][number]) {
  return profile.map(item =>
    Cesium.Cartesian3.fromDegrees(item.point[0], item.point[1], item.displayHeight),
  )
}

function buildGroundPositions(profile: Pipe25DPreviewData['pipeProfiles'][number]) {
  return profile.map(item =>
    Cesium.Cartesian3.fromDegrees(item.point[0], item.point[1], item.groundHeight),
  )
}

function buildPipeShape(radiusMeters: number) {
  const radius = Math.max(0.12, radiusMeters)
  return [
    new Cesium.Cartesian2(-radius, -radius * 0.58),
    new Cesium.Cartesian2(radius, -radius * 0.58),
    new Cesium.Cartesian2(radius, radius * 0.58),
    new Cesium.Cartesian2(-radius, radius * 0.58),
  ]
}

function getPipeRadiusMeters(preview: Pipe25DPreviewData) {
  const diameterMm = preview.segment?.diameterMm ?? 240
  return Math.max(0.35, Number(((diameterMm / 1000 / 2) * 1.8).toFixed(3)))
}

function nodeGlyphKind(nodeType: string) {
  const normalized = String(nodeType || '').toLowerCase()
  if (normalized === 'vertex') return 'point'
  if (normalized === 'manhole') return 'cylinder'
  if (normalized === 'valve') return 'short-cylinder'
  if (normalized === 'pump') return 'box'
  if (normalized === 'meter') return 'ring'
  return 'point'
}

function renderBuildings(buildings: BuildingPreview[]) {
  if (!viewer) return
  for (const building of buildings) {
    if (!building.outline || building.outline.length < 3) continue

    const outlinePositions = building.outline.map(point =>
      Cesium.Cartesian3.fromDegrees(point[0], point[1], 0),
    )

    dataSource.entities.add({
      id: `building-outline:${building.id}`,
      polyline: new Cesium.PolylineGraphics({
        positions: [...outlinePositions, outlinePositions[0]],
        width: 2,
        material: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.92),
        clampToGround: false,
      }),
    })

    dataSource.entities.add({
      id: `building-shell:${building.id}`,
      polygon: new Cesium.PolygonGraphics({
        hierarchy: new Cesium.PolygonHierarchy(outlinePositions),
        height: 0,
        extrudedHeight: building.heightMeters,
        material: Cesium.Color.fromCssColorString('#dbeafe').withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.65),
        perPositionHeight: false,
      }),
    })
  }
}

async function renderBuildingModels(buildings: BuildingPreview[]) {
  if (!viewer) return
  const currentRenderVersion = renderVersion
  for (const building of buildings) {
    if (!building.modelConfig?.url || !building.outline?.length) continue

    const center = computeOutlineCenter(building.outline)
    const heading = computeOutlineHeading(building.outline)
    const footprintTargetSize = computeOutlineFootprintSize(building.outline)
    const positionSource = building.modelConfig.position || center
    const position = Cesium.Cartesian3.fromDegrees(positionSource.lon, positionSource.lat, 0)
    const nativeSize = await getModelNativeSizeMeters(viewer, building.modelConfig.url)
    if (!viewer || currentRenderVersion !== renderVersion) return
    const scale = building.modelConfig.scaleMode === 'fixed'
      ? building.modelConfig.scale
      : buildModelScale(footprintTargetSize, nativeSize || MODEL_NATIVE_SIZE_FALLBACK) * building.modelConfig.scale

    const entity = dataSource.entities.add({
      id: `building-model:${building.id}`,
      position,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        position,
        new Cesium.HeadingPitchRoll(
          heading + Cesium.Math.toRadians(building.modelConfig.heading),
          Cesium.Math.toRadians(building.modelConfig.pitch),
          Cesium.Math.toRadians(building.modelConfig.roll),
        ),
      ),
      model: new Cesium.ModelGraphics({
        uri: building.modelConfig.url,
        scale: Math.max(scale, 0.01),
        runAnimations: true,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        silhouetteColor: Cesium.Color.fromCssColorString('#60a5fa').withAlpha(0.35),
        silhouetteSize: 1,
      }),
    })
    buildingModelEntities.set(building.id, entity)
  }
}

function computeOutlineCenter(outline: BuildingPreview['outline']) {
  const points = outline || []
  if (!points.length) return { lon: 0, lat: 0 }
  const lon = points.reduce((sum, point) => sum + point[0], 0) / points.length
  const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length
  return { lon, lat }
}

function computeOutlineHeading(outline: BuildingPreview['outline']) {
  const points = outline || []
  if (points.length < 2) return 0
  let bestAngle = 0
  let bestLength = 0
  for (let index = 0; index < points.length; index++) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const dx = next[0] - current[0]
    const dy = next[1] - current[1]
    const length = Math.sqrt(dx * dx + dy * dy)
    if (length > bestLength) {
      bestLength = length
      bestAngle = Math.atan2(dx, dy)
    }
  }
  return bestAngle
}

function computeOutlineFootprintSize(outline: BuildingPreview['outline']) {
  const points = outline || []
  if (points.length < 2) return MODEL_NATIVE_SIZE_FALLBACK
  let minLon = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minLon = Math.min(minLon, point[0])
    maxLon = Math.max(maxLon, point[0])
    minLat = Math.min(minLat, point[1])
    maxLat = Math.max(maxLat, point[1])
  }
  const centerLat = (minLat + maxLat) / 2
  const width = Math.abs(maxLon - minLon) * 111320 * Math.cos(centerLat * Math.PI / 180)
  const depth = Math.abs(maxLat - minLat) * 110540
  return Math.max(width, depth, Math.sqrt(width * width + depth * depth) * 0.72, 12)
}

function setNodeListItemRef(nodeId: string, element: Element | { $el?: Element | null } | null) {
  const resolved = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null
  if (resolved) {
    nodeListItemRefs.set(nodeId, resolved)
    return
  }
  nodeListItemRefs.delete(nodeId)
}

function scrollActiveNodeIntoView() {
  const nodeId = activeNodeId.value
  if (!nodeId) return
  nextTick(() => {
    nodeListItemRefs.get(nodeId)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  })
}

function updateNodeVisualState() {
  const currentNodeId = activeNodeId.value
  for (const entity of dataSource.entities.values) {
    const entityId = String(entity.id || '')
    if (entityId.startsWith('node-column:') && entity.polyline) {
      const nodeId = entityId.split(':')[1]
      entity.polyline.width = new Cesium.ConstantProperty(currentNodeId === nodeId ? 4 : 2.5)
      continue
    }
    if (entityId.startsWith('node-top:') && entity.point) {
      const nodeId = entityId.split(':')[1]
      const isActive = currentNodeId === nodeId
      entity.point.pixelSize = new Cesium.ConstantProperty(isActive ? 18 : 14)
      entity.point.outlineWidth = new Cesium.ConstantProperty(isActive ? 3 : 2)
      if (entity.label) {
        entity.label.font = new Cesium.ConstantProperty(isActive ? 'bold 13px sans-serif' : '12px sans-serif')
        entity.label.backgroundColor = new Cesium.ConstantProperty(
          isActive
            ? Cesium.Color.fromCssColorString('#dbeafe').withAlpha(0.96)
            : Cesium.Color.WHITE.withAlpha(0.92),
        )
      }
    }
  }
  syncActiveNodePulse()
  viewer?.scene.requestRender()
}

function setActiveNode(nodeId: string, options?: { focusCamera?: boolean; scrollIntoView?: boolean }) {
  activeNodeId.value = nodeId
  updateNodeVisualState()
  if (options?.scrollIntoView) {
    scrollActiveNodeIntoView()
  }
  if (options?.focusCamera) {
    void focusNode(nodeId)
  }
}

function getNodeSample(preview: Pipe25DPreviewData, nodeId: string) {
  const node = sceneNodes.value.find(item => item.id === nodeId)
  if (!node) return null
  const sample = preview.pipeProfiles.flat().find(item => almostSamePoint(item.point, node.point))
  return { node, sample }
}

async function focusNode(nodeId: string) {
  if (!viewer || !props.preview) return
  const result = getNodeSample(props.preview, nodeId)
  if (!result) return

  const { node, sample } = result
  const groundHeight = sample?.groundHeight ?? 10
  const nodeHeight = sample?.displayHeight ?? Math.max(2, 10 - node.depthMeters * 2.8)
  const bottom = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], groundHeight)
  const top = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], nodeHeight)
  const sphere = Cesium.BoundingSphere.fromPoints([bottom, top])
  const pitch = cameraMode.value === 'top' ? Cesium.Math.toRadians(-89) : Cesium.Math.toRadians(-34)
  const heading = cameraMode.value === 'top' ? 0 : Cesium.Math.toRadians(-28)
  const range = cameraMode.value === 'top' ? 22 : 28
  await viewer.camera.flyToBoundingSphere(sphere, {
    duration: 0.45,
    offset: new Cesium.HeadingPitchRange(heading, pitch, range),
  })
  viewer.scene.requestRender()
}

function syncActiveNodePulse() {
  const existing = dataSource.entities.getById('node-pulse')
  const preview = props.preview
  const nodeId = activeNodeId.value
  if (!preview || !nodeId) {
    if (existing) dataSource.entities.remove(existing)
    return
  }

  const result = getNodeSample(preview, nodeId)
  if (!result) {
    if (existing) dataSource.entities.remove(existing)
    return
  }

  const { node, sample } = result
  const nodeHeight = sample?.displayHeight ?? Math.max(2, 10 - node.depthMeters * 2.8)
  const position = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], nodeHeight)
  const sizeProperty = new Cesium.CallbackProperty((time?: Cesium.JulianDate) => {
    const safeTime = time || Cesium.JulianDate.now()
    const seconds = Cesium.JulianDate.secondsDifference(safeTime, Cesium.JulianDate.fromDate(new Date(0)))
    return 22 + (Math.sin(seconds * 3.2) + 1) * 8
  }, false)
  const colorProperty = new Cesium.CallbackProperty((time?: Cesium.JulianDate) => {
    const safeTime = time || Cesium.JulianDate.now()
    const seconds = Cesium.JulianDate.secondsDifference(safeTime, Cesium.JulianDate.fromDate(new Date(0)))
    const alpha = 0.16 + ((Math.sin(seconds * 3.2) + 1) / 2) * 0.22
    return Cesium.Color.fromCssColorString('#3b82f6').withAlpha(alpha)
  }, false)

  if (existing) {
    existing.position = new Cesium.ConstantPositionProperty(position)
    existing.point = new Cesium.PointGraphics({
      pixelSize: sizeProperty,
      color: colorProperty,
      outlineWidth: 0,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
    return
  }

  dataSource.entities.add({
    id: 'node-pulse',
    position,
    point: new Cesium.PointGraphics({
      pixelSize: sizeProperty,
      color: colorProperty,
      outlineWidth: 0,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }),
  })
}

function renderSceneNode(node: SceneNode) {
  if (!viewer) return
  const topPosition = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.displayHeight)
  const bottomPosition = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.groundHeight)
  const isActive = activeNodeId.value === node.id
  const color = getNodeColor(node.status)
  const glyph = nodeGlyphKind(node.nodeType)

  dataSource.entities.add({
    id: `node-column:${node.id}`,
    polyline: new Cesium.PolylineGraphics({
      positions: [bottomPosition, topPosition],
      width: isActive ? 4 : 2.5,
      material: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.82),
    }),
  })

  if (glyph === 'cylinder' || glyph === 'short-cylinder') {
    const baseHeight = glyph === 'cylinder' ? 2.4 : 1.4
    const radius = glyph === 'cylinder' ? 0.75 : 0.55
    const centerHeight = Math.max(node.displayHeight - baseHeight / 2, node.groundHeight + 0.6)
    const cylinderPosition = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], centerHeight)
    dataSource.entities.add({
      id: `node-solid:${node.id}`,
      position: cylinderPosition,
      cylinder: new Cesium.CylinderGraphics({
        length: baseHeight,
        topRadius: radius,
        bottomRadius: radius,
        material: color.withAlpha(0.88),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.68),
      }),
    })
  } else if (glyph === 'box') {
    dataSource.entities.add({
      id: `node-solid:${node.id}`,
      position: Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.displayHeight - 0.55),
      box: new Cesium.BoxGraphics({
        dimensions: new Cesium.Cartesian3(1.4, 1.4, 1.1),
        material: color.withAlpha(0.88),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.68),
      }),
    })
  } else if (glyph === 'ring') {
    dataSource.entities.add({
      id: `node-ring:${node.id}`,
      position: topPosition,
      ellipse: new Cesium.EllipseGraphics({
        semiMajorAxis: 0.95,
        semiMinorAxis: 0.95,
        height: node.displayHeight,
        material: Cesium.Color.TRANSPARENT,
        outline: true,
        outlineColor: color.withAlpha(0.95),
        outlineWidth: 2,
      }),
    })
  }

  dataSource.entities.add({
    id: `node-top:${node.id}`,
    position: topPosition,
    point: new Cesium.PointGraphics({
      pixelSize: isActive ? 18 : 14,
      color,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.96),
      outlineWidth: isActive ? 3 : 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }),
    label: new Cesium.LabelGraphics({
      text: node.name,
      font: isActive ? 'bold 13px sans-serif' : '12px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#0f172a'),
      showBackground: true,
      backgroundColor: Cesium.Color.WHITE.withAlpha(0.92),
      pixelOffset: new Cesium.Cartesian2(0, -22),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }),
  })

  if (node.hasWorkorder) {
    dataSource.entities.add({
      id: `node-alert:${node.id}`,
      position: Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.displayHeight + 0.9),
      point: new Cesium.PointGraphics({
        pixelSize: 7,
        color: Cesium.Color.fromCssColorString('#7c3aed'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1.5,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }),
    })
  }
}

function renderGroundReference(profile: Pipe25DPreviewData['pipeProfiles'][number], preview: Pipe25DPreviewData, index: number) {
  if (profile.length < 2) return
  const groundPositions = buildGroundPositions(profile)
  const bandWidth = Math.max(2.2, getPipeRadiusMeters(preview) * 7.5)
  const shellWidth = bandWidth * 2.2

  dataSource.entities.add({
    id: `pipe-ground-band:${preview.featureId}:${index}`,
    corridor: new Cesium.CorridorGraphics({
      positions: groundPositions,
      width: bandWidth,
      height: profile[0]?.groundHeight ?? 10,
      material: Cesium.Color.fromCssColorString('#cbd5e1').withAlpha(0.18),
      outline: false,
      cornerType: Cesium.CornerType.ROUNDED,
    }),
  })

  dataSource.entities.add({
    id: `pipe-ground-shell:${preview.featureId}:${index}`,
    corridor: new Cesium.CorridorGraphics({
      positions: groundPositions,
      width: shellWidth,
      height: profile[0]?.groundHeight ?? 10,
      extrudedHeight: Math.max((profile[0]?.groundHeight ?? 10) - 3.8, 4.6),
      material: Cesium.Color.fromCssColorString('#dbeafe').withAlpha(0.08),
      outline: false,
      cornerType: Cesium.CornerType.ROUNDED,
    }),
  })
}

async function renderPreview(preview: Pipe25DPreviewData | null) {
  if (!viewer) return

  renderVersion += 1
  dataSource.entities.removeAll()
  buildingModelEntities.clear()
  renderError.value = ''

  if (!preview || !preview.pipeProfiles.length) {
    viewer.scene.requestRender()
    return
  }

  const pipeColor = getPipeColor(preview.medium)
  const pipeRadius = getPipeRadiusMeters(preview)

  preview.pipeProfiles.forEach((profile, index) => {
    if (profile.length < 2) return
    const groundPositions = buildGroundPositions(profile)
    const pipePositions = buildPipePositions(profile)
    renderGroundReference(profile, preview, index)

    dataSource.entities.add({
      id: `pipe-guide:${preview.featureId}:${index}`,
      polyline: new Cesium.PolylineGraphics({
        positions: groundPositions,
        width: 3,
        material: Cesium.Color.fromCssColorString('#cbd5e1').withAlpha(0.95),
        clampToGround: false,
      }),
    })

    dataSource.entities.add({
      id: `pipe-body:${preview.featureId}:${index}`,
      polylineVolume: new Cesium.PolylineVolumeGraphics({
        positions: pipePositions,
        shape: buildPipeShape(pipeRadius),
        material: pipeColor.withAlpha(0.94),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
        cornerType: Cesium.CornerType.ROUNDED,
      }),
    })
  })

  sceneNodes.value.forEach(renderSceneNode)

  renderBuildings(preview.buildings)

  try {
    await renderBuildingModels(preview.buildings)
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : '建筑模型加载失败'
  }

  updateNodeVisualState()
  await focusCamera(preview, cameraMode.value)
  viewer.scene.requestRender()
}

async function focusCamera(preview: Pipe25DPreviewData, mode: 'angled' | 'top' = cameraMode.value) {
  if (!viewer) return

  const positions = [
    ...preview.pipeProfiles.flatMap(profile => buildGroundPositions(profile)),
    ...preview.pipeProfiles.flatMap(profile => buildPipePositions(profile)),
    ...preview.buildings.flatMap(building => (
      building.outline || []
    ).map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], building.heightMeters))),
  ]

  if (!positions.length) return

  const sphere = Cesium.BoundingSphere.fromPoints(positions)
  const radius = Math.max(sphere.radius, 18)
  const heading = mode === 'top' ? 0 : Cesium.Math.toRadians(-32)
  const pitch = mode === 'top' ? Cesium.Math.toRadians(-89) : Cesium.Math.toRadians(-28)
  const range = mode === 'top' ? radius * 2.35 + 24 : radius * 3.2 + 26
  await viewer.camera.flyToBoundingSphere(sphere, {
    duration: 0.6,
    offset: new Cesium.HeadingPitchRange(heading, pitch, range),
  })
  viewer.scene.requestRender()
}

function almostSamePoint(a: { point?: [number, number] } | [number, number], b: [number, number], epsilon = 1e-8) {
  const point = Array.isArray(a) ? a : a.point
  if (!point) return false
  return Math.abs(point[0] - b[0]) <= epsilon && Math.abs(point[1] - b[1]) <= epsilon
}

function squaredPointDistance(a: [number, number], b: [number, number]) {
  return ((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2)
}

function metersBetweenPoints(a: [number, number], b: [number, number]) {
  const meanLat = ((a[1] + b[1]) / 2) * Math.PI / 180
  const dx = (b[0] - a[0]) * 111320 * Math.cos(meanLat)
  const dy = (b[1] - a[1]) * 110540
  return Math.sqrt(dx * dx + dy * dy)
}

watch(
  () => props.preview?.featureId || '',
  () => {
    activeNodeId.value = sceneNodes.value[0]?.id || null
  },
  { immediate: true },
)

watch(activeNodeId, () => {
  if (!props.open || !viewerReady.value) return
  updateNodeVisualState()
  scrollActiveNodeIntoView()
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      destroyViewer()
      return
    }
    await nextTick()
    ensureViewer()
    await renderPreview(props.preview)
  },
  { immediate: true },
)

watch(
  () => props.preview,
  async (preview) => {
    if (!props.open || !viewer || !viewerReady.value) return
    await renderPreview(preview)
  },
  { deep: true },
)

async function switchCameraMode(mode: 'angled' | 'top') {
  cameraMode.value = mode
  if (!props.preview || !viewer) return
  await focusCamera(props.preview, mode)
}

async function resetView() {
  cameraMode.value = 'angled'
  if (!props.preview || !viewer) return
  await focusCamera(props.preview, 'angled')
}

onBeforeUnmount(() => {
  destroyViewer()
})
</script>

<template>
  <div v-if="open" class="preview-25d">
    <div class="preview-25d__mask" @click.self="emit('close')" />
    <section class="preview-25d__panel">
      <header class="preview-25d__header">
        <div>
          <div class="preview-25d__eyebrow">当前管线 2.5D 预览</div>
          <h3>{{ preview?.featureName || '未选择管线' }}</h3>
          <p>{{ mediumLabel }}<span v-if="preview?.area"> · {{ preview.area }}</span><span v-if="preview?.segment?.id"> · {{ preview.segment.id }}</span></p>
        </div>
        <button class="preview-25d__close" type="button" @click="emit('close')">关闭</button>
      </header>

      <div v-if="preview" class="preview-25d__body">
        <div class="preview-25d__canvas-card">
          <div class="preview-25d__viewer-toolbar">
            <button
              :class="['preview-25d__tool-btn', { 'preview-25d__tool-btn--active': cameraMode === 'angled' }]"
              type="button"
              @click="switchCameraMode('angled')"
            >
              斜视
            </button>
            <button
              :class="['preview-25d__tool-btn', { 'preview-25d__tool-btn--active': cameraMode === 'top' }]"
              type="button"
              @click="switchCameraMode('top')"
            >
              俯视
            </button>
            <button class="preview-25d__tool-btn" type="button" @click="resetView">
              重置视角
            </button>
          </div>
          <div ref="viewerContainerRef" class="preview-25d__viewer" />
          <div class="preview-25d__legend">
            <span><span class="dot dot--pipe" />真实管体</span>
            <span><span class="dot dot--building" />建筑体块</span>
            <span><span class="dot dot--ground" />地下参考层</span>
            <span><span class="dot dot--normal" />正常节点</span>
            <span><span class="dot dot--warning" />预警节点</span>
            <span><span class="dot dot--critical" />故障节点</span>
          </div>
        </div>

        <div class="preview-25d__side">
          <section class="preview-card">
            <div class="preview-card__title"><Layers3 :size="15" /> 预览摘要</div>
            <div class="preview-stat-grid">
              <div v-for="item in summaryStats" :key="item.label" class="preview-stat">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
            <div v-if="elevationRange" class="preview-meta">
              <span>节点高程</span>
              <strong>{{ elevationRange.min.toFixed(2) }}m ~ {{ elevationRange.max.toFixed(2) }}m</strong>
            </div>
            <div class="preview-meta" v-if="preview.segment?.diameterMm">
              <span>管径</span>
              <strong>{{ preview.segment.diameterMm.toFixed(0) }} mm</strong>
            </div>
            <div class="preview-meta" v-if="preview.segment?.material">
              <span>材质</span>
              <strong>{{ preview.segment.material }}</strong>
            </div>
            <div class="preview-meta">
              <span>建筑模型</span>
              <strong>{{ preview.buildings.some(item => item.modelConfig) ? '已载入可用模型' : '仅体块/轮廓' }}</strong>
            </div>
            <div v-if="renderError" class="preview-card__error">{{ renderError }}</div>
          </section>

          <section class="preview-card">
            <div class="preview-card__title"><MapPinned :size="15" /> 节点状态</div>
            <ul class="preview-node-list">
              <li
                v-for="node in sceneNodes"
                :key="node.id"
                :class="{ 'preview-node-list__item--active': activeNodeId === node.id }"
                :ref="(el) => setNodeListItemRef(node.id, el)"
                @click="setActiveNode(node.id, { focusCamera: true, scrollIntoView: true })"
              >
                <div class="preview-node-list__head">
                  <strong>{{ node.name }}</strong>
                  <span class="preview-node-list__status">{{ nodeStatusLabel(node.status) }}</span>
                </div>
                <div class="preview-node-list__meta">
                  {{ nodeTypeLabel(node.nodeType) }} · 埋深 {{ node.depthMeters.toFixed(2) }}m
                </div>
                <div v-if="node.sourceType === 'endpoint'" class="preview-node-list__meta preview-node-list__meta--soft">
                  管段端点
                </div>
                <div class="preview-node-list__metrics">
                  <span><Waves :size="13" /> 压力 {{ formatMetric(node.pressure, 'bar') }}</span>
                  <span><CheckCircle2 :size="13" /> 流量 {{ formatMetric(node.flowRate, 'm3/h') }}</span>
                  <span v-if="node.hasWorkorder"><AlertTriangle :size="13" /> 工单 {{ node.workorderCount }}</span>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="activeNode" class="preview-card">
            <div class="preview-card__title"><AlertTriangle :size="15" /> 节点详情</div>
            <div class="preview-meta">
              <span>当前节点</span>
              <strong>{{ activeNode.name }}</strong>
            </div>
            <div class="preview-meta">
              <span>节点类型</span>
              <strong>{{ nodeTypeLabel(activeNode.nodeType) }}</strong>
            </div>
            <div class="preview-meta">
              <span>状态</span>
              <strong>{{ nodeStatusLabel(activeNode.status) }}</strong>
            </div>
            <div class="preview-meta">
              <span>高程 / 埋深</span>
              <strong>Z {{ activeNode.elevation.toFixed(2) }}m · D {{ activeNode.depthMeters.toFixed(2) }}m</strong>
            </div>
            <div class="preview-meta">
              <span>压力 / 流量</span>
              <strong>{{ formatMetric(activeNode.pressure, 'bar') }} · {{ formatMetric(activeNode.flowRate, 'm3/h') }}</strong>
            </div>
            <div class="preview-meta">
              <span>工单情况</span>
              <strong>{{ activeNode.hasWorkorder ? `关联 ${activeNode.workorderCount} 条` : '暂无关联工单' }}</strong>
            </div>
          </section>

          <section v-if="crossSection" class="preview-card">
            <div class="preview-card__title"><Layers3 :size="15" /> 纵断面剖面</div>
            <div class="preview-profile__summary">
              <span>沿线长度 {{ formatDistanceMeters(crossSection.totalDistance) }}</span>
              <span>地表 vs 管底高差校核</span>
            </div>
            <svg
              :viewBox="`0 0 ${crossSection.width} ${crossSection.height}`"
              class="preview-profile"
              role="img"
              aria-label="管线纵断面剖面图"
            >
              <g v-for="line in crossSection.gridLines" :key="line.y">
                <line
                  x1="42"
                  :y1="line.y"
                  x2="538"
                  :y2="line.y"
                  stroke="#e2e8f0"
                  stroke-width="1"
                  stroke-dasharray="4 4"
                />
                <text x="6" :y="line.y + 4" class="preview-profile__axis">{{ line.value.toFixed(1) }}</text>
              </g>

              <polyline :points="crossSection.groundPolyline" class="preview-profile__ground" />
              <polyline :points="crossSection.pipePolyline" class="preview-profile__pipe" />

              <g v-if="crossSection.activeMarker">
                <line
                  :x1="crossSection.activeMarker.x"
                  y1="20"
                  :x2="crossSection.activeMarker.x"
                  y2="148"
                  class="preview-profile__focus"
                />
                <rect
                  :x="crossSection.activeMarker.x + 8"
                  :y="Math.max(22, crossSection.activeMarker.y - 32)"
                  width="76"
                  height="22"
                  rx="8"
                  class="preview-profile__focus-tag"
                />
                <text
                  :x="crossSection.activeMarker.x + 16"
                  :y="Math.max(37, crossSection.activeMarker.y - 17)"
                  class="preview-profile__focus-text"
                >
                  埋深 {{ crossSection.activeMarker.depthMeters.toFixed(2) }}m
                </text>
              </g>

              <g
                v-for="marker in crossSection.nodeMarkers"
                :key="marker.id"
                class="preview-profile__node-group"
                @click="setActiveNode(marker.id, { focusCamera: true, scrollIntoView: true })"
              >
                <line
                  :x1="marker.x"
                  :y1="marker.groundY"
                  :x2="marker.x"
                  :y2="marker.y"
                  class="preview-profile__drop"
                />
                <circle
                  :cx="marker.x"
                  :cy="marker.y"
                  :r="activeNodeId === marker.id ? 7 : 5"
                  :class="[
                    'preview-profile__node',
                    `preview-profile__node--${marker.status}`,
                    { 'preview-profile__node--active': activeNodeId === marker.id },
                  ]"
                />
                <text :x="marker.x + 6" :y="marker.y - 8" class="preview-profile__label">
                  {{ marker.name }}
                </text>
              </g>
            </svg>
          </section>
        </div>
      </div>

      <div v-else class="preview-25d__empty">
        当前管线暂无可用的 2.5D 预览数据。
      </div>
    </section>
  </div>
</template>

<style scoped>
.preview-25d {
  position: absolute;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-25d__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(1px);
}

.preview-25d__panel {
  position: relative;
  width: min(1320px, calc(100vw - 56px));
  height: min(820px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: linear-gradient(145deg, rgba(248, 250, 252, 0.98), rgba(255, 255, 255, 0.95));
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.preview-25d__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.preview-25d__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2563eb;
  text-transform: uppercase;
}

.preview-25d__header h3 {
  margin: 6px 0 4px;
  font-size: 24px;
  line-height: 1.2;
  color: #0f172a;
}

.preview-25d__header p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.preview-25d__close {
  flex: 0 0 auto;
  height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  color: #334155;
  cursor: pointer;
}

.preview-25d__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.95fr) minmax(320px, 0.9fr);
  gap: 18px;
  padding: 20px 24px 24px;
  overflow: hidden;
}

.preview-25d__canvas-card {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(203, 213, 225, 0.7);
  background:
    radial-gradient(circle at top left, rgba(191, 219, 254, 0.26), transparent 44%),
    linear-gradient(180deg, #ffffff, #f8fafc);
  overflow: hidden;
}

.preview-25d__viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 0;
}

.preview-25d__tool-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(191, 219, 254, 0.95);
  background: rgba(255, 255, 255, 0.96);
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.preview-25d__tool-btn--active {
  border-color: #60a5fa;
  background: #eff6ff;
  color: #1d4ed8;
}

.preview-25d__viewer {
  flex: 1;
  min-height: 520px;
}

.preview-25d__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(203, 213, 225, 0.55);
  color: #475569;
  font-size: 12px;
}

.dot {
  width: 10px;
  height: 10px;
  display: inline-block;
  border-radius: 999px;
  margin-right: 6px;
}

.dot--pipe { background: linear-gradient(90deg, #2563eb, #22d3ee); }
.dot--building { background: #94a3b8; }
.dot--ground { background: #cbd5e1; }
.dot--normal { background: #14b8a6; }
.dot--warning { background: #f59e0b; }
.dot--critical { background: #ef4444; }

.preview-25d__side {
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-right: 4px;
}

.preview-card {
  flex: 0 0 auto;
  border-radius: 18px;
  border: 1px solid rgba(203, 213, 225, 0.72);
  background: rgba(255, 255, 255, 0.9);
  padding: 16px;
}

.preview-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.preview-card__error {
  margin-top: 12px;
  border-radius: 12px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  padding: 10px 12px;
}

.preview-profile__summary {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: #64748b;
  font-size: 12px;
}

.preview-profile {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.preview-profile__axis {
  fill: #94a3b8;
  font-size: 11px;
}

.preview-profile__ground {
  fill: none;
  stroke: #94a3b8;
  stroke-width: 3;
}

.preview-profile__pipe {
  fill: none;
  stroke: #2563eb;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.preview-profile__focus {
  stroke: #60a5fa;
  stroke-width: 2;
  stroke-dasharray: 5 4;
}

.preview-profile__focus-tag {
  fill: rgba(219, 234, 254, 0.96);
  stroke: rgba(96, 165, 250, 0.9);
  stroke-width: 1;
}

.preview-profile__focus-text {
  fill: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
}

.preview-profile__drop {
  stroke: #cbd5e1;
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}

.preview-profile__node-group {
  cursor: pointer;
}

.preview-profile__node {
  stroke: #ffffff;
  stroke-width: 2;
}

.preview-profile__node--normal {
  fill: #14b8a6;
}

.preview-profile__node--warning {
  fill: #f59e0b;
}

.preview-profile__node--critical {
  fill: #ef4444;
}

.preview-profile__node--active {
  filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.35));
}

.preview-profile__label {
  fill: #334155;
  font-size: 11px;
  font-weight: 700;
}

.preview-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.preview-stat {
  border-radius: 14px;
  background: #f8fafc;
  padding: 12px;
}

.preview-stat span,
.preview-meta span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.preview-stat strong,
.preview-meta strong {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.preview-meta + .preview-meta {
  margin-top: 10px;
}

.preview-node-list {
  max-height: min(42vh, 420px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.preview-node-list li {
  border-radius: 14px;
  background: #f8fafc;
  padding: 12px;
  cursor: pointer;
  border: 1px solid transparent;
}

.preview-node-list__item--active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.preview-node-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.preview-node-list__head strong {
  color: #0f172a;
  font-size: 13px;
}

.preview-node-list__status {
  color: #475569;
  font-size: 11px;
  font-weight: 700;
}

.preview-node-list__meta {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.preview-node-list__meta--soft {
  color: #94a3b8;
}

.preview-node-list__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  color: #334155;
  font-size: 12px;
}

.preview-node-list__metrics span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.preview-25d__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 1180px) {
  .preview-25d__panel {
    width: min(96vw, 1320px);
    height: min(92vh, 820px);
    max-height: 92vh;
  }

  .preview-25d__body {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .preview-25d__side {
    overflow: visible;
    padding-right: 0;
  }

  .preview-25d__viewer {
    min-height: 400px;
  }
}
</style>
