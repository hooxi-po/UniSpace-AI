import type { GeoJsonFeature } from '~/services/geo-features'

export type Point = [number, number]
export type Line = Point[]
export type Lines = Line[]

export type PipeEditorMapView = {
  centerLon: number
  centerLat: number
  zoom: number
}

type FittedViewOptions = {
  defaultView: PipeEditorMapView
  minZoom: number
  maxZoom: number
  viewWidth: number
  viewHeight: number
  viewPadding: number
  tileSize: number
}

const MAX_LATITUDE = 85.05112878

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}

export function cloneLines(lines: Lines): Lines {
  return lines.map(line => line.map(pair => [pair[0], pair[1]] as Point))
}

export function isSamePoint(a: Point, b: Point, epsilon = 1e-9): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

export function geometryToLines(geometry: GeoJsonFeature['geometry']): Lines {
  if (!geometry || typeof geometry !== 'object') return []
  const type = String(geometry.type || '')
  const coordinates = geometry.coordinates

  if (type === 'LineString' && Array.isArray(coordinates)) {
    const line = (coordinates as unknown[])
      .filter(isPoint)
      .map(pair => [Number(pair[0]), Number(pair[1])] as Point)
    return line.length >= 2 ? [line] : []
  }

  if (type === 'MultiLineString' && Array.isArray(coordinates)) {
    return (coordinates as unknown[])
      .map(rawLine => Array.isArray(rawLine)
        ? rawLine.filter(isPoint).map(pair => [Number(pair[0]), Number(pair[1])] as Point)
        : [])
      .filter(line => line.length >= 2)
  }

  return []
}

export function clampLatitude(lat: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat))
}

export function lonLatToWorld(lon: number, lat: number, zoom: number, tileSize = 256) {
  const worldSize = tileSize * (2 ** zoom)
  const safeLat = clampLatitude(lat)
  const sin = Math.sin((safeLat * Math.PI) / 180)
  const x = ((lon + 180) / 360) * worldSize
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize
  return { x, y }
}

export function worldToLonLat(x: number, y: number, zoom: number, tileSize = 256): Point {
  const worldSize = tileSize * (2 ** zoom)
  const lon = (x / worldSize) * 360 - 180
  const merc = Math.PI - (2 * Math.PI * y) / worldSize
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(merc))
  return [Number(lon.toFixed(8)), Number(clampLatitude(lat).toFixed(8))]
}

export function buildFittedView(lines: Lines, options: FittedViewOptions): PipeEditorMapView {
  const points = lines.flat()
  if (!points.length) return { ...options.defaultView }

  let minLon = points[0][0]
  let maxLon = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]

  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const lonPad = Math.max((maxLon - minLon) * 0.15, 0.0002)
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.0002)
  minLon -= lonPad
  maxLon += lonPad
  minLat -= latPad
  maxLat += latPad

  let zoom = options.minZoom
  for (let z = options.maxZoom; z >= options.minZoom; z--) {
    const topLeft = lonLatToWorld(minLon, maxLat, z, options.tileSize)
    const bottomRight = lonLatToWorld(maxLon, minLat, z, options.tileSize)
    const spanX = Math.abs(bottomRight.x - topLeft.x)
    const spanY = Math.abs(bottomRight.y - topLeft.y)
    if (
      spanX <= options.viewWidth - options.viewPadding * 2
      && spanY <= options.viewHeight - options.viewPadding * 2
    ) {
      zoom = z
      break
    }
  }

  return {
    centerLon: Number(((minLon + maxLon) / 2).toFixed(8)),
    centerLat: Number(((minLat + maxLat) / 2).toFixed(8)),
    zoom,
  }
}

export function distanceToSegmentSquared(point: Point, a: Point, b: Point): number {
  const ax = a[0]
  const ay = a[1]
  const bx = b[0]
  const by = b[1]
  const px = point[0]
  const py = point[1]

  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLenSq = abx * abx + aby * aby
  if (abLenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
  const cx = ax + abx * t
  const cy = ay + aby * t
  return (px - cx) ** 2 + (py - cy) ** 2
}

function isPoint(input: unknown): input is Point {
  return Array.isArray(input)
    && input.length >= 2
    && Number.isFinite(Number(input[0]))
    && Number.isFinite(Number(input[1]))
}
