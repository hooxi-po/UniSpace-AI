import { fetchWithProxyWriteAuth } from './proxy-write-auth'

export type AssetLayer = 'buildings' | 'pipes'

export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

export type GeoJsonFeature = {
  type: 'Feature'
  id: string
  properties: Record<string, unknown>
  geometry: GeoJsonGeometry
}

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export type GeoFeaturePayload = {
  id: string
  layer: string
  geometry: {
    type: string
    coordinates: unknown
  }
  properties: Record<string, unknown>
  visible: boolean
}

async function readError(res: Response) {
  try {
    const json = await res.json()
    if (json && typeof json.error === 'string') {
      return json.error
    }
  } catch {
    // noop
  }
  return `HTTP ${res.status}`
}

async function requestJson(url: string, init?: RequestInit, useWriteAuth = false) {
  const res = useWriteAuth
    ? await fetchWithProxyWriteAuth(url, init)
    : await fetch(url, init)
  if (!res.ok) {
    throw new Error(await readError(res))
  }

  try {
    return await res.json()
  } catch {
    return { ok: true }
  }
}

export const geoFeatureService = {
  async list(
    _backendBaseUrl: string,
    options: { layer: AssetLayer; limit?: number; visible?: boolean }
  ) {
    const params = new URLSearchParams()
    params.set('layers', options.layer)
    params.set('limit', String(options.limit ?? 5000))
    if (typeof options.visible === 'boolean') {
      params.set('visible', String(options.visible))
    }

    const json = (await requestJson(
      `/api/backend/features?${params.toString()}`
    )) as GeoJsonFeatureCollection

    return Array.isArray(json?.features) ? json.features : []
  },

  create(_backendBaseUrl: string, payload: GeoFeaturePayload) {
    return requestJson('/api/backend/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, true)
  },

  update(_backendBaseUrl: string, payload: GeoFeaturePayload) {
    return requestJson('/api/backend/features', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, true)
  },

  remove(_backendBaseUrl: string, id: string) {
    return requestJson(`/api/backend/features?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }, true)
  },

  setVisibility(_backendBaseUrl: string, id: string, visible: boolean) {
    return requestJson('/api/backend/features/visibility', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, visible }),
    }, true)
  },
} as const
