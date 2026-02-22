export type TwinDirection = 'up' | 'down'

async function readError(res: Response) {
  try {
    const json = await res.json()
    if (json && typeof json.error === 'string') return json.error
  } catch {
    // noop
  }
  return `HTTP ${res.status}`
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return (await res.json()) as T
}

export type TwinDrilldown = {
  featureId: string
  feature: unknown | null
  segment: Record<string, unknown> | null
  nodes: Array<Record<string, unknown>>
  relations: Array<Record<string, unknown>>
  linkedBuildings: Array<Record<string, unknown>>
  impactedRooms: Array<Record<string, unknown>>
  valves: Array<Record<string, unknown>>
  equipments: Array<Record<string, unknown>>
}

export type TwinTrace = {
  startId: string
  direction: TwinDirection
  pathSegmentIds: string[]
  pathFeatureIds: string[]
  nodeIds: string[]
  linkedBuildings: Array<Record<string, unknown>>
}

export type TwinTelemetryPoint = {
  pointId: string
  featureId: string
  metric: string
  value: number
  unit: string
  sampledAt: string
  quality: string
  source: string
}

export type TwinAuditItem = {
  id: string
  featureId: string
  action: string
  changedBy: string
  changedAt: string
  before: unknown
  after: unknown
}

export const twinService = {
  drilldown(backendBaseUrl: string, featureId: string) {
    return requestJson<TwinDrilldown>(
      `${backendBaseUrl}/api/v1/twin/drilldown/${encodeURIComponent(featureId)}`
    )
  },

  trace(backendBaseUrl: string, startId: string, direction: TwinDirection = 'down') {
    return requestJson<TwinTrace>(
      `${backendBaseUrl}/api/v1/twin/trace?startId=${encodeURIComponent(startId)}&direction=${direction}`
    )
  },

  telemetryLatest(backendBaseUrl: string, featureIds: string[]) {
    const ids = featureIds.map(id => id.trim()).filter(Boolean)
    if (!ids.length) return Promise.resolve([] as TwinTelemetryPoint[])

    return requestJson<{ list: TwinTelemetryPoint[] }>(
      `${backendBaseUrl}/api/v1/twin/telemetry/latest?featureIds=${encodeURIComponent(ids.join(','))}`
    ).then(res => res.list || [])
  },

  updatePipeGeometry(
    backendBaseUrl: string,
    id: string,
    geometry: { type: string; coordinates: unknown },
    updatedBy = 'admin-ui'
  ) {
    return requestJson<{ ok: boolean; id: string; action: string }>(
      `${backendBaseUrl}/api/v1/twin/pipes/${encodeURIComponent(id)}/geometry`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry, updatedBy }),
      }
    )
  },

  updatePipeProperties(
    backendBaseUrl: string,
    id: string,
    payload: { properties: Record<string, unknown>; visible?: boolean; updatedBy?: string }
  ) {
    return requestJson<{ ok: boolean; id: string; action: string }>(
      `${backendBaseUrl}/api/v1/twin/pipes/${encodeURIComponent(id)}/properties`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
  },

  listAuditLogs(backendBaseUrl: string, featureId: string, limit = 20) {
    const finalLimit = Math.min(Math.max(limit, 1), 200)
    return requestJson<{ featureId: string; list: TwinAuditItem[] }>(
      `${backendBaseUrl}/api/v1/twin/audit/${encodeURIComponent(featureId)}?limit=${finalLimit}`
    ).then(res => res.list || [])
  },
} as const
