import { computed, type ComputedRef } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import type { TwinDrilldown, TwinTelemetryPoint } from '~/services/twin'
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import { geometryToLines, isSamePoint, type Line, type Lines, type Point } from '~/utils/pipe2d-geometry'

export type BuildingPreviewModelConfig = {
  url: string
  scaleMode: 'auto' | 'fixed'
  scale: number
  heading: number
  pitch: number
  roll: number
  position: { lon: number; lat: number } | null
}

export type BuildingPreview = {
  id: string
  name: string
  outline: Line | null
  heightMeters: number
  modelConfig: BuildingPreviewModelConfig | null
}

export type BuildingFloorPreview = {
  id: string
  floorNo: number
  floorName: string
  usageType: string
  roomCount: number
}

export type RoomPreview = {
  id: string
  floorId: string
  floorNo: number | null
  roomNo: string
  roomName: string
  roomType: string
  status: string
  areaM2: number | null
  devices: RoomDevicePreview[]
}

export type RoomDevicePreview = {
  id: string
  name: string
  deviceType: string
  status: string
}

export type BuildingStackPreview = {
  buildingId: string
  buildingName: string
  heightMeters: number
  floors: BuildingFloorPreview[]
  rooms: RoomPreview[]
}

export type ManholePreview = {
  id: string
  nodeId: string
  name: string
  point: Point
  status: 'normal' | 'warning' | 'critical'
  coverStatus: string
  gasRiskLevel: string
  depthMeters: number
}

export type PumpStationPreview = {
  id: string
  nodeId: string
  name: string
  point: Point
  status: 'normal' | 'warning' | 'critical'
  stationType: string
  designFlowM3h: number | null
  designHeadM: number | null
  powerKw: number | null
}

export type DefectPreview = {
  id: string
  title: string
  description: string
  level: 'warning' | 'critical'
  source: 'workorder' | 'telemetry'
  nodeId: string
  point: Point
  timestamp: string
}

export type PreviewTimelineEvent = {
  id: string
  kind: 'defect' | 'workorder' | 'telemetry'
  level: 'normal' | 'warning' | 'critical'
  title: string
  description: string
  timestamp: string
  nodeId: string
  point: Point | null
}

export type NodePreview = {
  id: string
  name: string
  nodeType: string
  sourceType: 'business' | 'endpoint'
  status: 'normal' | 'warning' | 'critical'
  point: Point
  elevation: number
  depthMeters: number
  pressure: number | null
  flowRate: number | null
  hasWorkorder: boolean
  workorderCount: number
}

export type PipeProfilePoint = {
  point: Point
  elevation: number
  depthMeters: number
  groundHeight: number
  displayHeight: number
}

export type SegmentPreview = {
  id: string
  diameterMm: number | null
  material: string
  status: string
}

export type Pipe25DPreviewData = {
  featureId: string
  featureName: string
  medium: string
  area: string
  lines: Lines
  pipeProfiles: PipeProfilePoint[][]
  segment: SegmentPreview | null
  nodes: NodePreview[]
  buildings: BuildingPreview[]
  buildingStacks: BuildingStackPreview[]
  manholes: ManholePreview[]
  pumpStations: PumpStationPreview[]
  defects: DefectPreview[]
  timeline: PreviewTimelineEvent[]
}

type UseSelectedPipe25DPreviewOptions = {
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  drilldown: ComputedRef<TwinDrilldown | null> | { value: TwinDrilldown | null }
  buildings: ComputedRef<GeoJsonFeature[]> | { value: GeoJsonFeature[] }
  telemetryList: ComputedRef<TwinTelemetryPoint[]> | { value: TwinTelemetryPoint[] }
  relatedWorkorders: ComputedRef<PipelineWorkOrder[]> | { value: PipelineWorkOrder[] }
}

const DEFAULT_SEGMENT_DEPTH = 1.2
const PIPE_GROUND_REFERENCE_HEIGHT = 10
const PIPE_DEPTH_VISUAL_SCALE = 2.8
const PIPE_ELEVATION_VISUAL_SCALE = 0.45
const MIN_PIPE_DISPLAY_HEIGHT = 1.2

export function useSelectedPipe25DPreview(options: UseSelectedPipe25DPreviewOptions) {
  const preview = computed<Pipe25DPreviewData | null>(() => {
    const feature = options.selectedFeature.value
    if (!feature) return null

    const lines = geometryToLines(feature.geometry)
    if (!lines.length) return null

    const properties = feature.properties || {}
    const segmentRaw = objectValue(options.drilldown.value?.segment)
    const linkedBuildingsRaw = arrayValue(options.drilldown.value?.linkedBuildings)
    const nodesRaw = arrayValue(options.drilldown.value?.nodes)
    const manholesRaw = arrayValue(options.drilldown.value?.manholes)
    const pumpStationsRaw = arrayValue(options.drilldown.value?.pumpStations)
    const buildingFloorsRaw = arrayValue(options.drilldown.value?.buildingFloors)
    const impactedRoomsRaw = arrayValue(options.drilldown.value?.impactedRooms)
    const equipmentItemsRaw = arrayValue(options.drilldown.value?.equipments)
    const telemetry = options.telemetryList.value || []
    const relatedWorkorders = options.relatedWorkorders.value || []

    const medium = firstFilledText(
      properties.pipelineMedium,
      properties.pipeLayer,
      properties.pipeType,
      properties.medium,
      segmentRaw?.properties?.pipelineMedium,
      'water',
    )
    const area = firstFilledText(properties.area, properties.zone, properties.campus, properties.region, '')
    const featureName = firstFilledText(properties.name, properties.ref, feature.id)
    const segmentDepth = resolveSegmentDepth(properties, segmentRaw?.properties)

    const nodeWorkorderCounts = buildNodeWorkorderCountMap(relatedWorkorders)
    const mergedLinePoints = mergeLines(lines)
    const segmentNodeHints = buildSegmentNodeHints(segmentRaw, mergedLinePoints)
    const businessNodes = dedupeNodes(
      nodesRaw
        .map((item, index) => buildNodePreview(item, mergedLinePoints, telemetry, nodeWorkorderCounts, segmentDepth, index, segmentNodeHints))
        .filter((item): item is NodePreview => Boolean(item)),
    )
    const nodes = ensureEndpointNodes(
      businessNodes,
      mergedLinePoints,
      segmentRaw,
      telemetry,
      nodeWorkorderCounts,
      segmentDepth,
      String(feature.id),
      featureName,
    )
    const pipeProfiles = lines.map(line => buildPipeProfile(line, nodes, segmentDepth))

    const buildings = linkedBuildingsRaw
      .map(item => buildBuildingPreview(item, options.buildings.value))
      .filter((item): item is BuildingPreview => Boolean(item))
    const buildingStacks = buildBuildingStacks(buildings, buildingFloorsRaw, impactedRoomsRaw, equipmentItemsRaw)
    const manholes = manholesRaw
      .map(item => buildManholePreview(item, nodes, mergedLinePoints, segmentDepth))
      .filter((item): item is ManholePreview => Boolean(item))
    const pumpStations = pumpStationsRaw
      .map(item => buildPumpStationPreview(item, nodes, mergedLinePoints))
      .filter((item): item is PumpStationPreview => Boolean(item))
    const defects = buildDefectPreviews(relatedWorkorders, telemetry, nodes)
    const timeline = buildTimeline(defects, relatedWorkorders, telemetry, nodes)

    return {
      featureId: String(feature.id),
      featureName,
      medium,
      area,
      lines,
      pipeProfiles,
      segment: segmentRaw ? {
        id: firstFilledText(segmentRaw.id, ''),
        diameterMm: resolveNumber(segmentRaw.diameterMm, segmentRaw.properties?.diameter_mm, segmentRaw.properties?.diameter),
        material: firstFilledText(segmentRaw.material, segmentRaw.properties?.material, ''),
        status: firstFilledText(segmentRaw.status, segmentRaw.properties?.status, 'normal'),
      } : null,
      nodes,
      buildings,
      buildingStacks,
      manholes,
      pumpStations,
      defects,
      timeline,
    }
  })

  return {
    selectedPipe25DPreview: preview,
  }
}

function buildNodeWorkorderCountMap(workorders: PipelineWorkOrder[]) {
  const counts = new Map<string, number>()
  for (const workorder of workorders) {
    for (const nodeId of workorder.nodeIds || []) {
      const key = String(nodeId || '').trim()
      if (!key) continue
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  return counts
}

function buildNodePreview(
  raw: unknown,
  line: Line,
  telemetry: TwinTelemetryPoint[],
  workorderCountMap: Map<string, number>,
  defaultDepth: number,
  index: number,
  segmentNodeHints: Map<string, Point>,
): NodePreview | null {
  const node = objectValue(raw)
  if (!node) return null

  const id = firstFilledText(node.id, '')
  if (!id) return null

  const props = objectValue(node.properties) || {}
  const point = resolveNodePoint(id, props, line, index, segmentNodeHints)
  if (!point) return null

  const elevation = resolveNumber(props.elevation, props.z, props.altitude) ?? computeFallbackElevation(defaultDepth, index)
  const depthMeters = resolveNumber(props.depth_m, props.depth, props.buried_depth) ?? defaultDepth
  const pressure = pickTelemetryMetric(telemetry, id, 'pressure')
  const flowRate = pickTelemetryMetric(telemetry, id, 'flow')
    ?? pickTelemetryMetric(telemetry, id, 'flowRate')

  const statusRaw = firstFilledText(node.status, props.status, 'normal').toLowerCase()
  const status: 'normal' | 'warning' | 'critical' = statusRaw === 'critical'
    ? 'critical'
    : statusRaw === 'warning'
      ? 'warning'
      : 'normal'

  const workorderCount = workorderCountMap.get(id) || 0

  return {
    id,
    name: firstFilledText(node.name, props.name, id),
    nodeType: firstFilledText(node.nodeType, props.nodeType, props.type, 'junction'),
    sourceType: 'business',
    status,
    point,
    elevation,
    depthMeters,
    pressure,
    flowRate,
    hasWorkorder: workorderCount > 0,
    workorderCount,
  }
}

function buildBuildingPreview(raw: unknown, buildingFeatures: GeoJsonFeature[]) {
  const item = objectValue(raw)
  if (!item) return null
  const id = firstFilledText(item.id, item.buildingId, '')
  if (!id) return null
  const feature = buildingFeatures.find(candidate => String(candidate.id) === id)
  const properties = objectValue(feature?.properties) || {}
  return {
    id,
    name: firstFilledText(item.name, item.buildingName, id),
    outline: feature ? extractPrimaryPolygonRing(feature) : null,
    heightMeters: resolveBuildingHeightMeters(properties),
    modelConfig: readBuildingModelConfig(properties),
  }
}

function buildSegmentNodeHints(segment: Record<string, any> | null, line: Line) {
  const hints = new Map<string, Point>()
  if (!segment || line.length < 2) return hints

  const fromId = firstFilledText(segment.fromNodeId, '')
  const toId = firstFilledText(segment.toNodeId, '')
  if (fromId) hints.set(fromId, line[0])
  if (toId) hints.set(toId, line[line.length - 1])
  return hints
}

function dedupeNodes(nodes: NodePreview[]) {
  const byId = new Map<string, NodePreview>()
  for (const node of nodes) {
    const existing = byId.get(node.id)
    if (!existing) {
      byId.set(node.id, node)
      continue
    }
    const nextScore = node.hasWorkorder ? 2 : 0 + (node.status !== 'normal' ? 1 : 0)
    const prevScore = existing.hasWorkorder ? 2 : 0 + (existing.status !== 'normal' ? 1 : 0)
    if (nextScore >= prevScore) {
      byId.set(node.id, node)
    }
  }
  return [...byId.values()]
}

function buildBuildingStacks(
  buildings: BuildingPreview[],
  floorItems: unknown[],
  roomItems: unknown[],
  equipmentItems: unknown[],
) {
  const equipmentCatalog = buildEquipmentCatalog(equipmentItems)
  const floorsByBuilding = new Map<string, BuildingFloorPreview[]>()
  for (const item of floorItems) {
    const floor = objectValue(item)
    if (!floor) continue
    const buildingId = firstFilledText(floor.buildingId, '')
    if (!buildingId) continue
    const list = floorsByBuilding.get(buildingId) || []
    list.push({
      id: firstFilledText(floor.id, ''),
      floorNo: Math.round(resolveNumber(floor.floorNo) ?? 0),
      floorName: firstFilledText(floor.floorName, `F${Math.round(resolveNumber(floor.floorNo) ?? 0)}`),
      usageType: firstFilledText(floor.usageType, ''),
      roomCount: Math.round(resolveNumber(floor.roomCount) ?? 0),
    })
    floorsByBuilding.set(buildingId, list)
  }

  const roomsByBuilding = new Map<string, RoomPreview[]>()
  for (const item of roomItems) {
    const room = objectValue(item)
    if (!room) continue
    const buildingId = firstFilledText(room.buildingId, '')
    if (!buildingId) continue
    const list = roomsByBuilding.get(buildingId) || []
    const roomNo = firstFilledText(room.roomNo, '')
    const roomType = firstFilledText(room.roomType, '')
    list.push({
      id: firstFilledText(room.id, ''),
      floorId: firstFilledText(room.floorId, ''),
      floorNo: resolveNumber(room.floorNo) == null ? null : Math.round(resolveNumber(room.floorNo) as number),
      roomNo,
      roomName: firstFilledText(room.roomName, ''),
      roomType,
      status: firstFilledText(room.status, 'normal'),
      areaM2: resolveNumber(room.areaM2),
      devices: buildRoomDevices(buildingId, roomNo, roomType, equipmentCatalog),
    })
    roomsByBuilding.set(buildingId, list)
  }

  return buildings.map(building => ({
    buildingId: building.id,
    buildingName: building.name,
    heightMeters: building.heightMeters,
    floors: [...(floorsByBuilding.get(building.id) || [])].sort((a, b) => a.floorNo - b.floorNo),
    rooms: [...(roomsByBuilding.get(building.id) || [])].sort((a, b) => {
      const floorDiff = (a.floorNo ?? 0) - (b.floorNo ?? 0)
      if (floorDiff !== 0) return floorDiff
      return a.roomNo.localeCompare(b.roomNo)
    }),
  }))
}

function buildEquipmentCatalog(items: unknown[]) {
  return items
    .map(item => objectValue(item))
    .filter((item): item is Record<string, any> => Boolean(item))
    .map(item => ({
      id: firstFilledText(item.id, ''),
      name: firstFilledText(item.name, item.id, 'device'),
      deviceType: firstFilledText(item.equipmentType, item.stationType, 'device'),
      status: firstFilledText(item.status, 'unknown'),
      buildingId: firstFilledText(item.buildingId, ''),
      nodeId: firstFilledText(item.nodeId, ''),
      featureId: firstFilledText(item.featureId, ''),
    }))
    .filter(item => item.id)
}

function buildRoomDevices(
  buildingId: string,
  roomNo: string,
  roomType: string,
  equipmentCatalog: Array<{
    id: string
    name: string
    deviceType: string
    status: string
    buildingId: string
    nodeId: string
    featureId: string
  }>,
) {
  const presets = defaultRoomDevices(roomType, roomNo)
  const buildingDevices = equipmentCatalog
    .filter(item => !item.buildingId || item.buildingId === buildingId)
    .slice(0, 2)
    .map(item => ({
      id: `${roomNo || 'room'}:${item.id}`,
      name: item.name,
      deviceType: item.deviceType,
      status: item.status,
    }))

  const merged = [...presets, ...buildingDevices]
  const byId = new Map<string, RoomDevicePreview>()
  for (const device of merged) {
    if (!byId.has(device.id)) byId.set(device.id, device)
  }
  return [...byId.values()].slice(0, 4)
}

function defaultRoomDevices(roomType: string, roomNo: string) {
  const normalized = String(roomType || '').trim().toLowerCase()
  const prefix = roomNo || 'room'
  if (normalized === 'lab') {
    return [
      { id: `${prefix}:env-sensor`, name: '环境传感器', deviceType: 'sensor', status: 'normal' },
      { id: `${prefix}:exhaust`, name: '排风控制器', deviceType: 'controller', status: 'normal' },
    ]
  }
  if (normalized === 'office') {
    return [
      { id: `${prefix}:ac`, name: '空调终端', deviceType: 'hvac', status: 'normal' },
      { id: `${prefix}:access`, name: '门禁终端', deviceType: 'access', status: 'normal' },
    ]
  }
  if (normalized === 'classroom') {
    return [
      { id: `${prefix}:projector`, name: '投影设备', deviceType: 'av', status: 'normal' },
      { id: `${prefix}:ac`, name: '空调终端', deviceType: 'hvac', status: 'normal' },
    ]
  }
  if (normalized === 'dorm') {
    return [
      { id: `${prefix}:water-meter`, name: '末端水表', deviceType: 'meter', status: 'normal' },
      { id: `${prefix}:smoke`, name: '烟感终端', deviceType: 'safety', status: 'normal' },
    ]
  }
  return [
    { id: `${prefix}:sensor`, name: '室内传感器', deviceType: 'sensor', status: 'normal' },
    { id: `${prefix}:terminal`, name: '末端设备', deviceType: 'terminal', status: 'normal' },
  ]
}

function buildManholePreview(
  raw: unknown,
  nodes: NodePreview[],
  line: Line,
  defaultDepth: number,
) {
  const item = objectValue(raw)
  if (!item) return null
  const id = firstFilledText(item.id, '')
  if (!id) return null
  const nodeId = firstFilledText(item.nodeId, '')
  const matchedNode = nodes.find(node => node.id === nodeId)
  const nodeProps = objectValue(item.nodeProperties) || {}
  const properties = objectValue(item.properties) || {}
  const point = matchedNode?.point
    || resolveNodePoint(id, { ...nodeProps, ...properties }, line, 0, new Map())
  if (!point) return null

  const gasRiskLevel = firstFilledText(item.gasRiskLevel, properties.gasRiskLevel, 'normal').toLowerCase()
  const coverStatus = firstFilledText(item.coverStatus, properties.coverStatus, 'closed')
  const status: 'normal' | 'warning' | 'critical' = gasRiskLevel === 'critical'
    ? 'critical'
    : gasRiskLevel === 'warning'
      ? 'warning'
      : 'normal'

  return {
    id,
    nodeId,
    name: firstFilledText(item.name, properties.name, `检查井 ${id}`),
    point,
    status,
    coverStatus,
    gasRiskLevel,
    depthMeters: matchedNode?.depthMeters ?? defaultDepth,
  }
}

function buildPumpStationPreview(
  raw: unknown,
  nodes: NodePreview[],
  line: Line,
) {
  const item = objectValue(raw)
  if (!item) return null
  const id = firstFilledText(item.id, '')
  if (!id) return null
  const nodeId = firstFilledText(item.nodeId, '')
  const properties = objectValue(item.properties) || {}
  const matchedNode = nodes.find(node => node.id === nodeId)
  const point = matchedNode?.point
    || resolveNodePoint(id, properties, line, 0, new Map())
  if (!point) return null

  const statusRaw = firstFilledText(item.status, properties.status, 'normal').toLowerCase()
  const status: 'normal' | 'warning' | 'critical' = statusRaw === 'critical'
    ? 'critical'
    : statusRaw === 'warning'
      ? 'warning'
      : 'normal'

  return {
    id,
    nodeId,
    name: firstFilledText(item.name, properties.name, id),
    point,
    status,
    stationType: firstFilledText(item.stationType, properties.stationType, 'booster'),
    designFlowM3h: resolveNumber(item.designFlowM3h, properties.designFlowM3h),
    designHeadM: resolveNumber(item.designHeadM, properties.designHeadM),
    powerKw: resolveNumber(item.powerKw, properties.powerKw),
  }
}

function buildDefectPreviews(
  workorders: PipelineWorkOrder[],
  telemetry: TwinTelemetryPoint[],
  nodes: NodePreview[],
) {
  const defects: DefectPreview[] = []

  for (const workorder of workorders) {
    const isDefectWorkorder = workorder.type === 'maintenance'
      || workorder.priority === 'high'
      || workorder.priority === 'urgent'
      || workorder.source === 'anomaly_alert'
      || workorder.source === 'telemetry_alert'
    if (!isDefectWorkorder) continue
    const nodeId = firstFilledText(workorder.nodeIds[0], '')
    const node = nodes.find(item => item.id === nodeId) || nodes.find(item => workorder.nodeIds.includes(item.id))
    if (!node) continue
    defects.push({
      id: `workorder:${workorder.id}`,
      title: workorder.title || workorder.id,
      description: workorder.description || '关联维修/异常工单',
      level: workorder.priority === 'urgent' || workorder.priority === 'high' ? 'critical' : 'warning',
      source: 'workorder',
      nodeId: node.id,
      point: node.point,
      timestamp: workorder.updatedAt || workorder.createdAt || '',
    })
  }

  for (const item of telemetry) {
    const quality = String(item.quality || '').toLowerCase()
    if (quality === 'good' || quality === 'normal') continue
    const node = nodes.find(candidate => {
      const pointId = String(item.pointId || '').toLowerCase()
      const featureId = String(item.featureId || '').toLowerCase()
      const id = candidate.id.toLowerCase()
      return pointId.includes(id) || featureId.includes(id)
    })
    if (!node) continue
    defects.push({
      id: `telemetry:${item.pointId}:${item.sampledAt}`,
      title: `${item.metric} 异常`,
      description: `${item.pointId} ${item.value} ${item.unit}`.trim(),
      level: quality === 'critical' ? 'critical' : 'warning',
      source: 'telemetry',
      nodeId: node.id,
      point: node.point,
      timestamp: item.sampledAt,
    })
  }

  return defects
    .sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp))
    .slice(0, 16)
}

function buildTimeline(
  defects: DefectPreview[],
  workorders: PipelineWorkOrder[],
  telemetry: TwinTelemetryPoint[],
  nodes: NodePreview[],
) {
  const events: PreviewTimelineEvent[] = defects.map(item => ({
    id: item.id,
    kind: 'defect',
    level: item.level,
    title: item.title,
    description: item.description,
    timestamp: item.timestamp,
    nodeId: item.nodeId,
    point: item.point,
  }))

  for (const workorder of workorders) {
    const nodeId = firstFilledText(workorder.nodeIds[0], '')
    const node = nodes.find(item => item.id === nodeId) || null
    events.push({
      id: `timeline:workorder:${workorder.id}`,
      kind: 'workorder',
      level: workorder.priority === 'urgent' ? 'critical' : workorder.priority === 'high' ? 'warning' : 'normal',
      title: workorder.title || workorder.id,
      description: `${workorder.type} · ${workorder.status}`,
      timestamp: workorder.updatedAt || workorder.createdAt || '',
      nodeId,
      point: node?.point || null,
    })
  }

  for (const item of telemetry) {
    const quality = String(item.quality || '').toLowerCase()
    if (quality === 'good' || quality === 'normal') continue
    const node = nodes.find(candidate => {
      const pointId = String(item.pointId || '').toLowerCase()
      const featureId = String(item.featureId || '').toLowerCase()
      const id = candidate.id.toLowerCase()
      return pointId.includes(id) || featureId.includes(id)
    }) || null
    events.push({
      id: `timeline:telemetry:${item.pointId}:${item.sampledAt}`,
      kind: 'telemetry',
      level: quality === 'critical' ? 'critical' : 'warning',
      title: `${item.metric} 测点异常`,
      description: `${item.pointId} ${item.value} ${item.unit}`.trim(),
      timestamp: item.sampledAt,
      nodeId: node?.id || '',
      point: node?.point || null,
    })
  }

  return events
    .filter(item => item.timestamp)
    .sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp))
    .slice(0, 24)
}

function ensureEndpointNodes(
  nodes: NodePreview[],
  line: Line,
  segmentRaw: Record<string, unknown> | null,
  telemetry: TwinTelemetryPoint[],
  workorderCountMap: Map<string, number>,
  defaultDepth: number,
  featureId: string,
  featureName: string,
) {
  if (!line.length) return nodes

  const ensured = [...nodes]
  const segmentProps = objectValue(segmentRaw?.properties) || {}
  const endpointSpecs = [
    {
      role: 'start',
      point: line[0],
      id: firstFilledText(segmentRaw?.fromNodeId, segmentProps.fromNodeId, `${featureId}:start`),
      name: firstFilledText(segmentRaw?.fromNodeName, segmentProps.fromNodeName, `${featureName} 起点`),
      elevationIndex: 0,
    },
    {
      role: 'end',
      point: line[line.length - 1],
      id: firstFilledText(segmentRaw?.toNodeId, segmentProps.toNodeId, `${featureId}:end`),
      name: firstFilledText(segmentRaw?.toNodeName, segmentProps.toNodeName, `${featureName} 终点`),
      elevationIndex: Math.max(line.length - 1, 0),
    },
  ] as const

  for (const endpoint of endpointSpecs) {
    if (!endpoint.point) continue

    const existingById = ensured.find(node => node.id === endpoint.id)
    if (existingById) continue

    const existingByPoint = ensured.find(node => pointsAlmostSame(node.point, endpoint.point))
    if (existingByPoint) continue

    const pressure = pickTelemetryMetric(telemetry, endpoint.id, 'pressure')
    const flowRate = pickTelemetryMetric(telemetry, endpoint.id, 'flow')
      ?? pickTelemetryMetric(telemetry, endpoint.id, 'flowRate')
    const workorderCount = workorderCountMap.get(endpoint.id) || 0

    ensured.push({
      id: endpoint.id,
      name: endpoint.name,
      nodeType: 'junction',
      sourceType: 'endpoint',
      status: 'normal',
      point: endpoint.point,
      elevation: computeFallbackElevation(defaultDepth, endpoint.elevationIndex),
      depthMeters: defaultDepth,
      pressure,
      flowRate,
      hasWorkorder: workorderCount > 0,
      workorderCount,
    })
  }

  return ensured
}

function buildPipeProfile(line: Line, nodes: NodePreview[], defaultDepth: number) {
  const averageElevation = nodes.length
    ? nodes.reduce((sum, node) => sum + node.elevation, 0) / nodes.length
    : -defaultDepth

  return line.map((point, index) => {
    const sampledNode = findBestNodeSample(nodes, point, index)
    const depthMeters = sampledNode?.depthMeters ?? defaultDepth
    const elevation = sampledNode?.elevation ?? computeFallbackElevation(defaultDepth, index)
    const displayHeight = Math.max(
      MIN_PIPE_DISPLAY_HEIGHT,
      PIPE_GROUND_REFERENCE_HEIGHT - (depthMeters * PIPE_DEPTH_VISUAL_SCALE) + ((elevation - averageElevation) * PIPE_ELEVATION_VISUAL_SCALE),
    )

    return {
      point,
      elevation,
      depthMeters,
      groundHeight: PIPE_GROUND_REFERENCE_HEIGHT,
      displayHeight: Number(displayHeight.toFixed(2)),
    }
  })
}

function mergeLines(lines: Lines) {
  const merged: Line = []
  for (const line of lines) {
    for (const point of line) {
      const previous = merged[merged.length - 1]
      if (previous && isSamePoint(previous, point)) continue
      merged.push(point)
    }
  }
  return merged
}

function findBestNodeSample(nodes: NodePreview[], point: Point, index: number) {
  if (!nodes.length) return null
  const exact = nodes.find(node => pointsAlmostSame(node.point, point))
  if (exact) return exact

  let bestNode = nodes[Math.max(0, Math.min(index, nodes.length - 1))] || nodes[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const node of nodes) {
    const distance = ((node.point[0] - point[0]) ** 2) + ((node.point[1] - point[1]) ** 2)
    if (distance < bestDistance) {
      bestDistance = distance
      bestNode = node
    }
  }
  return bestNode
}

function pointsAlmostSame(a: Point, b: Point, epsilon = 1e-8) {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

function extractPrimaryPolygonRing(feature: GeoJsonFeature): Line | null {
  const geometry = feature.geometry
  if (!geometry || typeof geometry !== 'object') return null
  const type = String(geometry.type || '')
  const coordinates = geometry.coordinates

  if (type === 'Polygon' && Array.isArray(coordinates)) {
    return toLine(coordinates[0])
  }
  if (type === 'MultiPolygon' && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    return toLine((coordinates[0] as unknown[])[0])
  }
  return null
}

function toLine(raw: unknown): Line | null {
  if (!Array.isArray(raw)) return null
  const points = raw
    .filter(item => Array.isArray(item) && item.length >= 2)
    .map(item => [Number((item as unknown[])[0]), Number((item as unknown[])[1])] as Point)
    .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]))
  return points.length >= 3 ? points : null
}

function resolveNodePoint(
  nodeId: string,
  properties: Record<string, unknown>,
  line: Line,
  index: number,
  segmentNodeHints: Map<string, Point>,
): Point | null {
  const lon = resolveNumber(properties.lon, properties.lng, properties.longitude)
  const lat = resolveNumber(properties.lat, properties.latitude)
  if (lon != null && lat != null) {
    const exact: Point = [lon, lat]
    const nearestExisting = findNearestLinePoint(exact, line)
    return nearestExisting || exact
  }

  const hinted = segmentNodeHints.get(nodeId)
  if (hinted) return hinted

  if (!line.length) return null
  const safeIndex = Math.max(0, Math.min(index, line.length - 1))
  return line[safeIndex] || line[0] || null
}

function findNearestLinePoint(target: Point, line: Line) {
  if (!line.length) return null
  let best: Point | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const point of line) {
    const distance = ((point[0] - target[0]) ** 2) + ((point[1] - target[1]) ** 2)
    if (distance < bestDistance) {
      bestDistance = distance
      best = point
    }
  }
  return bestDistance <= 1e-8 ? best : best
}

function pickTelemetryMetric(telemetry: TwinTelemetryPoint[], nodeId: string, metric: string) {
  const normalizedMetric = metric.toLowerCase()
  const exact = telemetry.find(item => {
    const pointId = String(item.pointId || '').toLowerCase()
    const featureId = String(item.featureId || '').toLowerCase()
    return (pointId.includes(nodeId.toLowerCase()) || featureId.includes(nodeId.toLowerCase()))
      && String(item.metric || '').toLowerCase() === normalizedMetric
  })
  if (exact) return exact.value

  const fallback = telemetry.find(item => String(item.metric || '').toLowerCase() === normalizedMetric)
  return fallback ? fallback.value : null
}

function resolveSegmentDepth(...sources: unknown[]) {
  for (const source of sources) {
    const resolved = objectValue(source)
    if (resolved) {
      const depth = resolveNumber(resolved.depth_m, resolved.depth, resolved.buried_depth)
      if (depth != null) return depth
      continue
    }
    const numeric = resolveNumber(source)
    if (numeric != null) return numeric
  }
  return DEFAULT_SEGMENT_DEPTH
}

function computeFallbackElevation(depth: number, index: number) {
  return Number((-(depth || DEFAULT_SEGMENT_DEPTH) - index * 0.18).toFixed(2))
}

function resolveBuildingHeightMeters(properties: Record<string, unknown>) {
  const explicit = resolveNumber(
    properties.height,
    properties.height_m,
    properties.heightMeters,
    properties.extrudedHeight,
    properties.extrudeHeight,
  )
  if (explicit != null && explicit > 0) return explicit

  const floors = resolveNumber(
    properties.floors,
    properties.floorCount,
    properties.floor_count,
    properties.levels,
    properties['building:levels'],
  )
  if (floors != null && floors > 0) {
    return Number((floors * 3.6).toFixed(2))
  }

  return 18
}

function readBuildingModelConfig(properties: Record<string, unknown>): BuildingPreviewModelConfig | null {
  if (!isModelEnabled(properties.modelEnabled)) return null

  const url = normalizeModelUrl(properties.modelUrl)
  if (!url) return null

  const rawScaleMode = String(properties.modelScaleMode || '').trim().toLowerCase()
  const scaleMode: 'auto' | 'fixed' = ['fixed', 'manual'].includes(rawScaleMode) ? 'fixed' : 'auto'
  const lon = resolveNumber(properties.modelLongitude, properties.modelLon, properties.modelLng)
  const lat = resolveNumber(properties.modelLatitude, properties.modelLat)
  const hasCustomPosition = lon != null
    && lat != null
    && lon >= -180
    && lon <= 180
    && lat >= -90
    && lat <= 90

  return {
    url,
    scaleMode,
    scale: Math.max(resolveNumber(properties.modelScale) ?? 1, 0.01),
    heading: resolveNumber(properties.modelHeading) ?? 0,
    pitch: resolveNumber(properties.modelPitch) ?? 0,
    roll: resolveNumber(properties.modelRoll) ?? 0,
    position: hasCustomPosition ? { lon: lon as number, lat: lat as number } : null,
  }
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

function resolveNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function firstFilledText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : []
}

function parseTimestamp(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}
