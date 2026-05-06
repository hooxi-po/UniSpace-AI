<script setup lang="ts">
import * as Cesium from 'cesium'
import { AlertTriangle, Building2, CheckCircle2, Clock3, Factory, Layers3, MapPinned, Waves } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type {
  BuildingPreview,
  DefectPreview,
  NodePreview,
  Pipe25DPreviewData,
  PreviewTimelineEvent,
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
const floorCanvasRef = ref<HTMLDivElement | null>(null)
const activeNodeId = ref<string | null>(null)
const activeFloorBuildingId = ref<string | null>(null)
const activeFloorNo = ref<number | null>(null)
const activeTab = ref<'assets' | 'building' | 'defects' | 'timeline'>('assets')
const floorModelOpen = ref(false)
const activeFloorRoomId = ref<string | null>(null)
const activeFloorDeviceId = ref<string | null>(null)
const viewerReady = ref(false)
const renderError = ref('')
const cameraMode = ref<'angled' | 'top'>('angled')
const nodeListItemRefs = new Map<string, HTMLElement>()

let viewer: Cesium.Viewer | null = null
let nodePickHandler: Cesium.ScreenSpaceEventHandler | null = null
let renderVersion = 0
const dataSource = new Cesium.CustomDataSource('pipe25d-preview')
const buildingModelEntities = new Map<string, Cesium.Entity>()
let floorCanvasDrag = {
  active: false,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
}

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

const PIPE_GROUND_FALLBACK = 10
const PIPE_DISPLAY_FALLBACK = 6

const previewTabs = [
  { key: 'assets', label: '资产', icon: Layers3 },
  { key: 'building', label: '建筑', icon: Building2 },
  { key: 'defects', label: '病害', icon: AlertTriangle },
  { key: 'timeline', label: '时间轴', icon: Clock3 },
] as const

const summaryStats = computed(() => {
  if (!props.preview) return []
  const critical = sceneNodes.value.filter(node => node.status === 'critical').length
  const warning = sceneNodes.value.filter(node => node.status === 'warning').length
  return [
    { label: '节点', value: String(sceneNodes.value.length) },
    { label: '检查井', value: String(props.preview.manholes.length) },
    { label: '泵站', value: String(props.preview.pumpStations.length) },
    { label: '病害事件', value: String(props.preview.defects.length) },
    { label: '关联建筑', value: String(props.preview.buildings.length) },
    { label: '风险节点', value: String(critical + warning) },
  ]
})

const mediumLabel = computed(() => {
  const medium = String(props.preview?.medium || '').toLowerCase()
  if (medium === 'water') return '供水'
  if (medium === 'drainage' || medium === 'drain') return '排水'
  if (medium === 'sewage') return '污水'
  return props.preview?.medium || '未知'
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

const activeNode = computed(() => {
  if (!sceneNodes.value.length) return null
  if (activeNodeId.value) {
    return sceneNodes.value.find(node => node.id === activeNodeId.value) || sceneNodes.value[0]
  }
  return sceneNodes.value[0]
})

const activeBuildingStack = computed(() => {
  const stacks = props.preview?.buildingStacks || []
  if (!stacks.length) return null
  if (activeFloorBuildingId.value) {
    return stacks.find(item => item.buildingId === activeFloorBuildingId.value) || stacks[0]
  }
  return stacks[0]
})

const activeFloorRooms = computed(() => {
  const stack = activeBuildingStack.value
  if (!stack) return []
  const targetFloorNo = activeFloorNo.value ?? stack.floors[0]?.floorNo ?? null
  if (targetFloorNo == null) return stack.rooms
  return stack.rooms.filter(room => room.floorNo === targetFloorNo)
})

const activeFloorRoom = computed(() => {
  if (!activeFloorRoomId.value) return null
  return activeFloorRooms.value.find(room => room.id === activeFloorRoomId.value) || null
})

const activeFloorDevice = computed(() => {
  if (!activeFloorDeviceId.value) return null
  for (const room of activeFloorRooms.value) {
    const device = room.devices.find(item => item.id === activeFloorDeviceId.value)
    if (device) return { ...device, room }
  }
  return null
})

const floorPlanRooms = computed(() => {
  const rooms = activeFloorRooms.value
  if (!rooms.length) return []
  const cols = Math.max(2, Math.ceil(Math.sqrt(rooms.length)))
  const shellPadding = 8
  const gap = 2
  const innerWidth = 100 - shellPadding * 2
  const innerHeight = 100 - shellPadding * 2
  const cellWidth = (innerWidth - gap * (cols - 1)) / cols
  const rows = Math.ceil(rooms.length / cols)
  const cellHeight = (innerHeight - gap * Math.max(rows - 1, 0)) / Math.max(rows, 1)

  return rooms.map((room, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = shellPadding + col * (cellWidth + gap)
    const y = shellPadding + row * (cellHeight + gap)
    const width = Math.max(16, room.roomType === 'lab' ? cellWidth * 1.06 : room.roomType === 'office' ? cellWidth * 0.94 : cellWidth)
    const height = Math.max(14, room.roomType === 'classroom' ? cellHeight * 1.04 : room.roomType === 'dorm' ? cellHeight * 0.9 : cellHeight)
    return {
      ...room,
      x,
      y,
      width,
      height,
    }
  })
})

const floorModelStats = computed(() => {
  const rooms = activeFloorRooms.value
  const deviceCount = rooms.reduce((sum, room) => sum + room.devices.length, 0)
  return {
    roomCount: rooms.length,
    deviceCount,
  }
})

const activeFloorLabel = computed(() => {
  const stack = activeBuildingStack.value
  if (!stack || activeFloorNo.value == null) return ''
  const floor = stack.floors.find(item => item.floorNo === activeFloorNo.value)
  if (!floor) return `F${activeFloorNo.value}`
  return floor.floorName || `F${floor.floorNo}`
})

const defectsByLevel = computed(() => {
  const defects = props.preview?.defects || []
  return {
    critical: defects.filter(item => item.level === 'critical'),
    warning: defects.filter(item => item.level === 'warning'),
  }
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
    }
  })

  const defectMarkers = (props.preview?.defects || []).map(defect => {
    let best = samplesWithDistance[0]
    let bestDistance = Number.POSITIVE_INFINITY
    for (const sample of samplesWithDistance) {
      const distance = squaredPointDistance(sample.point, defect.point)
      if (distance < bestDistance) {
        bestDistance = distance
        best = sample
      }
    }
    return {
      id: defect.id,
      title: defect.title,
      level: defect.level,
      x: Number(toX(best.distance).toFixed(2)),
      y: Number(toY(best.displayHeight).toFixed(2)),
    }
  })

  return {
    width,
    height,
    totalDistance: Number(totalDistance.toFixed(1)),
    groundPolyline,
    pipePolyline,
    nodeMarkers,
    defectMarkers,
  }
})

function nodeTypeLabel(type: string) {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'valve') return '阀门'
  if (normalized === 'manhole') return '检查井'
  if (normalized === 'pump') return '泵站'
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

function formatTime(value: string) {
  if (!value) return '--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatRoomStatus(status: string) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'occupied') return '占用'
  if (normalized === 'empty') return '空置'
  if (normalized === 'warning') return '预警'
  if (normalized === 'critical') return '高危'
  return status || '正常'
}

function roomStatusClass(status: string) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'occupied') return 'room-card--occupied'
  if (normalized === 'warning') return 'room-card--warning'
  if (normalized === 'critical') return 'room-card--critical'
  return 'room-card--normal'
}

function deviceStatusClass(status: string) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'critical' || normalized === 'failed') return 'device-card--critical'
  if (normalized === 'warning') return 'device-card--warning'
  if (normalized === 'offline' || normalized === 'unknown') return 'device-card--offline'
  return 'device-card--normal'
}

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

function getDefectColor(level: DefectPreview['level']) {
  return level === 'critical'
    ? Cesium.Color.fromCssColorString('#ef4444')
    : Cesium.Color.fromCssColorString('#f59e0b')
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
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
  if (viewer.scene.sun) viewer.scene.sun.show = false
  if (viewer.scene.moon) viewer.scene.moon.show = false
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
    if (rawId.startsWith('node-top:') || rawId.startsWith('node-column:')) {
      const nodeId = rawId.split(':')[1] || ''
      if (nodeId) setActiveNode(nodeId, { focusCamera: true, scrollIntoView: true })
      return
    }
    if (rawId.startsWith('defect:')) {
      const defectId = rawId.replace('defect:', '')
      const matched = props.preview?.defects.find(item => item.id === defectId)
      if (matched?.nodeId) setActiveNode(matched.nodeId, { focusCamera: true, scrollIntoView: true })
      return
    }
    if (rawId.startsWith('building-floor:')) {
      const [, buildingId, floorNoRaw] = rawId.split(':')
      const floorNo = Number.parseInt(floorNoRaw || '', 10)
      if (buildingId && Number.isFinite(floorNo)) {
        selectFloor(buildingId, floorNo)
      }
    }
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
  if (viewer && !viewer.isDestroyed()) viewer.destroy()
  viewer = null
}

function buildPipePositions(profile: Pipe25DPreviewData['pipeProfiles'][number]) {
  return profile.map(item => Cesium.Cartesian3.fromDegrees(item.point[0], item.point[1], item.displayHeight))
}

function buildGroundPositions(profile: Pipe25DPreviewData['pipeProfiles'][number]) {
  return profile.map(item => Cesium.Cartesian3.fromDegrees(item.point[0], item.point[1], item.groundHeight))
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

function renderBuildings(buildings: BuildingPreview[]) {
  if (!viewer) return
  for (const building of buildings) {
    if (!building.outline || building.outline.length < 3) continue
    const hasFloorSlices = Boolean(
      props.preview?.buildingStacks.find(item => item.buildingId === building.id)?.floors.length,
    )
    const isCurrentBuilding = activeFloorBuildingId.value === building.id
    const outlinePositions = building.outline.map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0))
    dataSource.entities.add({
      id: `building-outline:${building.id}`,
      polyline: new Cesium.PolylineGraphics({
        positions: [...outlinePositions, outlinePositions[0]],
        width: isCurrentBuilding ? 3 : 1.6,
        material: isCurrentBuilding
          ? Cesium.Color.fromCssColorString('#facc15').withAlpha(0.92)
          : Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.42),
        clampToGround: false,
      }),
    })
    if (hasFloorSlices) continue
    dataSource.entities.add({
      id: `building-shell:${building.id}`,
      polygon: new Cesium.PolygonGraphics({
        hierarchy: new Cesium.PolygonHierarchy(outlinePositions),
        height: 0,
        extrudedHeight: building.heightMeters,
        material: isCurrentBuilding
          ? Cesium.Color.fromCssColorString('#fde68a').withAlpha(0.08)
          : Cesium.Color.fromCssColorString('#dbeafe').withAlpha(0.04),
        outline: true,
        outlineColor: isCurrentBuilding
          ? Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.65)
          : Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.3),
        perPositionHeight: false,
      }),
    })
  }
}

function renderBuildingFloors() {
  const preview = props.preview
  if (!viewer || !preview) return
  const floorHeightScale = 1.7

  for (const stack of preview.buildingStacks) {
    const building = preview.buildings.find(item => item.id === stack.buildingId)
    if (!building?.outline || building.outline.length < 3 || !stack.floors.length) continue

    const hierarchy = new Cesium.PolygonHierarchy(
      building.outline.map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], 0)),
    )
    const logicalFloorHeight = Math.max(building.heightMeters / Math.max(stack.floors.length, 1), 3)
    const floorHeight = Math.max(logicalFloorHeight * floorHeightScale, 5.2)
    const floorGap = Math.min(0.82, Math.max(0.3, floorHeight * 0.1))
    const selectedBuilding = activeFloorBuildingId.value === stack.buildingId
      ? stack.buildingId
      : null
    const outlineCenter = computeOutlineCenter(building.outline)

    for (const floor of stack.floors) {
      const floorIndex = Math.max(floor.floorNo - 1, 0)
      const rawBottom = floorIndex * floorHeight
      const rawTop = (floorIndex + 1) * floorHeight
      const isActive = selectedBuilding === stack.buildingId && activeFloorNo.value === floor.floorNo
      const activeLift = isActive ? Math.min(0.9, floorHeight * 0.08) : 0
      const height = Number((rawBottom + floorGap * 0.28 + activeLift).toFixed(2))
      const extrudedHeight = Number((Math.max(rawTop - floorGap * 0.72 + activeLift, height + 1.8)).toFixed(2))
      const isSelectedBuilding = selectedBuilding === stack.buildingId
      const fillColor = isActive
        ? Cesium.Color.fromCssColorString('#facc15').withAlpha(0.82)
        : isSelectedBuilding
          ? Cesium.Color.fromCssColorString('#e2e8f0').withAlpha(0.12)
          : floorIndex % 2 === 0
            ? Cesium.Color.fromCssColorString('#dbeafe').withAlpha(0.08)
            : Cesium.Color.fromCssColorString('#bfdbfe').withAlpha(0.05)
      const outlineColor = isActive
        ? Cesium.Color.fromCssColorString('#eab308').withAlpha(0.98)
        : isSelectedBuilding
          ? Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.28)
          : Cesium.Color.fromCssColorString('#64748b').withAlpha(0.16)

      dataSource.entities.add({
        id: `building-floor:${stack.buildingId}:${floor.floorNo}`,
        polygon: new Cesium.PolygonGraphics({
          hierarchy,
          height,
          extrudedHeight,
          material: fillColor,
          outline: true,
          outlineColor,
          perPositionHeight: false,
        }),
      })

      dataSource.entities.add({
        id: `building-floor-cap:${stack.buildingId}:${floor.floorNo}`,
        polyline: new Cesium.PolylineGraphics({
          positions: [
            ...building.outline.map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], extrudedHeight)),
            Cesium.Cartesian3.fromDegrees(building.outline[0][0], building.outline[0][1], extrudedHeight),
          ],
          width: isActive ? 3 : 1.6,
          material: outlineColor,
          clampToGround: false,
        }),
      })

      if (isActive) {
        dataSource.entities.add({
          id: `building-floor-highlight:${stack.buildingId}:${floor.floorNo}`,
          polygon: new Cesium.PolygonGraphics({
            hierarchy,
            height: Number((extrudedHeight - 0.1).toFixed(2)),
            extrudedHeight: Number((extrudedHeight + 0.55).toFixed(2)),
            material: Cesium.Color.fromCssColorString('#fde047').withAlpha(0.38),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#fef08a').withAlpha(1),
            perPositionHeight: false,
          }),
        })
      }

      if (isActive || (floor.floorNo === stack.floors[0]?.floorNo && !selectedBuilding)) {
        dataSource.entities.add({
          id: `building-floor-label:${stack.buildingId}:${floor.floorNo}`,
          position: Cesium.Cartesian3.fromDegrees(outlineCenter.lon, outlineCenter.lat, extrudedHeight + 1.2),
          label: new Cesium.LabelGraphics({
            text: `${stack.buildingName} ${floor.floorName || `F${floor.floorNo}`}`,
            font: isActive ? 'bold 13px sans-serif' : '12px sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#0f172a'),
            showBackground: true,
            backgroundColor: isActive
              ? Cesium.Color.fromCssColorString('#fef3c7').withAlpha(0.96)
              : Cesium.Color.WHITE.withAlpha(0.82),
            pixelOffset: new Cesium.Cartesian2(0, -6),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }),
        })
      }
    }
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

function renderSceneNode(node: SceneNode) {
  const topPosition = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.displayHeight)
  const bottomPosition = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.groundHeight)
  const isActive = activeNodeId.value === node.id
  const color = getNodeColor(node.status)

  dataSource.entities.add({
    id: `node-column:${node.id}`,
    polyline: new Cesium.PolylineGraphics({
      positions: [bottomPosition, topPosition],
      width: isActive ? 4 : 2.5,
      material: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.82),
    }),
  })

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

function renderManholes() {
  const preview = props.preview
  if (!preview) return
  for (const manhole of preview.manholes) {
    const sample = findNearestProfileSample(preview.pipeProfiles, manhole.point)
    const groundHeight = sample?.groundHeight ?? PIPE_GROUND_FALLBACK
    const displayHeight = sample?.displayHeight ?? PIPE_DISPLAY_FALLBACK
    const centerHeight = (groundHeight + displayHeight) / 2
    dataSource.entities.add({
      id: `manhole:${manhole.id}`,
      position: Cesium.Cartesian3.fromDegrees(manhole.point[0], manhole.point[1], centerHeight),
      cylinder: new Cesium.CylinderGraphics({
        length: Math.max(groundHeight - displayHeight, 2.8),
        topRadius: 0.75,
        bottomRadius: 0.95,
        material: getNodeColor(manhole.status).withAlpha(0.62),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.7),
      }),
    })
  }
}

function renderPumpStations() {
  const preview = props.preview
  if (!preview) return
  for (const station of preview.pumpStations) {
    const sample = findNearestProfileSample(preview.pipeProfiles, station.point)
    const groundHeight = sample?.groundHeight ?? PIPE_GROUND_FALLBACK
    dataSource.entities.add({
      id: `pump:${station.id}`,
      position: Cesium.Cartesian3.fromDegrees(station.point[0], station.point[1], groundHeight + 1.6),
      box: new Cesium.BoxGraphics({
        dimensions: new Cesium.Cartesian3(3.2, 2.2, 3),
        material: getNodeColor(station.status).withAlpha(0.88),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.7),
      }),
      label: new Cesium.LabelGraphics({
        text: station.name,
        font: 'bold 12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#0f172a'),
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.9),
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }),
    })
  }
}

function renderDefects() {
  const preview = props.preview
  if (!preview) return
  for (const defect of preview.defects) {
    const sample = findNearestProfileSample(preview.pipeProfiles, defect.point)
    const displayHeight = sample?.displayHeight ?? PIPE_DISPLAY_FALLBACK
    dataSource.entities.add({
      id: `defect:${defect.id}`,
      position: Cesium.Cartesian3.fromDegrees(defect.point[0], defect.point[1], displayHeight + 1.2),
      billboard: new Cesium.BillboardGraphics({
        image: buildDefectCanvas(defect.level),
        scale: 1,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }),
    })
  }
}

function buildDefectCanvas(level: DefectPreview['level']) {
  const canvas = document.createElement('canvas')
  canvas.width = 36
  canvas.height = 36
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = level === 'critical' ? '#ef4444' : '#f59e0b'
  ctx.beginPath()
  ctx.moveTo(18, 4)
  ctx.lineTo(32, 30)
  ctx.lineTo(4, 30)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('!', 18, 24)
  return canvas
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
  renderManholes()
  renderPumpStations()
  renderDefects()
  renderBuildings(preview.buildings)
  renderBuildingFloors()

  try {
    await renderBuildingModels(
      preview.buildings.filter(building => {
        const stack = preview.buildingStacks.find(item => item.buildingId === building.id)
        return !stack || !stack.floors.length
      }),
    )
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : '建筑模型加载失败'
  }

  await focusCamera(preview, cameraMode.value)
  viewer.scene.requestRender()
}

async function focusCamera(preview: Pipe25DPreviewData, mode: 'angled' | 'top' = cameraMode.value) {
  if (!viewer) return
  const positions = [
    ...preview.pipeProfiles.flatMap(profile => buildGroundPositions(profile)),
    ...preview.pipeProfiles.flatMap(profile => buildPipePositions(profile)),
    ...preview.buildings.flatMap(building => (building.outline || []).map(point => Cesium.Cartesian3.fromDegrees(point[0], point[1], building.heightMeters))),
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
}

async function focusNode(nodeId: string) {
  if (!viewer || !props.preview) return
  const node = sceneNodes.value.find(item => item.id === nodeId)
  if (!node) return
  const bottom = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.groundHeight)
  const top = Cesium.Cartesian3.fromDegrees(node.point[0], node.point[1], node.displayHeight)
  const sphere = Cesium.BoundingSphere.fromPoints([bottom, top])
  const pitch = cameraMode.value === 'top' ? Cesium.Math.toRadians(-89) : Cesium.Math.toRadians(-34)
  const heading = cameraMode.value === 'top' ? 0 : Cesium.Math.toRadians(-28)
  const range = cameraMode.value === 'top' ? 22 : 28
  await viewer.camera.flyToBoundingSphere(sphere, {
    duration: 0.45,
    offset: new Cesium.HeadingPitchRange(heading, pitch, range),
  })
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
    nodeListItemRefs.get(nodeId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function setActiveNode(nodeId: string, options?: { focusCamera?: boolean; scrollIntoView?: boolean }) {
  activeNodeId.value = nodeId
  if (options?.scrollIntoView) scrollActiveNodeIntoView()
  if (options?.focusCamera) void focusNode(nodeId)
}

function selectFloor(buildingId: string, floorNo: number) {
  activeTab.value = 'building'
  activeFloorBuildingId.value = buildingId
  activeFloorNo.value = floorNo
  activeFloorRoomId.value = null
  activeFloorDeviceId.value = null
}

function focusTimelineEvent(event: PreviewTimelineEvent) {
  activeTab.value = 'timeline'
  if (event.nodeId) {
    setActiveNode(event.nodeId, { focusCamera: true, scrollIntoView: true })
  }
}

function openDefect(defect: DefectPreview) {
  activeTab.value = 'defects'
  setActiveNode(defect.nodeId, { focusCamera: true, scrollIntoView: true })
}

function openFloorModel() {
  if (!activeBuildingStack.value || activeFloorNo.value == null) return
  floorModelOpen.value = true
  nextTick(() => {
    if (!floorCanvasRef.value) return
    floorCanvasRef.value.scrollLeft = 0
    floorCanvasRef.value.scrollTop = 0
  })
}

function selectFloorRoom(roomId: string) {
  activeFloorRoomId.value = roomId
  activeFloorDeviceId.value = null
}

function selectFloorDevice(deviceId: string, roomId: string) {
  activeFloorRoomId.value = roomId
  activeFloorDeviceId.value = deviceId
}

function onFloorCanvasPointerDown(event: PointerEvent) {
  if (!floorCanvasRef.value) return
  floorCanvasDrag = {
    active: true,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: floorCanvasRef.value.scrollLeft,
    scrollTop: floorCanvasRef.value.scrollTop,
  }
  floorCanvasRef.value.setPointerCapture?.(event.pointerId)
}

function onFloorCanvasPointerMove(event: PointerEvent) {
  if (!floorCanvasDrag.active || !floorCanvasRef.value) return
  const deltaX = event.clientX - floorCanvasDrag.startX
  const deltaY = event.clientY - floorCanvasDrag.startY
  floorCanvasRef.value.scrollLeft = floorCanvasDrag.scrollLeft - deltaX
  floorCanvasRef.value.scrollTop = floorCanvasDrag.scrollTop - deltaY
}

function onFloorCanvasPointerUp(event: PointerEvent) {
  if (!floorCanvasRef.value) return
  floorCanvasDrag.active = false
  floorCanvasRef.value.releasePointerCapture?.(event.pointerId)
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
    activeFloorBuildingId.value = props.preview?.buildingStacks[0]?.buildingId || null
    activeFloorNo.value = props.preview?.buildingStacks[0]?.floors[0]?.floorNo ?? null
    activeTab.value = 'assets'
  },
  { immediate: true },
)

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

watch(
  [activeFloorBuildingId, activeFloorNo],
  async () => {
    if (!props.open || !viewer || !viewerReady.value) return
    await renderPreview(props.preview)
  },
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
          <div class="preview-25d__eyebrow">当前管线 2.5D 工作台</div>
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
            <button
              class="preview-25d__tool-btn preview-25d__tool-btn--accent"
              type="button"
              :disabled="!activeBuildingStack || activeFloorNo == null"
              @click="openFloorModel"
            >
              当前层模型
            </button>
          </div>
          <div ref="viewerContainerRef" class="preview-25d__viewer" />
          <div class="preview-25d__legend">
            <span><span class="dot dot--pipe" />真实管体</span>
            <span><span class="dot dot--building" />建筑体块</span>
            <span><span class="dot dot--ground" />地下参考层</span>
            <span><span class="dot dot--manhole" />检查井</span>
            <span><span class="dot dot--pump" />泵站</span>
            <span><span class="dot dot--defect" />病害事件</span>
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

          <section class="preview-tabs">
            <button
              v-for="tab in previewTabs"
              :key="tab.key"
              :class="['preview-tab', { 'preview-tab--active': activeTab === tab.key }]"
              type="button"
              @click="activeTab = tab.key"
            >
              <component :is="tab.icon" :size="15" />
              <span>{{ tab.label }}</span>
            </button>
          </section>

          <section v-if="activeTab === 'assets'" class="preview-card">
            <div class="preview-card__title"><MapPinned :size="15" /> 资产联动</div>
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
                <div class="preview-node-list__metrics">
                  <span><Waves :size="13" /> 压力 {{ formatMetric(node.pressure, 'bar') }}</span>
                  <span><CheckCircle2 :size="13" /> 流量 {{ formatMetric(node.flowRate, 'm3/h') }}</span>
                  <span v-if="node.hasWorkorder"><AlertTriangle :size="13" /> 工单 {{ node.workorderCount }}</span>
                </div>
              </li>
            </ul>
            <div class="asset-strip">
              <div v-for="manhole in preview.manholes" :key="manhole.id" class="asset-chip">
                <span class="asset-chip__tag">井</span>
                <div>
                  <strong>{{ manhole.name }}</strong>
                  <p>{{ manhole.coverStatus }} · {{ manhole.gasRiskLevel }}</p>
                </div>
              </div>
              <div v-for="pump in preview.pumpStations" :key="pump.id" class="asset-chip asset-chip--pump">
                <span class="asset-chip__tag">站</span>
                <div>
                  <strong>{{ pump.name }}</strong>
                  <p>{{ pump.stationType }} · {{ formatMetric(pump.designFlowM3h, 'm3/h') }}</p>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'building'" class="preview-card">
            <div class="preview-card__title"><Building2 :size="15" /> 楼层与房间</div>
            <template v-if="activeBuildingStack">
              <div class="preview-meta">
                <span>当前建筑</span>
                <strong>{{ activeBuildingStack.buildingName }}</strong>
              </div>
              <div class="preview-meta">
                <span>当前楼层</span>
                <strong>{{ activeFloorLabel || '未选择楼层' }}</strong>
              </div>
              <div class="preview-building-hint">
                主视图中可直接点击分层建筑选择楼层。
              </div>
              <div class="floor-pills">
                <button
                  v-for="floor in activeBuildingStack.floors"
                  :key="floor.id"
                  :class="['floor-pill', { 'floor-pill--active': activeFloorNo === floor.floorNo }]"
                  type="button"
                  @click="selectFloor(activeBuildingStack.buildingId, floor.floorNo)"
                >
                  {{ floor.floorName }}
                </button>
              </div>
              <div class="room-grid">
                <div
                  v-for="room in activeFloorRooms"
                  :key="room.id"
                  :class="['room-card', roomStatusClass(room.status)]"
                >
                  <strong>{{ room.roomNo }}</strong>
                  <span>{{ room.roomName || room.roomType || '未命名房间' }}</span>
                  <small>{{ formatRoomStatus(room.status) }}<template v-if="room.areaM2"> · {{ room.areaM2.toFixed(0) }}m2</template></small>
                </div>
              </div>
            </template>
            <div v-else class="preview-empty-inline">暂无楼层/房间数据</div>
          </section>

          <section v-else-if="activeTab === 'defects'" class="preview-card">
            <div class="preview-card__title"><AlertTriangle :size="15" /> 病害叠加</div>
            <div class="preview-meta">
              <span>严重病害</span>
              <strong>{{ defectsByLevel.critical.length }} 条</strong>
            </div>
            <div class="preview-meta">
              <span>预警病害</span>
              <strong>{{ defectsByLevel.warning.length }} 条</strong>
            </div>
            <div class="timeline-list">
              <button
                v-for="defect in preview.defects"
                :key="defect.id"
                :class="['timeline-item', `timeline-item--${defect.level}`]"
                type="button"
                @click="openDefect(defect)"
              >
                <div class="timeline-item__head">
                  <strong>{{ defect.title }}</strong>
                  <span>{{ formatTime(defect.timestamp) }}</span>
                </div>
                <p>{{ defect.description }}</p>
              </button>
            </div>
          </section>

          <section v-else class="preview-card">
            <div class="preview-card__title"><Clock3 :size="15" /> 时间轴</div>
            <div class="timeline-list">
              <button
                v-for="event in preview.timeline"
                :key="event.id"
                :class="['timeline-item', `timeline-item--${event.level}`]"
                type="button"
                @click="focusTimelineEvent(event)"
              >
                <div class="timeline-item__head">
                  <strong>{{ event.title }}</strong>
                  <span>{{ formatTime(event.timestamp) }}</span>
                </div>
                <p>{{ event.description }}</p>
              </button>
            </div>
          </section>

          <section v-if="activeNode" class="preview-card">
            <div class="preview-card__title"><Factory :size="15" /> 节点详情</div>
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
          </section>

          <section v-if="crossSection" class="preview-card">
            <div class="preview-card__title"><Layers3 :size="15" /> 纵断面剖面</div>
            <div class="preview-profile__summary">
              <span>沿线长度 {{ formatDistanceMeters(crossSection.totalDistance) }}</span>
              <span>病害点位叠加</span>
            </div>
            <svg
              :viewBox="`0 0 ${crossSection.width} ${crossSection.height}`"
              class="preview-profile"
              role="img"
              aria-label="管线纵断面剖面图"
            >
              <polyline :points="crossSection.groundPolyline" class="preview-profile__ground" />
              <polyline :points="crossSection.pipePolyline" class="preview-profile__pipe" />

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
              </g>

              <g v-for="defect in crossSection.defectMarkers" :key="defect.id">
                <polygon
                  :points="`${defect.x},${defect.y - 9} ${defect.x + 8},${defect.y + 6} ${defect.x - 8},${defect.y + 6}`"
                  :class="['preview-profile__defect', `preview-profile__defect--${defect.level}`]"
                />
              </g>
            </svg>
          </section>
        </div>
      </div>

      <div v-else class="preview-25d__empty">
        当前管线暂无可用的 2.5D 预览数据。
      </div>
    </section>

    <div v-if="floorModelOpen && activeBuildingStack && activeFloorNo != null" class="floor-model">
      <div class="floor-model__mask" @click="floorModelOpen = false" />
      <section class="floor-model__panel">
        <header class="floor-model__header">
          <div>
            <div class="floor-model__eyebrow">当前层模型</div>
            <h3>{{ activeBuildingStack.buildingName }} · {{ activeFloorLabel }}</h3>
            <p>{{ floorModelStats.roomCount }} 个房间 · {{ floorModelStats.deviceCount }} 个设备</p>
          </div>
          <button class="floor-model__close" type="button" @click="floorModelOpen = false">关闭</button>
        </header>

        <div class="floor-model__body">
          <div
            ref="floorCanvasRef"
            class="floor-model__canvas"
            @pointerdown="onFloorCanvasPointerDown"
            @pointermove="onFloorCanvasPointerMove"
            @pointerup="onFloorCanvasPointerUp"
            @pointercancel="onFloorCanvasPointerUp"
            @pointerleave="onFloorCanvasPointerUp"
          >
            <div class="floor-model__blueprint">
              <div class="floor-model__shell">
                <div class="floor-model__shell-title">
                  {{ activeBuildingStack.buildingName }} {{ activeFloorLabel }}
                </div>
              </div>
              <button
                v-for="room in floorPlanRooms"
                :key="room.id"
                :class="[
                  'floor-room',
                  roomStatusClass(room.status),
                  { 'floor-room--active': activeFloorRoomId === room.id },
                ]"
                :style="{
                  left: `${room.x}%`,
                  top: `${room.y}%`,
                  width: `${room.width}%`,
                  height: `${room.height}%`,
                }"
                type="button"
                @click="selectFloorRoom(room.id)"
              >
                <div class="floor-room__head">
                  <strong>{{ room.roomNo }}</strong>
                  <span>{{ room.roomName || room.roomType || '未命名房间' }}</span>
                </div>
                <div class="floor-room__devices">
                  <button
                    v-for="device in room.devices"
                    :key="device.id"
                    :class="[
                      'floor-device',
                      deviceStatusClass(device.status),
                      { 'floor-device--active': activeFloorDeviceId === device.id },
                    ]"
                    type="button"
                    @click.stop="selectFloorDevice(device.id, room.id)"
                  >
                    <span class="floor-device__dot" />
                    <div>
                      <strong>{{ device.name }}</strong>
                      <small>{{ device.deviceType }}</small>
                    </div>
                  </button>
                </div>
              </button>

              <div class="floor-model__overlay">
                <div class="floor-model__overlay-chip">
                  {{ floorModelStats.roomCount }} 个房间
                </div>
                <div class="floor-model__overlay-chip">
                  {{ floorModelStats.deviceCount }} 个设备
                </div>
                <div v-if="activeFloorRoom" class="floor-model__overlay-chip floor-model__overlay-chip--active">
                  房间 {{ activeFloorRoom.roomNo }}
                </div>
                <div v-if="activeFloorDevice" class="floor-model__overlay-chip floor-model__overlay-chip--active">
                  设备 {{ activeFloorDevice.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
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
  width: min(1380px, calc(100vw - 40px));
  height: min(860px, calc(100vh - 32px));
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
  grid-template-columns: minmax(0, 1.9fr) minmax(340px, 0.95fr);
  gap: 18px;
  padding: 18px;
}

.preview-25d__canvas-card,
.preview-card {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.06);
}

.preview-25d__canvas-card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-25d__viewer-toolbar {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
}

.preview-25d__tool-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.preview-25d__tool-btn[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.preview-25d__tool-btn--active {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(219, 234, 254, 0.9);
  color: #1d4ed8;
}

.preview-25d__tool-btn--accent {
  border-color: rgba(234, 179, 8, 0.32);
  background: rgba(254, 249, 195, 0.9);
  color: #854d0e;
}

.preview-25d__viewer {
  flex: 1;
  min-height: 420px;
}

.preview-25d__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px 16px;
  font-size: 12px;
  color: #475569;
}

.preview-25d__legend span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.dot--pipe { background: #2563eb; }
.dot--building { background: #94a3b8; }
.dot--ground { background: #cbd5e1; }
.dot--manhole { background: #0f766e; }
.dot--pump { background: #64748b; }
.dot--defect { background: #ef4444; }

.preview-25d__side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding-right: 4px;
}

.preview-card {
  padding: 16px;
}

.preview-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 700;
  color: #0f172a;
}

.preview-card__error {
  margin-top: 10px;
  color: #dc2626;
  font-size: 12px;
}

.preview-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.preview-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  cursor: pointer;
}

.preview-tab--active {
  border-color: rgba(37, 99, 235, 0.32);
  background: rgba(219, 234, 254, 0.95);
  color: #1d4ed8;
}

.preview-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.preview-stat {
  padding: 10px 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.preview-stat span,
.preview-meta span,
.timeline-item p,
.asset-chip p,
.room-card span,
.room-card small {
  color: #64748b;
  font-size: 12px;
}

.preview-stat strong,
.preview-meta strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 15px;
}

.preview-meta + .preview-meta {
  margin-top: 10px;
}

.preview-building-hint {
  margin: 12px 0 14px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.7);
  color: #1e40af;
  font-size: 12px;
}

.preview-node-list {
  display: grid;
  gap: 10px;
  max-height: 280px;
  overflow: auto;
  padding: 0;
  margin: 0;
  list-style: none;
}

.preview-node-list li {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.86);
  background: #fff;
  cursor: pointer;
}

.preview-node-list__item--active {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(239, 246, 255, 0.94);
}

.preview-node-list__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.preview-node-list__head strong {
  color: #0f172a;
}

.preview-node-list__status {
  color: #2563eb;
  font-size: 12px;
}

.preview-node-list__meta {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}

.preview-node-list__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.preview-node-list__metrics span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #334155;
}

.asset-strip {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.asset-chip {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.95), rgba(240, 249, 255, 0.95));
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.asset-chip--pump {
  background: linear-gradient(135deg, rgba(241, 245, 249, 0.95), rgba(224, 242, 254, 0.95));
}

.asset-chip__tag {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.1);
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.asset-chip strong,
.room-card strong,
.timeline-item strong {
  color: #0f172a;
}

.floor-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.floor-pill {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.floor-pill--active {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(219, 234, 254, 0.95);
  color: #1d4ed8;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.room-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.room-card--normal { background: #fff; }
.room-card--occupied { background: rgba(239, 246, 255, 0.9); }
.room-card--warning { background: rgba(255, 247, 237, 0.95); }
.room-card--critical { background: rgba(254, 242, 242, 0.95); }

.timeline-list {
  display: grid;
  gap: 10px;
  max-height: 280px;
  overflow: auto;
}

.timeline-item {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.86);
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.timeline-item--warning {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(255, 251, 235, 0.95);
}

.timeline-item--critical {
  border-color: rgba(239, 68, 68, 0.22);
  background: rgba(254, 242, 242, 0.95);
}

.timeline-item__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
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
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
}

.preview-profile__ground {
  fill: none;
  stroke: #94a3b8;
  stroke-width: 2.4;
}

.preview-profile__pipe {
  fill: none;
  stroke: #2563eb;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.preview-profile__drop {
  stroke: #cbd5e1;
  stroke-width: 1.5;
}

.preview-profile__node {
  fill: #14b8a6;
  stroke: #fff;
  stroke-width: 2;
}

.preview-profile__node--warning { fill: #f59e0b; }
.preview-profile__node--critical { fill: #ef4444; }

.preview-profile__defect {
  stroke: #fff;
  stroke-width: 1.5;
}

.preview-profile__defect--warning { fill: #f59e0b; }
.preview-profile__defect--critical { fill: #ef4444; }

.preview-25d__empty,
.preview-empty-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  border-radius: 18px;
  color: #64748b;
  background: rgba(248, 250, 252, 0.9);
}

.floor-model {
  position: absolute;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floor-model__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(2px);
}

.floor-model__panel {
  position: relative;
  width: min(1180px, calc(100vw - 56px));
  height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 251, 235, 0.98), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(234, 179, 8, 0.2);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.floor-model__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px 16px;
  border-bottom: 1px solid rgba(234, 179, 8, 0.16);
}

.floor-model__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ca8a04;
  text-transform: uppercase;
}

.floor-model__header h3 {
  margin: 6px 0 4px;
  font-size: 22px;
  color: #0f172a;
}

.floor-model__header p {
  margin: 0;
  color: #78716c;
  font-size: 13px;
}

.floor-model__close {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(234, 179, 8, 0.24);
  background: rgba(255, 255, 255, 0.92);
  color: #854d0e;
  cursor: pointer;
}

.floor-model__body {
  flex: 1;
  min-height: 0;
  display: block;
  padding: 18px;
}

.floor-model__canvas {
  position: relative;
  overflow: auto;
  padding-right: 4px;
  min-width: 0;
  cursor: grab;
  user-select: none;
}

.floor-model__blueprint {
  position: relative;
  width: max(100%, 920px);
  max-width: none;
  aspect-ratio: 16 / 10;
  min-height: 0;
  border-radius: 24px;
  background:
    linear-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px),
    linear-gradient(160deg, rgba(255,255,255,0.95), rgba(248,250,252,0.96));
  background-size: 24px 24px, 24px 24px, auto;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
}

.floor-model__overlay {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: min(60%, 420px);
  pointer-events: none;
}

.floor-model__overlay-chip {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(226, 232, 240, 0.92);
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.floor-model__overlay-chip--active {
  border-color: rgba(234, 179, 8, 0.42);
  background: rgba(254, 249, 195, 0.96);
  color: #92400e;
}

.floor-model__shell {
  position: absolute;
  inset: 3.2%;
  border-radius: 26px;
  border: 3px solid rgba(234, 179, 8, 0.68);
  background: linear-gradient(180deg, rgba(254, 249, 195, 0.18), rgba(255,255,255,0.02));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
  pointer-events: none;
}

.floor-model__shell-title {
  position: absolute;
  top: 12px;
  left: 16px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 251, 235, 0.95);
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
}

.floor-room {
  position: absolute;
  padding: 10px;
  border-radius: 18px;
  border: 2px solid rgba(148, 163, 184, 0.32);
  background: rgba(255, 255, 255, 0.94);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 18px rgba(15, 23, 42, 0.06);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.floor-room--active {
  border-color: rgba(234, 179, 8, 0.9);
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.18), inset 0 1px 0 rgba(255,255,255,0.8);
}

.floor-room__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.floor-room__head strong {
  color: #0f172a;
  font-size: clamp(11px, 1vw, 15px);
}

.floor-room__head span {
  color: #64748b;
  font-size: clamp(10px, 0.86vw, 12px);
}

.floor-room__devices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  flex: 1;
  align-content: start;
  overflow: hidden auto;
  padding-right: 2px;
}

.floor-device {
  display: flex;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 6px 7px;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.85);
  text-align: left;
  cursor: pointer;
  align-items: flex-start;
}

.floor-device__dot {
  width: 10px;
  height: 10px;
  margin-top: 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #facc15, #eab308);
  flex: 0 0 auto;
}

.floor-device strong {
  display: block;
  color: #0f172a;
  font-size: clamp(9px, 0.74vw, 12px);
}

.floor-device small {
  color: #64748b;
  font-size: clamp(8px, 0.68vw, 11px);
}

.device-card--normal { background: rgba(248, 250, 252, 0.92); }
.device-card--warning { background: rgba(255, 247, 237, 0.95); }
.device-card--critical { background: rgba(254, 242, 242, 0.95); }
.device-card--offline { background: rgba(241, 245, 249, 0.95); }

.floor-device--active {
  border-color: rgba(234, 179, 8, 0.85);
  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.22);
}

@media (max-width: 1100px) {
  .preview-25d__body {
    grid-template-columns: 1fr;
  }

  .preview-25d__viewer {
    min-height: 360px;
  }

  .floor-model__body {
    display: block;
  }
}

@media (max-width: 720px) {
  .preview-25d__panel {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
  }

  .preview-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .preview-stat-grid,
  .room-grid {
    grid-template-columns: 1fr;
  }

  .floor-model__canvas {
    overflow: auto;
  }

  .floor-model__blueprint {
    width: 760px;
  }
}
</style>
