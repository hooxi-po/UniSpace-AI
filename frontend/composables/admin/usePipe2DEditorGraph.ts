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

type GraphMutationHelpers = {
  nextNodeId: () => string
  nextEdgeId: () => string
}

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

  function syncDraftLinesFromGraph() {
    options.draftLines.value = graphToLines(graph.value)
  }

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
    syncDraftLinesFromGraph()
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

  function applyGraphMutation(
    mutate: (graph: PipeGraph, helpers: GraphMutationHelpers) => SelectedElement | void,
  ) {
    pushGraphHistory()
    const nextSelected = mutate(graph.value, { nextNodeId, nextEdgeId })
    if (nextSelected !== undefined) {
      selected.value = nextSelected
    }
    syncDraftLinesFromGraph()
  }

  function undoGraph() {
    const prev = graphHistory.value.pop()
    if (!prev) return
    graphRedoHistory.value.push(cloneGraph(graph.value))
    graph.value = prev
    selected.value = null
    syncDraftLinesFromGraph()
  }

  function redoGraph() {
    const next = graphRedoHistory.value.pop()
    if (!next) return
    graphHistory.value.push(cloneGraph(graph.value))
    graph.value = next
    selected.value = null
    syncDraftLinesFromGraph()
  }

  // ---------------------------------------------------------------------------
  // 复合操作：插点（分裂边）/ 删点（合并边）
  // ---------------------------------------------------------------------------

  /**
   * 在一条边的中间插入新节点（适用于"插点"操作）。
   * 将原边 src→tgt 分裂为 src→new 和 new→tgt 两段，新节点自动选中。
   * 曲线边拆分后两段自动重新计算控制点。
   */
  function insertNodeOnEdge(edgeId: string, lon: number, lat: number): PipeNode | null {
    const edge = graph.value.edges.find(e => e.id === edgeId)
    if (!edge) return null
    pushGraphHistory()
    const newNode = createNode(nextNodeId(), lon, lat)
    graph.value.nodes.push(newNode)
    // 移除原边
    graph.value.edges = graph.value.edges.filter(e => e.id !== edgeId)
    // 保留原始边的 edgeType，曲线边拆分后重新计算控制点
    const srcNode = graph.value.nodes.find(n => n.id === edge.sourceId)
    const tgtNode = graph.value.nodes.find(n => n.id === edge.targetId)
    const cpA = edge.edgeType === 'curve' && srcNode
      ? autoControlPoints([srcNode.lon, srcNode.lat], [lon, lat])
      : null
    const cpB = edge.edgeType === 'curve' && tgtNode
      ? autoControlPoints([lon, lat], [tgtNode.lon, tgtNode.lat])
      : null
    const edgeA = createEdge(nextEdgeId(), edge.sourceId, newNode.id, edge.edgeType, [], cpA, { ...edge.attributes })
    const edgeB = createEdge(nextEdgeId(), newNode.id, edge.targetId, edge.edgeType, [], cpB, { ...edge.attributes })
    graph.value.edges.push(edgeA, edgeB)
    selected.value = { kind: 'node', nodeId: newNode.id }
    syncDraftLinesFromGraph()
    return newNode
  }

  /**
   * 删除节点并合并其两侧的边（适用于"删点"操作）。
   * - 度 = 2：删节点，合并两边为一条（端点 A→B）
   * - 度 = 1：删节点及其唯一边（删末端点）
   * - 度 = 0 或 > 2：仅删节点及全部相关边
   */
  function removeNodeMergeEdge(nodeId: string) {
    const node = graph.value.nodes.find(n => n.id === nodeId)
    if (!node) return
    pushGraphHistory()
    const connectedEdges = graph.value.edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId)
    if (connectedEdges.length === 2) {
      // 找到另外两个端节点
      const edgeA = connectedEdges[0]
      const edgeB = connectedEdges[1]
      const otherA = edgeA.sourceId === nodeId ? edgeA.targetId : edgeA.sourceId
      const otherB = edgeB.sourceId === nodeId ? edgeB.targetId : edgeB.sourceId
      // 移除原两边
      graph.value.edges = graph.value.edges.filter(e => e.id !== edgeA.id && e.id !== edgeB.id)
      // 合并为一条新边，保留边类型（如果任一边是曲线，则保留曲线类型）
      const mergedType = edgeA.edgeType === 'curve' || edgeB.edgeType === 'curve' ? 'curve' : 'straight'
      const nodeA = graph.value.nodes.find(n => n.id === otherA)
      const nodeB = graph.value.nodes.find(n => n.id === otherB)
      const mergedCp = mergedType === 'curve' && nodeA && nodeB
        ? autoControlPoints([nodeA.lon, nodeA.lat], [nodeB.lon, nodeB.lat])
        : null
      const merged = createEdge(nextEdgeId(), otherA, otherB, mergedType, [], mergedCp, { ...edgeA.attributes })
      graph.value.edges.push(merged)
    } else {
      // 度 ≠ 2：直接删除全部相关边
      graph.value.edges = graph.value.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId)
    }
    graph.value.nodes = graph.value.nodes.filter(n => n.id !== nodeId)
    if (selected.value?.kind === 'node' && selected.value.nodeId === nodeId) {
      selected.value = null
    }
    syncDraftLinesFromGraph()
  }

  // ---------------------------------------------------------------------------
  // 节点操作
  // ---------------------------------------------------------------------------

  function addNode(lon: number, lat: number, type: NodeType = 'default', attributes: NodeAttributes = {}): PipeNode {
    pushGraphHistory()
    const node = createNode(nextNodeId(), lon, lat, type, attributes)
    graph.value.nodes.push(node)
    selected.value = { kind: 'node', nodeId: node.id }
    syncDraftLinesFromGraph()
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
    syncDraftLinesFromGraph()
  }

  /**
   * 批量删除节点和边（原子操作，只 push 一次 history）。
   * 用于思维导图编辑器的多选删除。
   */
  function removeBatch(nodeIds: string[], edgeIds: string[]) {
    if (!nodeIds.length && !edgeIds.length) return
    pushGraphHistory()
    const nodeSet = new Set(nodeIds)
    const edgeSet = new Set(edgeIds)
    graph.value.nodes = graph.value.nodes.filter(n => !nodeSet.has(n.id))
    graph.value.edges = graph.value.edges.filter(
      e => !edgeSet.has(e.id) && !nodeSet.has(e.sourceId) && !nodeSet.has(e.targetId),
    )
    if (selected.value?.kind === 'node' && nodeSet.has(selected.value.nodeId)) {
      selected.value = null
    }
    if (selected.value?.kind === 'edge' && edgeSet.has(selected.value.edgeId)) {
      selected.value = null
    }
    syncDraftLinesFromGraph()
  }

  function updateNode(nodeId: string, patch: Partial<Omit<PipeNode, 'id'>>) {
    const node = graph.value.nodes.find(n => n.id === nodeId)
    if (!node) return
    pushGraphHistory()
    Object.assign(node, patch)
    if (patch.attributes) node.attributes = { ...node.attributes, ...patch.attributes }
    if ('lon' in patch || 'lat' in patch) {
      syncDraftLinesFromGraph()
    }
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
    syncDraftLinesFromGraph()
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
    syncDraftLinesFromGraph()
    return edge
  }

  function removeEdge(edgeId: string) {
    pushGraphHistory()
    graph.value.edges = graph.value.edges.filter(e => e.id !== edgeId)
    if (selected.value?.kind === 'edge' && selected.value.edgeId === edgeId) {
      selected.value = null
    }
    syncDraftLinesFromGraph()
  }

  function updateEdge(edgeId: string, patch: Partial<Omit<PipeEdge, 'id'>>) {
    const edge = graph.value.edges.find(e => e.id === edgeId)
    if (!edge) return
    pushGraphHistory()
    Object.assign(edge, patch)
    if (patch.attributes) edge.attributes = { ...edge.attributes, ...patch.attributes }
    if (
      'sourceId' in patch
      || 'targetId' in patch
      || 'edgeType' in patch
      || 'midPoints' in patch
      || 'controlPoints' in patch
    ) {
      syncDraftLinesFromGraph()
    }
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
    syncDraftLinesFromGraph()
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
    applyGraphMutation,
    undoGraph,
    redoGraph,
    // nodes
    addNode,
    removeNode,
    removeBatch,
    updateNode,
    moveNode,
    insertNodeOnEdge,
    removeNodeMergeEdge,
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
