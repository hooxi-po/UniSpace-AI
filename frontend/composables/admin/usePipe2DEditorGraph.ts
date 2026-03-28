/**
 * usePipe2DEditorGraph.ts
 *
 * 图状态管理层：维护 PipeGraph（节点+边），与 draftLines 双向同步。
 * 提供 addNode / addEdge / removeNode / removeEdge / updateNode / updateEdge。
 *
 * 设计原则：
 * - 本 composable 只管图数据状态，不触碰任何地图渲染/Cesium。
 * - draftLines 由 graphToLines() 派生（computed），saveGeometry 仍走 Lines 路径（兼容旧后端）。
 */

import { computed, ref, type Ref } from 'vue'
import {
  autoControlPoints,
  cloneGraph,
  createEdge,
  createEmptyGraph,
  createNode,
  graphToLines,
  linesToGraph,
  type EdgeAttributes,
  type EdgeType,
  type NodeAttributes,
  type NodeType,
  type PipeEdge,
  type PipeGraph,
  type PipeNode,
} from '~/utils/pipe2d-graph'
import type { Lines, Point } from '~/utils/pipe2d-geometry'

// ---------------------------------------------------------------------------
// 选中状态类型
// ---------------------------------------------------------------------------

export type SelectedElement =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edge'; edgeId: string }
  | null

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function usePipe2DEditorGraph(options: {
  /** 传入现有 draftLines ref（来自 usePipe2DEditorMap），初始化时从中推断图结构 */
  draftLines: Ref<Lines>
}) {
  const graph = ref<PipeGraph>(createEmptyGraph())
  const selected = ref<SelectedElement>(null)
  const graphHistory = ref<PipeGraph[]>([])
  const graphRedoHistory = ref<PipeGraph[]>([])

  // 唯一 id 生成器（每次调用 composable 重置）
  let nodeSeq = 0
  let edgeSeq = 0
  function nextNodeId() { return `node_${++nodeSeq}` }
  function nextEdgeId() { return `edge_${++edgeSeq}` }

  // draftLines（折线格式）由图派生，供旧渲染层使用
  const draftLines = computed<Lines>(() => graphToLines(graph.value))

  // ---------------------------------------------------------------------------
  // 初始化：从旧 Lines 格式推断图结构
  // ---------------------------------------------------------------------------

  function initFromLines(lines: Lines) {
    const inferred = linesToGraph(lines, 'n')
    // 对齐 seq 计数器
    nodeSeq = inferred.nodes.length
    edgeSeq = inferred.edges.length
    graph.value = inferred
    selected.value = null
    graphHistory.value = []
    graphRedoHistory.value = []
  }

  // 首次初始化
  if (options.draftLines.value.length > 0) {
    initFromLines(options.draftLines.value)
  }

  // ---------------------------------------------------------------------------
  // 历史（撤销/重做）
  // ---------------------------------------------------------------------------

  function pushGraphHistory() {
    graphHistory.value.push(cloneGraph(graph.value))
    if (graphHistory.value.length > 20) graphHistory.value.shift()
    graphRedoHistory.value = []
  }

  function undoGraph() {
    const prev = graphHistory.value.pop()
    if (!prev) return
    graphRedoHistory.value.push(cloneGraph(graph.value))
    graph.value = prev
    selected.value = null
  }

  function redoGraph() {
    const next = graphRedoHistory.value.pop()
    if (!next) return
    graphHistory.value.push(cloneGraph(graph.value))
    graph.value = next
    selected.value = null
  }

  // ---------------------------------------------------------------------------
  // 节点操作
  // ---------------------------------------------------------------------------

  function addNode(lon: number, lat: number, type: NodeType = 'default', attributes: NodeAttributes = {}): PipeNode {
    pushGraphHistory()
    const node = createNode(nextNodeId(), lon, lat, type, attributes)
    graph.value.nodes.push(node)
    selected.value = { kind: 'node', nodeId: node.id }
    return node
  }

  function removeNode(nodeId: string) {
    pushGraphHistory()
    graph.value.nodes = graph.value.nodes.filter(n => n.id !== nodeId)
    // 同时移除相关联的边
    graph.value.edges = graph.value.edges.filter(
      e => e.sourceId !== nodeId && e.targetId !== nodeId,
    )
    if (selected.value?.kind === 'node' && selected.value.nodeId === nodeId) {
      selected.value = null
    }
  }

  function updateNode(nodeId: string, patch: Partial<Omit<PipeNode, 'id'>>) {
    const node = graph.value.nodes.find(n => n.id === nodeId)
    if (!node) return
    pushGraphHistory()
    Object.assign(node, patch)
    if (patch.attributes) node.attributes = { ...node.attributes, ...patch.attributes }
  }

  function moveNode(nodeId: string, lon: number, lat: number) {
    const node = graph.value.nodes.find(n => n.id === nodeId)
    if (!node) return
    node.lon = lon
    node.lat = lat
    // 如果相关边是曲线，重新自动计算控制点
    for (const edge of graph.value.edges) {
      if (edge.edgeType !== 'curve' || !edge.controlPoints) continue
      if (edge.sourceId !== nodeId && edge.targetId !== nodeId) continue
      const src = graph.value.nodes.find(n => n.id === edge.sourceId)
      const tgt = graph.value.nodes.find(n => n.id === edge.targetId)
      if (!src || !tgt) continue
      edge.controlPoints = autoControlPoints([src.lon, src.lat], [tgt.lon, tgt.lat])
    }
  }

  // ---------------------------------------------------------------------------
  // 边操作
  // ---------------------------------------------------------------------------

  function addEdge(
    sourceId: string,
    targetId: string,
    edgeType: EdgeType = 'straight',
    attributes: EdgeAttributes = {},
  ): PipeEdge | null {
    const src = graph.value.nodes.find(n => n.id === sourceId)
    const tgt = graph.value.nodes.find(n => n.id === targetId)
    if (!src || !tgt) return null

    pushGraphHistory()
    let controlPoints: [Point, Point] | null = null
    if (edgeType === 'curve') {
      controlPoints = autoControlPoints([src.lon, src.lat], [tgt.lon, tgt.lat])
    }
    const edge = createEdge(nextEdgeId(), sourceId, targetId, edgeType, [], controlPoints, attributes)
    graph.value.edges.push(edge)
    selected.value = { kind: 'edge', edgeId: edge.id }
    return edge
  }

  function removeEdge(edgeId: string) {
    pushGraphHistory()
    graph.value.edges = graph.value.edges.filter(e => e.id !== edgeId)
    if (selected.value?.kind === 'edge' && selected.value.edgeId === edgeId) {
      selected.value = null
    }
  }

  function updateEdge(edgeId: string, patch: Partial<Omit<PipeEdge, 'id'>>) {
    const edge = graph.value.edges.find(e => e.id === edgeId)
    if (!edge) return
    pushGraphHistory()
    Object.assign(edge, patch)
    if (patch.attributes) edge.attributes = { ...edge.attributes, ...patch.attributes }
  }

  function toggleEdgeCurve(edgeId: string) {
    const edge = graph.value.edges.find(e => e.id === edgeId)
    if (!edge) return
    pushGraphHistory()
    if (edge.edgeType === 'straight') {
      const src = graph.value.nodes.find(n => n.id === edge.sourceId)
      const tgt = graph.value.nodes.find(n => n.id === edge.targetId)
      if (src && tgt) {
        edge.controlPoints = autoControlPoints([src.lon, src.lat], [tgt.lon, tgt.lat])
      }
      edge.edgeType = 'curve'
    } else {
      edge.edgeType = 'straight'
      edge.controlPoints = null
    }
  }

  // ---------------------------------------------------------------------------
  // 选中
  // ---------------------------------------------------------------------------

  function selectNode(nodeId: string) {
    selected.value = { kind: 'node', nodeId }
  }

  function selectEdge(edgeId: string) {
    selected.value = { kind: 'edge', edgeId }
  }

  function clearSelection() {
    selected.value = null
  }

  // ---------------------------------------------------------------------------
  // 便捷计算属性
  // ---------------------------------------------------------------------------

  const selectedNode = computed<PipeNode | null>(() => {
    const s = selected.value
    if (s?.kind !== 'node') return null
    return graph.value.nodes.find(n => n.id === s.nodeId) ?? null
  })

  const selectedEdge = computed<PipeEdge | null>(() => {
    const s = selected.value
    if (s?.kind !== 'edge') return null
    return graph.value.edges.find(e => e.id === s.edgeId) ?? null
  })

  const canUndoGraph = computed(() => graphHistory.value.length > 0)
  const canRedoGraph = computed(() => graphRedoHistory.value.length > 0)

  // ---------------------------------------------------------------------------
  // 公开
  // ---------------------------------------------------------------------------

  return {
    graph,
    draftLines,
    selected,
    selectedNode,
    selectedEdge,
    canUndoGraph,
    canRedoGraph,
    // init
    initFromLines,
    // history
    pushGraphHistory,
    undoGraph,
    redoGraph,
    // nodes
    addNode,
    removeNode,
    updateNode,
    moveNode,
    // edges
    addEdge,
    removeEdge,
    updateEdge,
    toggleEdgeCurve,
    // selection
    selectNode,
    selectEdge,
    clearSelection,
  }
}

