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
