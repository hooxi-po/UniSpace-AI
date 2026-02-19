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

async function requestJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
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
    backendBaseUrl: string,
    options: { layer: AssetLayer; limit?: number; visible?: boolean }
  ) {
    const params = new URLSearchParams()
    params.set('layers', options.layer)
    params.set('limit', String(options.limit ?? 5000))
    if (typeof options.visible === 'boolean') {
      params.set('visible', String(options.visible))
    }

    const json = (await requestJson(
      `${backendBaseUrl}/api/v1/features?${params.toString()}`
    )) as GeoJsonFeatureCollection

    return Array.isArray(json?.features) ? json.features : []
  },

  create(backendBaseUrl: string, payload: GeoFeaturePayload) {
    return requestJson(`${backendBaseUrl}/api/v1/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  update(backendBaseUrl: string, payload: GeoFeaturePayload) {
    return requestJson(`${backendBaseUrl}/api/v1/features`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  remove(backendBaseUrl: string, id: string) {
    return requestJson(`${backendBaseUrl}/api/v1/features?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  setVisibility(backendBaseUrl: string, id: string, visible: boolean) {
    return requestJson(`${backendBaseUrl}/api/v1/features/visibility`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, visible }),
    })
  },
} as const
