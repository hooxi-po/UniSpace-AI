import * as Cesium from 'cesium'
import type { GeoJsonFeature } from '~/services/geo-features'
import { PIPE_LAYER_COLOR_HEX, resolvePipeLayerFromProps } from '~/utils/pipe-classifier'
import { cloneLines, type Line, type Lines, type PipeEditorMapView, type Point } from '~/utils/pipe2d-geometry'

export type PipeLineMeta = {
  lineIndex: number
}

export type PipePointMeta = {
  lineIndex: number
  pointIndex: number
}

export type ContextMenuState = {
  visible: boolean
  x: number
  y: number
  canInsert: boolean
  canDelete: boolean
}

export type HistoryItem = {
  index: number
  label: string
  points: number
  lengthMeters: number
}

export type EditorSceneMode = '2d' | '3d'

export type HoverLengthHint = {
  visible: boolean
  x: number
  y: number
  text: string
}

const VIEW_WIDTH = 980
const VIEW_HEIGHT = 560
const VIEW_PADDING = 30
export const MIN_ZOOM = 14
export const MAX_ZOOM = 20

export const SNAP_PIXEL_THRESHOLD = 8
export const SELECT_POINT_THRESHOLD = 12
export const SELECT_LINE_THRESHOLD = 16

export const DEFAULT_VIEW: PipeEditorMapView = {
  centerLon: 119.1895,
  centerLat: 26.0254,
  zoom: 18,
}

export const FITTED_VIEW_OPTIONS = {
  defaultView: DEFAULT_VIEW,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  viewWidth: VIEW_WIDTH,
  viewHeight: VIEW_HEIGHT,
  viewPadding: VIEW_PADDING,
  tileSize: 256,
} as const

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function lineLengthMeters(line: Line) {
  if (!line || line.length < 2) return 0
  let total = 0
  for (let index = 0; index < line.length - 1; index += 1) {
    const a = line[index]
    const b = line[index + 1]
    const geodesic = new Cesium.EllipsoidGeodesic(
      Cesium.Cartographic.fromDegrees(a[0], a[1]),
      Cesium.Cartographic.fromDegrees(b[0], b[1]),
    )
    total += geodesic.surfaceDistance || 0
  }
  return total
}

export function sumLength(lines: Lines) {
  return lines.reduce((sum, line) => sum + lineLengthMeters(line), 0)
}

export function estimateZoomFromHeight(height: number, latitude: number) {
  const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180))
  const metersPerPixel = Math.max(height / 800, 0.01)
  const zoom = Math.log2((156543.03392 * cosLat) / metersPerPixel)
  return clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM)
}

export function zoomToHeight(zoom: number, latitude: number) {
  const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180))
  const metersPerPixel = (156543.03392 * cosLat) / (2 ** zoom)
  return Math.max(80, metersPerPixel * 780)
}

export function toLonLat(cartesian: Cesium.Cartesian3): Point {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  const lon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(8))
  const lat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(8))
  return [lon, lat]
}

export function lineMetaOf(entity: Cesium.Entity | null): PipeLineMeta | null {
  if (!entity) return null
  const meta = (entity as any).__pipeLineMeta
  if (!meta || typeof meta !== 'object') return null
  if (!Number.isInteger(meta.lineIndex)) return null
  return { lineIndex: Number(meta.lineIndex) }
}

export function pointMetaOf(entity: Cesium.Entity | null): PipePointMeta | null {
  if (!entity) return null
  const meta = (entity as any).__pipePointMeta
  if (!meta || typeof meta !== 'object') return null
  if (!Number.isInteger(meta.lineIndex) || !Number.isInteger(meta.pointIndex)) return null
  return {
    lineIndex: Number(meta.lineIndex),
    pointIndex: Number(meta.pointIndex),
  }
}

export function lineIndexOfGraphic(graphic: any): number {
  if (!graphic) return -1
  const attrLineIndex = Number(graphic?.attr?.lineIndex)
  if (Number.isInteger(attrLineIndex) && attrLineIndex >= 0) return attrLineIndex
  const metaLineIndex = Number(graphic?.__pipeLineMeta?.lineIndex)
  if (Number.isInteger(metaLineIndex) && metaLineIndex >= 0) return metaLineIndex
  return -1
}

export function toLineFromGraphic(graphic: any): Line {
  const positions = (graphic?.positions || graphic?.positionsShow || []) as Array<Cesium.Cartesian3 | number[]>
  const line: Line = []
  for (const item of positions) {
    if (Array.isArray(item)) {
      if (item.length >= 2 && Number.isFinite(item[0]) && Number.isFinite(item[1])) {
        line.push([Number(item[0]), Number(item[1])])
      }
      continue
    }
    if (item && typeof item === 'object') {
      line.push(toLonLat(item as Cesium.Cartesian3))
    }
  }
  return line
}

export function getNearestPointIndex(line: Line, target: Point) {
  if (!line.length) return -1
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < line.length; index += 1) {
    const dx = line[index][0] - target[0]
    const dy = line[index][1] - target[1]
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

export function getChangedPointIndex(beforeLine: Line | undefined, afterLine: Line | undefined) {
  if (!beforeLine?.length || !afterLine?.length) return -1
  const limit = Math.min(beforeLine.length, afterLine.length)
  if (!limit) return -1
  let bestIndex = 0
  let bestDistance = -1
  for (let index = 0; index < limit; index += 1) {
    const dx = afterLine[index][0] - beforeLine[index][0]
    const dy = afterLine[index][1] - beforeLine[index][1]
    const distance = dx * dx + dy * dy
    if (distance > bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  if (afterLine.length > beforeLine.length) {
    return Math.min(afterLine.length - 1, bestIndex + 1)
  }
  return bestIndex
}

export function pointToSegmentDistanceSquared(p: Cesium.Cartesian2, a: Cesium.Cartesian2, b: Cesium.Cartesian2) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const abLenSq = abx * abx + aby * aby
  if (abLenSq <= 1e-6) {
    return apx * apx + apy * apy
  }
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
  const cx = a.x + abx * t
  const cy = a.y + aby * t
  const dx = p.x - cx
  const dy = p.y - cy
  return dx * dx + dy * dy
}

export function buildHistoryItems(history: Lines[]) {
  const result: HistoryItem[] = []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const snapshot = history[index]
    const points = snapshot.reduce((sum, line) => sum + line.length, 0)
    result.push({
      index,
      label: `回到第 ${index + 1} 步`,
      points,
      lengthMeters: sumLength(snapshot),
    })
  }
  return result
}

export function createContextMenuState(): ContextMenuState {
  return {
    visible: false,
    x: 0,
    y: 0,
    canInsert: false,
    canDelete: false,
  }
}

export function resolvePipeBaseColor(feature: GeoJsonFeature | null) {
  const properties = (feature?.properties || {}) as Record<string, unknown>
  const medium = String(
    properties.pipelineMedium
    || properties.pipeType
    || properties.pipeLayer
    || properties.medium
    || properties.media
    || properties.type
    || properties.category
    || properties.pipelineType
    || '',
  ).toLowerCase()

  if (/(fire|消防)/.test(medium)) return '#f87171'

  const pipeLayer = resolvePipeLayerFromProps(properties)
  return pipeLayer ? PIPE_LAYER_COLOR_HEX[pipeLayer] : '#6366f1'
}

export function resetLines(target: { draft: Lines; original: Lines }) {
  return {
    draft: cloneLines(target.draft),
    original: cloneLines(target.original),
  }
}
