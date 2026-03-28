/**
 * 智能吸附辅助函数
 * 支持吸附到端点、中点、网格等
 */

import type { Point } from './pipe2d-geometry'

export type SnapTarget =
  | { type: 'endpoint'; point: Point; distance: number }
  | { type: 'midpoint'; point: Point; distance: number; edgeId?: string }
  | { type: 'grid'; point: Point; distance: number }
  | { type: 'perpendicular'; point: Point; distance: number; edgeId?: string }
  | null

export interface SnapOptions {
  snapToEndpoints?: boolean
  snapToMidpoints?: boolean
  snapToGrid?: boolean
  snapToPerpendicular?: boolean
  endpointThreshold?: number
  midpointThreshold?: number
  gridSize?: number
}

const DEFAULT_SNAP_OPTIONS: Required<SnapOptions> = {
  snapToEndpoints: true,
  snapToMidpoints: true,
  snapToGrid: false,
  snapToPerpendicular: false,
  endpointThreshold: 20,  // 像素
  midpointThreshold: 15,  // 像素
  gridSize: 0.0001,       // 约 10 米
}

/**
 * 计算两点之间的距离（平方）
 */
function distanceSquared(p1: Point, p2: Point): number {
  const dx = p1[0] - p2[0]
  const dy = p1[1] - p2[1]
  return dx * dx + dy * dy
}

/**
 * 计算线段的中点
 */
function getMidpoint(p1: Point, p2: Point): Point {
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
}

/**
 * 吸附到网格
 */
function snapToGrid(point: Point, gridSize: number): Point {
  return [
    Math.round(point[0] / gridSize) * gridSize,
    Math.round(point[1] / gridSize) * gridSize,
  ]
}

/**
 * 计算点到线段的垂足
 */
function getPerpendicularPoint(point: Point, lineStart: Point, lineEnd: Point): Point {
  const dx = lineEnd[0] - lineStart[0]
  const dy = lineEnd[1] - lineStart[1]
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return lineStart

  const t = Math.max(0, Math.min(1, (
    (point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy
  ) / lengthSquared))

  return [
    lineStart[0] + t * dx,
    lineStart[1] + t * dy,
  ]
}

/**
 * 世界坐标转屏幕坐标（需要外部提供转换函数）
 */
export type WorldToScreenFn = (point: Point) => { x: number; y: number } | null

/**
 * 查找最佳吸附目标
 */
export function findSnapTarget(
  point: Point,
  screenPosition: { x: number; y: number },
  worldToScreen: WorldToScreenFn,
  endpoints: Point[],
  edges: Array<{ start: Point; end: Point; id?: string }>,
  options: SnapOptions = {}
): SnapTarget {
  const opts = { ...DEFAULT_SNAP_OPTIONS, ...options }
  let bestTarget: SnapTarget = null
  let bestDistanceSquared = Number.POSITIVE_INFINITY

  // 1. 吸附到端点（优先级最高）
  if (opts.snapToEndpoints) {
    const thresholdSq = opts.endpointThreshold * opts.endpointThreshold
    for (const endpoint of endpoints) {
      const screenPos = worldToScreen(endpoint)
      if (!screenPos) continue

      const dx = screenPos.x - screenPosition.x
      const dy = screenPos.y - screenPosition.y
      const distSq = dx * dx + dy * dy

      if (distSq <= thresholdSq && distSq < bestDistanceSquared) {
        bestDistanceSquared = distSq
        bestTarget = {
          type: 'endpoint',
          point: endpoint,
          distance: Math.sqrt(distSq),
        }
      }
    }
  }

  // 如果已经吸附到端点，直接返回
  if (bestTarget && bestTarget.type === 'endpoint') {
    return bestTarget
  }

  // 2. 吸附到中点
  if (opts.snapToMidpoints) {
    const thresholdSq = opts.midpointThreshold * opts.midpointThreshold
    for (const edge of edges) {
      const midpoint = getMidpoint(edge.start, edge.end)
      const screenPos = worldToScreen(midpoint)
      if (!screenPos) continue

      const dx = screenPos.x - screenPosition.x
      const dy = screenPos.y - screenPosition.y
      const distSq = dx * dx + dy * dy

      if (distSq <= thresholdSq && distSq < bestDistanceSquared) {
        bestDistanceSquared = distSq
        bestTarget = {
          type: 'midpoint',
          point: midpoint,
          distance: Math.sqrt(distSq),
          edgeId: edge.id,
        }
      }
    }
  }

  // 3. 吸附到垂足（用于绘制垂直线）
  if (opts.snapToPerpendicular) {
    const thresholdSq = opts.midpointThreshold * opts.midpointThreshold
    for (const edge of edges) {
      const perpPoint = getPerpendicularPoint(point, edge.start, edge.end)
      const screenPos = worldToScreen(perpPoint)
      if (!screenPos) continue

      const dx = screenPos.x - screenPosition.x
      const dy = screenPos.y - screenPosition.y
      const distSq = dx * dx + dy * dy

      if (distSq <= thresholdSq && distSq < bestDistanceSquared) {
        bestDistanceSquared = distSq
        bestTarget = {
          type: 'perpendicular',
          point: perpPoint,
          distance: Math.sqrt(distSq),
          edgeId: edge.id,
        }
      }
    }
  }

  // 4. 吸附到网格（优先级最低）
  if (opts.snapToGrid && !bestTarget) {
    const gridPoint = snapToGrid(point, opts.gridSize)
    bestTarget = {
      type: 'grid',
      point: gridPoint,
      distance: 0,
    }
  }

  return bestTarget
}

/**
 * 获取吸附提示文本
 */
export function getSnapHintText(target: SnapTarget): string {
  if (!target) return ''

  switch (target.type) {
    case 'endpoint':
      return '吸附到端点'
    case 'midpoint':
      return '吸附到中点'
    case 'grid':
      return '吸附到网格'
    case 'perpendicular':
      return '吸附到垂足'
    default:
      return ''
  }
}
