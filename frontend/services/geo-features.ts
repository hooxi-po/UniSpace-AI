export type AssetLayer = 'buildings' | 'pipes'

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

