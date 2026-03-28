import * as Cesium from 'cesium'

export type BuildingReplacementCandidate = {
  id: string
  center: Cesium.Cartesian3
  heading: number
  footprintTargetSize: number
  originalProperties: Record<string, unknown>
}

export const MODEL_NATIVE_SIZE_FALLBACK = 30
const MODEL_SCALE_MIN = 0.02
const MODEL_SCALE_MAX = 2000
const MODEL_TARGET_FILL_RATIO = 0.9
const modelNativeSizeCache = new Map<string, Promise<number>>()

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function appendCacheBust(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Date.now()}`
}

export function appendQuery(url: string, query: Record<string, string | number | undefined>) {
  const resolved = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') {
      resolved.searchParams.delete(key)
      continue
    }
    resolved.searchParams.set(key, String(value))
  }
  return resolved.toString()
}

export function getCurrentViewBboxes(viewer: Cesium.Viewer | null) {
  if (!viewer) return []
  const rectangle = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid)
  if (!rectangle) return []

  const west = Cesium.Math.toDegrees(rectangle.west)
  const south = Cesium.Math.toDegrees(rectangle.south)
  const east = Cesium.Math.toDegrees(rectangle.east)
  const north = Cesium.Math.toDegrees(rectangle.north)
  const minLat = Math.max(-90, Math.min(south, north))
  const maxLat = Math.min(90, Math.max(south, north))

  if (![west, minLat, east, maxLat].every(Number.isFinite)) return []

  const normalizedWest = Math.max(-180, Math.min(180, west))
  const normalizedEast = Math.max(-180, Math.min(180, east))
  if (normalizedWest <= normalizedEast) {
    return [[normalizedWest, minLat, normalizedEast, maxLat].map(v => v.toFixed(6)).join(',')]
  }

  return [
    [normalizedWest, minLat, 180, maxLat].map(v => v.toFixed(6)).join(','),
    [-180, minLat, normalizedEast, maxLat].map(v => v.toFixed(6)).join(','),
  ]
}

export async function fetchPagedFeatureCollection(
  baseUrl: string,
  bbox: string | null,
  pageSize: number,
  maxPages: number,
) {
  const features: Record<string, unknown>[] = []
  for (let page = 1; page <= maxPages; page++) {
    const requestUrl = appendQuery(baseUrl, {
      bbox: bbox || undefined,
      page,
      limit: pageSize,
    })
    const response = await fetch(requestUrl)
    if (!response.ok) {
      throw new Error(`load_layer_http_${response.status}`)
    }
    const collection = (await response.json()) as { features?: Record<string, unknown>[] }
    const pageFeatures = Array.isArray(collection.features) ? collection.features : []
    features.push(...pageFeatures)
    if (pageFeatures.length < pageSize) break
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

export async function fetchPagedFeatureCollectionByBboxes(
  baseUrl: string,
  bboxes: string[],
  pageSize: number,
  maxPages: number,
) {
  const uniqueFeatures = new Map<string, Record<string, unknown>>()
  const featuresWithoutId: Record<string, unknown>[] = []
  const effectiveBboxes = bboxes.length ? bboxes : [null]

  for (const bbox of effectiveBboxes) {
    const collection = await fetchPagedFeatureCollection(baseUrl, bbox, pageSize, maxPages)
    for (const feature of collection.features) {
      const id = feature.id
      if (id === undefined || id === null) {
        featuresWithoutId.push(feature)
        continue
      }
      uniqueFeatures.set(String(id), feature)
    }
  }

  return {
    type: 'FeatureCollection',
    features: [...uniqueFeatures.values(), ...featuresWithoutId],
  }
}

export function getPolygonPositions(entity: Cesium.Entity, currentTime: Cesium.JulianDate) {
  const hierarchy = entity.polygon?.hierarchy?.getValue(currentTime)
  if (!hierarchy || hierarchy.positions.length < 3) return null
  return hierarchy.positions
}

export function computeFootprintMetrics(positions: Cesium.Cartesian3[]) {
  const center = new Cesium.Cartesian3()
  for (const position of positions) {
    Cesium.Cartesian3.add(center, position, center)
  }
  Cesium.Cartesian3.multiplyByScalar(center, 1 / positions.length, center)

  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center)
  const inverseEnu = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4())
  const localPoints = positions.map(position => {
    return Cesium.Matrix4.multiplyByPoint(inverseEnu, position, new Cesium.Cartesian3())
  })

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of localPoints) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const width = Math.max(0.1, maxX - minX)
  const depth = Math.max(0.1, maxY - minY)
  const diagonal = Math.sqrt(width * width + depth * depth)
  let heading = 0
  let maxEdgeLength = 0
  for (let index = 0; index < localPoints.length; index++) {
    const current = localPoints[index]
    const next = localPoints[(index + 1) % localPoints.length]
    const dx = next.x - current.x
    const dy = next.y - current.y
    const edgeLength = Math.sqrt(dx * dx + dy * dy)
    if (edgeLength > maxEdgeLength) {
      maxEdgeLength = edgeLength
      heading = Math.atan2(dx, dy)
    }
  }

  return {
    center,
    heading,
    footprintTargetSize: Math.max(Math.max(width, depth), diagonal * 0.72),
  }
}

export function pickReplacementBuilding(
  entities: Cesium.Entity[],
  currentTime: Cesium.JulianDate,
  targetId: string,
  targetName: string,
): BuildingReplacementCandidate | null {
  for (const entity of entities) {
    const entityId = String(entity.id)
    const rawProps = (entity.properties?.getValue(currentTime) || {}) as Record<string, unknown>
    const entityName = String(rawProps.name || rawProps.short_name || '')
    const isTarget = entityId === targetId || entityName === targetName
    if (!isTarget) continue

    const positions = getPolygonPositions(entity, currentTime)
    if (!positions) continue
    const metrics = computeFootprintMetrics(positions)
    return {
      id: entityId,
      center: metrics.center,
      heading: metrics.heading,
      footprintTargetSize: metrics.footprintTargetSize,
      originalProperties: rawProps,
    }
  }

  return null
}

export function buildModelScale(footprintTargetSize: number, nativeSizeMeters: number) {
  const safeNativeSize = nativeSizeMeters > 0 ? nativeSizeMeters : MODEL_NATIVE_SIZE_FALLBACK
  const rawScale = (footprintTargetSize * MODEL_TARGET_FILL_RATIO) / safeNativeSize
  return clamp(rawScale, MODEL_SCALE_MIN, MODEL_SCALE_MAX)
}

export async function getModelNativeSizeMeters(viewer: Cesium.Viewer | null, url: string) {
  const cached = modelNativeSizeCache.get(url)
  if (cached) return cached

  const pending = (async () => {
    if (!viewer) return MODEL_NATIVE_SIZE_FALLBACK
    let model: Cesium.Model | null = null
    try {
      model = await Cesium.Model.fromGltfAsync({
        url,
        show: false,
        modelMatrix: Cesium.Matrix4.IDENTITY,
      })
      viewer.scene.primitives.add(model)
      const radius = model.boundingSphere?.radius ?? 0
      if (!Number.isFinite(radius) || radius <= 0) {
        return MODEL_NATIVE_SIZE_FALLBACK
      }
      return radius * 2
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to read model native size, fallback will be used:', url, error)
      return MODEL_NATIVE_SIZE_FALLBACK
    } finally {
      if (model && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(model)
        if (!model.isDestroyed()) {
          model.destroy()
        }
      }
    }
  })()

  modelNativeSizeCache.set(url, pending)
  return pending
}
