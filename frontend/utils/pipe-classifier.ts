export const PIPE_LAYER_NAMES = ['water', 'drain', 'sewage'] as const
export type PipeLayerName = (typeof PIPE_LAYER_NAMES)[number]

const WATER_HIGHWAYS = new Set(['motorway', 'trunk', 'primary', 'secondary'])
const SEWAGE_HIGHWAYS = new Set([
  'service',
  'residential',
  'living_street',
  'tertiary',
  'unclassified',
])
const DRAIN_HIGHWAYS = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track'])

export function normalizeRoadClass(highway: unknown) {
  return String(highway || '').trim().toLowerCase()
}

export function classifyHighwayToPipeLayer(highwayRaw: unknown) {
  const highway = normalizeRoadClass(highwayRaw)
  if (WATER_HIGHWAYS.has(highway)) return 'water' as const
  if (DRAIN_HIGHWAYS.has(highway)) return 'drain' as const
  if (SEWAGE_HIGHWAYS.has(highway)) return 'sewage' as const
  return null
}

function pickDeterministicFallback(seedSource: string): PipeLayerName {
  const seed = [...seedSource].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return PIPE_LAYER_NAMES[seed % PIPE_LAYER_NAMES.length]
}

export function classifyRoadToPipeLayer(
  props: Record<string, unknown>,
  seedSource: string
): PipeLayerName {
  const mapped = classifyHighwayToPipeLayer(props.highway)
  if (mapped) return mapped
  return pickDeterministicFallback(seedSource)
}

export function classifyRoadToPipeCategory(highwayRaw: unknown) {
  const mapped = classifyHighwayToPipeLayer(highwayRaw)
  if (mapped === 'water') return '供水'
  if (mapped === 'drain') return '排水'
  if (mapped === 'sewage') return '污水'
  return '未分类'
}
