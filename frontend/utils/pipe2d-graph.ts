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

/**
 * 兼容旧图结构：将 straight 边上的 midPoints 拆分为“相邻节点之间的多条边”。
 * 这样每一段都可独立选中/删除，而不是只能选中首尾节点之间的整条边。
 */
export function normalizeLegacyMidPointEdges(graph: PipeGraph): PipeGraph {
  const next = cloneGraph(graph)
  if (!next.edges.some(e => e.edgeType === 'straight' && e.midPoints.length > 0)) {
    return next
  }

  const nodeIds = new Set(next.nodes.map(n => n.id))
  const edgeIds = new Set(next.edges.map(e => e.id))

  const pointKey = (p: Point) => `${p[0].toFixed(8)},${p[1].toFixed(8)}`
  const nodeByKey = new Map<string, PipeNode>()
  for (const n of next.nodes) {
    nodeByKey.set(pointKey([n.lon, n.lat]), n)
  }

  function createUniqueId(prefix: string, used: Set<string>) {
    let seq = 1
    let id = `${prefix}_${seq}`
    while (used.has(id)) {
      seq += 1
      id = `${prefix}_${seq}`
    }
    used.add(id)
    return id
  }

  function ensureNode(point: Point): PipeNode {
    const key = pointKey(point)
    const existed = nodeByKey.get(key)
    if (existed) return existed
    const node = createNode(createUniqueId('node', nodeIds), point[0], point[1], 'default', {})
    next.nodes.push(node)
    nodeByKey.set(key, node)
    return node
  }

  const rebuiltEdges: PipeEdge[] = []
  for (const edge of next.edges) {
    if (edge.edgeType !== 'straight' || edge.midPoints.length === 0) {
      rebuiltEdges.push(edge)
      continue
    }

    const chainNodeIds: string[] = [edge.sourceId]
    for (const p of edge.midPoints) {
      const node = ensureNode([p[0], p[1]])
      chainNodeIds.push(node.id)
    }
    chainNodeIds.push(edge.targetId)

    for (let i = 0; i < chainNodeIds.length - 1; i += 1) {
      const sourceId = chainNodeIds[i]
      const targetId = chainNodeIds[i + 1]
      if (sourceId === targetId) continue
      rebuiltEdges.push(createEdge(
        createUniqueId('edge', edgeIds),
        sourceId,
        targetId,
        'straight',
        [],
        null,
        { ...edge.attributes },
      ))
    }
  }

  next.edges = rebuiltEdges
  return next
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
 *
 * 策略：沿边链（edge chain）重建连续折线。
 * - 从度为 1 的节点（端点）出发遍历，将同一条连续路径合并为一条 Line。
 * - 若存在环形拓扑（所有节点度 ≥ 2），从任意未访问节点出发。
 * - 曲线边（curve）通过贝塞尔采样展平为折线点序列。
 * - 孤立节点（无边）忽略。
 * - 对于有 midPoints 的旧格式边（兼容），仍然展开 midPoints。
 */
export function graphToLines(graph: PipeGraph): Lines {
  if (!graph.nodes.length || !graph.edges.length) return []

  const nodeMap = new Map<string, PipeNode>()
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node)
  }

  // 构建邻接表：nodeId → [{edgeId, neighborId}]
  type AdjEntry = { edgeId: string; neighborId: string }
  const adj = new Map<string, AdjEntry[]>()
  for (const node of graph.nodes) adj.set(node.id, [])
  for (const edge of graph.edges) {
    adj.get(edge.sourceId)?.push({ edgeId: edge.id, neighborId: edge.targetId })
    adj.get(edge.targetId)?.push({ edgeId: edge.id, neighborId: edge.sourceId })
  }

  const edgeMap = new Map<string, PipeEdge>()
  for (const edge of graph.edges) edgeMap.set(edge.id, edge)

  const visitedEdges = new Set<string>()
  const lines: Lines = []

  // 将节点坐标转为 Point（展开 midPoints / 贝塞尔采样）
  function edgePoints(edge: PipeEdge, fromId: string): Point[] {
    const src = nodeMap.get(edge.sourceId)!
    const tgt = nodeMap.get(edge.targetId)!
    const srcPt: Point = [src.lon, src.lat]
    const tgtPt: Point = [tgt.lon, tgt.lat]
    const forward = edge.sourceId === fromId

    if (edge.edgeType === 'curve' && edge.controlPoints) {
      const pts = sampleCubicBezier(srcPt, edge.controlPoints[0], edge.controlPoints[1], tgtPt)
      return forward ? pts : [...pts].reverse()
    }
    if (forward) {
      return [srcPt, ...edge.midPoints, tgtPt]
    }
    return [tgtPt, ...[...edge.midPoints].reverse(), srcPt]
  }

  // 从起始节点出发遍历一条连续边链
  function traceChain(startId: string): void {
    const neighbors = adj.get(startId) || []
    // 找第一条未访问边
    const firstEntry = neighbors.find(e => !visitedEdges.has(e.edgeId))
    if (!firstEntry) return

    const chainPoints: Point[] = []
    let currentId = startId

    while (true) {
      const adjList = adj.get(currentId) || []
      const next = adjList.find(e => !visitedEdges.has(e.edgeId))
      if (!next) break

      visitedEdges.add(next.edgeId)
      const edge = edgeMap.get(next.edgeId)!
      const pts = edgePoints(edge, currentId)

      if (chainPoints.length === 0) {
        chainPoints.push(...pts)
      } else {
        // 跳过第一个点（已经是 chainPoints 的最后一个点）
        chainPoints.push(...pts.slice(1))
      }
      currentId = next.neighborId
    }

    if (chainPoints.length >= 2) {
      lines.push(chainPoints)
    }
  }

  // 优先从度为 1 的节点（端点）出发
  const degree1Nodes = graph.nodes.filter(n => (adj.get(n.id)?.length ?? 0) === 1)
  for (const startNode of degree1Nodes) {
    traceChain(startNode.id)
  }

  // 处理未访问的边（环形拓扑或多分支）
  for (const node of graph.nodes) {
    const hasUnvisited = (adj.get(node.id) || []).some(e => !visitedEdges.has(e.edgeId))
    if (hasUnvisited) {
      traceChain(node.id)
    }
  }

  return lines
}

/**
 * 将 Lines 转换为 PipeGraph。
 * 每条 Line 的每个折点都创建一个 Graph Node（相同坐标复用节点 id）。
 * 相邻节点之间创建一条直线边（midPoints = []）。
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
    // 每个折点都成为节点
    const nodeIds = line.map(p => getOrCreateNode(p))
    // 相邻节点创建边
    for (let i = 0; i < nodeIds.length - 1; i++) {
      edges.push(createEdge(`e${++edgeSeq}`, nodeIds[i], nodeIds[i + 1]))
    }
  }

  return { nodes, edges }
}
