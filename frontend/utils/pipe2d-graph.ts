/**
 * pipe2d-graph.ts
 *
 * 思维导图式管道编辑器的核心数据模型。
 * 纯类型定义 + 纯函数，不依赖任何 Vue/Cesium/Mars3D。
 */

import type { Lines, Point } from './pipe2d-geometry'

// ---------------------------------------------------------------------------
// 节点类型与属性
// ---------------------------------------------------------------------------

export type NodeType =
  | 'default'   // 普通折点（连接处）
  | 'valve'     // 阀门
  | 'manhole'   // 检查井
  | 'pump'      // 泵站
  | 'meter'     // 水表 / 计量装置
  | 'junction'  // T形 / 十字接口

export type NodeAttributes = {
  label?: string
  elevation?: number      // 高程（米）
  installDate?: string    // 安装日期 ISO
  status?: 'normal' | 'warning' | 'error'  // 状态
  notes?: string          // 备注

  // 窨井专有属性
  manholeType?: 'inspection' | 'drainage' | 'cable' | 'other'  // 窨井类型
  manholeNo?: string      // 窨井编号
  depth?: number          // 深度（米）
  diameter?: number       // 直径（米）
  material?: string       // 材质
  coverType?: string      // 井盖类型

  // 阀门专有属性
  valveType?: 'gate' | 'ball' | 'butterfly' | 'check'  // 阀门类型
  valveNo?: string        // 阀门编号
  valveSize?: number      // 口径（mm）
  valveStatus?: 'open' | 'closed' | 'partial'  // 阀门状态

  // 泵站专有属性
  pumpCapacity?: number   // 流量（m³/h）
  pumpPower?: number      // 功率（kW）
  pumpHead?: number       // 扬程（m）
  pumpStatus?: 'running' | 'stopped' | 'maintenance'

  // 测点专有属性
  sensorType?: 'pressure' | 'flow' | 'temperature' | 'level'
  sensorId?: string       // 传感器ID
  meterNo?: string        // 水表编号
  meterDiameter?: number  // 水表口径（mm）

  // 可扩展
  [key: string]: unknown
}

export type EdgeAttributes = {
  label?: string
  material?: string       // 管道材质 PE/PVC/钢管...
  diameter?: number       // 管径 mm
  pressureRating?: number // 压力等级 MPa
  installDate?: string
  remark?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// 核心图结构
// ---------------------------------------------------------------------------

export type PipeNode = {
  id: string
  lon: number
  lat: number
  type: NodeType
  attributes: NodeAttributes
}

/** 边类型：straight = 折线（多个中间点），curve = 三次贝塞尔曲线 */
export type EdgeType = 'straight' | 'curve'

export type PipeEdge = {
  id: string
  sourceId: string
  targetId: string
  edgeType: EdgeType
  /** 折线边的中间控制点（不含首尾节点坐标）*/
  midPoints: Point[]
  /** 曲线边的两个贝塞尔控制点 cp1、cp2（绝对经纬度）*/
  controlPoints: [Point, Point] | null
  attributes: EdgeAttributes
}

export type PipeGraph = {
  nodes: PipeNode[]
  edges: PipeEdge[]
}

// ---------------------------------------------------------------------------
// 工厂函数
// ---------------------------------------------------------------------------

export function createNode(
  id: string,
  lon: number,
  lat: number,
  type: NodeType = 'default',
  attributes: NodeAttributes = {},
): PipeNode {
  return { id, lon, lat, type, attributes }
}

export function createEdge(
  id: string,
  sourceId: string,
  targetId: string,
  edgeType: EdgeType = 'straight',
  midPoints: Point[] = [],
  controlPoints: [Point, Point] | null = null,
  attributes: EdgeAttributes = {},
): PipeEdge {
  return { id, sourceId, targetId, edgeType, midPoints, controlPoints, attributes }
}

export function createEmptyGraph(): PipeGraph {
  return { nodes: [], edges: [] }
}

// ---------------------------------------------------------------------------
// 克隆
// ---------------------------------------------------------------------------

export function cloneGraph(graph: PipeGraph): PipeGraph {
  return {
    nodes: graph.nodes.map(n => ({
      ...n,
      attributes: { ...n.attributes },
    })),
    edges: graph.edges.map(e => ({
      ...e,
      midPoints: e.midPoints.map(p => [p[0], p[1]] as Point),
      controlPoints: e.controlPoints
        ? [[e.controlPoints[0][0], e.controlPoints[0][1]], [e.controlPoints[1][0], e.controlPoints[1][1]]]
        : null,
      attributes: { ...e.attributes },
    })),
  }
}

// ---------------------------------------------------------------------------
// 贝塞尔曲线采样
// ---------------------------------------------------------------------------

/**
 * 对三次贝塞尔曲线进行均匀参数采样，返回 n+1 个插值点。
 * p0/p3 为端点（来自节点坐标），cp1/cp2 为控制点。
 */
export function sampleCubicBezier(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
  n = 32,
): Point[] {
  const result: Point[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t
    result.push([
      mt3 * p0[0] + 3 * mt2 * t * cp1[0] + 3 * mt * t2 * cp2[0] + t3 * p3[0],
      mt3 * p0[1] + 3 * mt2 * t * cp1[1] + 3 * mt * t2 * cp2[1] + t3 * p3[1],
    ])
  }
  return result
}

/**
 * 根据两端点和拖拽方向自动生成一对贝塞尔控制点（S形弧线）。
 * offset 比例控制弧度，默认 0.4。
 */
export function autoControlPoints(
  p0: Point,
  p3: Point,
  offset = 0.4,
): [Point, Point] {
  const dx = p3[0] - p0[0]
  const dy = p3[1] - p0[1]
  return [
    [p0[0] + dx * offset, p0[1] + dy * offset * 0.1],
    [p3[0] - dx * offset, p3[1] - dy * offset * 0.1],
  ]
}

// ---------------------------------------------------------------------------
// PipeGraph ⟷ Lines 互转（兼容旧格式）
// ---------------------------------------------------------------------------

/**
 * 将 PipeGraph 展开成 Lines（折线数组），用于渲染和旧格式存储。
 * 曲线边会被贝塞尔采样后展平为折线。
 */
export function graphToLines(graph: PipeGraph): Lines {
  const nodeMap = new Map<string, PipeNode>()
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node)
  }

  const lines: Lines = []
  for (const edge of graph.edges) {
    const src = nodeMap.get(edge.sourceId)
    const tgt = nodeMap.get(edge.targetId)
    if (!src || !tgt) continue

    const srcPt: Point = [src.lon, src.lat]
    const tgtPt: Point = [tgt.lon, tgt.lat]

    if (edge.edgeType === 'curve' && edge.controlPoints) {
      lines.push(sampleCubicBezier(srcPt, edge.controlPoints[0], edge.controlPoints[1], tgtPt))
    } else {
      lines.push([srcPt, ...edge.midPoints, tgtPt])
    }
  }
  return lines
}

/**
 * 将旧格式 Lines 推断为 PipeGraph。
 * 每条 line 的首尾变成节点，线段本身变成边。
 * 相同坐标（精度 7 位）的端点会复用同一个节点 id（实现连通）。
 */
export function linesToGraph(lines: Lines, idPrefix = 'n'): PipeGraph {
  const nodes: PipeNode[] = []
  const edges: PipeEdge[] = []
  const coordKey = (p: Point) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`
  const nodeByKey = new Map<string, string>() // coordKey → nodeId
  let nodeSeq = 0
  let edgeSeq = 0

  function getOrCreateNode(p: Point): string {
    const key = coordKey(p)
    if (nodeByKey.has(key)) return nodeByKey.get(key)!
    const id = `${idPrefix}${++nodeSeq}`
    nodes.push(createNode(id, p[0], p[1]))
    nodeByKey.set(key, id)
    return id
  }

  for (const line of lines) {
    if (line.length < 2) continue
    const srcId = getOrCreateNode(line[0])
    const tgtId = getOrCreateNode(line[line.length - 1])
    const midPoints = line.slice(1, -1).map(p => [p[0], p[1]] as Point)
    const edgeId = `e${++edgeSeq}`
    edges.push(createEdge(edgeId, srcId, tgtId, 'straight', midPoints))
  }

  return { nodes, edges }
}

