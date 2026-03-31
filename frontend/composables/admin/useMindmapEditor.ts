/**
 * 思维导图编辑器核心逻辑
 *
 * 提供思维导图式的节点和边编辑功能
 * 集成 usePipe2DEditorGraph 作为底层图结构管理
 */

import { computed, ref, type Ref } from 'vue'
import type { Lines, Point } from '~/utils/pipe2d-geometry'
import type { NodeType, EdgeType } from '~/utils/pipe2d-graph'
import type { EditorMode } from '~/utils/editor-modes'
import { EditorModeHelpers } from '~/utils/editor-modes'
import { usePipe2DEditorGraph } from './usePipe2DEditorGraph'

export interface UseMindmapEditorOptions {
  /** 传入现有 draftLines ref（用于初始化和保存） */
  draftLines: Ref<Lines>
  /** 图结构编辑器实例（必须与地图编辑器共享同一个实例） */
  editorGraph: ReturnType<typeof usePipe2DEditorGraph>
}

export interface UseMindmapEditorReturn {
  // ========== 状态 ==========
  /** 当前编辑模式 */
  mode: Ref<EditorMode>
  /** 选中的节点 ID 集合 */
  selectedNodeIds: Ref<Set<string>>
  /** 选中的边 ID 集合 */
  selectedEdgeIds: Ref<Set<string>>
  /** 悬停的节点 ID */
  hoveredNodeId: Ref<string | null>
  /** 悬停的边 ID */
  hoveredEdgeId: Ref<string | null>

  // ========== 计算属性 ==========
  /** 模式提示文本 */
  modeHint: Ref<string>
  /** 光标样式类名 */
  cursorClass: Ref<string>
  /** 是否可以撤销 */
  canUndo: Ref<boolean>
  /** 是否可以重做 */
  canRedo: Ref<boolean>
  /** 是否有选中内容 */
  hasSelection: Ref<boolean>

  // ========== 操作方法 ==========
  /** 在指定位置创建节点 */
  createNodeAt: (point: Point, text?: string, type?: NodeType) => void
  /** 创建子节点（Tab 键） */
  createChildNode: () => void
  /** 创建兄弟节点（Enter 键） */
  createSiblingNode: () => void
  /** 连接两个节点 */
  connectNodes: (sourceId: string, targetId: string, type?: EdgeType) => void
  /** 删除选中内容 */
  deleteSelected: () => void
  /** 复制选中内容 */
  duplicateSelected: () => void
  /** 选中节点 */
  selectNode: (nodeId: string) => void
  /** 选中边 */
  selectEdge: (edgeId: string) => void
  /** 切换节点选中状态 */
  toggleNodeSelection: (nodeId: string) => void
  /** 清除选中 */
  clearSelection: () => void
  /** 全选 */
  selectAll: () => void
  /** 撤销 */
  undo: () => void
  /** 重做 */
  redo: () => void
  /** 退出当前模式 */
  exitCurrentMode: () => void
  /** 进入连接模式 */
  enterConnectMode: (nodeId: string, direction: string) => void
  /** 进入编辑文本模式 */
  enterEditTextMode: (nodeId: string) => void
}

export function useMindmapEditor(
  options: UseMindmapEditorOptions
): UseMindmapEditorReturn {
  // ========== 使用外部传入的图结构编辑器（与地图编辑器共享） ==========
  const graphEditor = options.editorGraph

  // ========== 状态 ==========
  const mode = ref<EditorMode>(EditorModeHelpers.idle())
  const selectedNodeIds = ref<Set<string>>(new Set())
  const selectedEdgeIds = ref<Set<string>>(new Set())
  const hoveredNodeId = ref<string | null>(null)
  const hoveredEdgeId = ref<string | null>(null)

  // ========== 计算属性 ==========
  const modeHint = computed(() => {
    if (mode.value.type === 'idle') {
      return '双击空白创建节点 | Tab 创建子节点 | Enter 创建兄弟节点'
    }
    if (mode.value.type === 'editText') {
      return '编辑节点文本 | Enter 完成 | Esc 取消'
    }
    if (mode.value.type === 'dragNode') {
      return '拖拽节点移动位置'
    }
    if (mode.value.type === 'connect') {
      return 'Shift+点击目标节点完成连接 | Esc 取消'
    }
    if (mode.value.type === 'boxSelect') {
      return '框选多个节点'
    }
    if (mode.value.type === 'panCanvas') {
      return '拖拽画布平移视图'
    }
    return ''
  })

  const cursorClass = computed(() => {
    if (mode.value.type === 'connect') return 'cursor--crosshair'
    if (mode.value.type === 'boxSelect') return 'cursor--crosshair'
    if (mode.value.type === 'panCanvas') return 'cursor--grab'
    if (mode.value.type === 'dragNode') return 'cursor--grabbing'
    return ''
  })

  const canUndo = computed(() => graphEditor.canUndoGraph.value)
  const canRedo = computed(() => graphEditor.canRedoGraph.value)

  const hasSelection = computed(() => {
    return selectedNodeIds.value.size > 0 || selectedEdgeIds.value.size > 0
  })

  // ========== 操作方法 ==========

  function createNodeAt(point: Point, text = '新节点', type: NodeType = 'default'): void {
    const [lon, lat] = point
    const node = graphEditor.addNode(lon, lat, type, { label: text })

    // 选中新创建的节点（同步两套选中状态）
    selectedNodeIds.value.clear()
    selectedEdgeIds.value.clear()
    selectedNodeIds.value.add(node.id)
    graphEditor.selectNode(node.id)
  }

  function createChildNode(): void {
    // 获取当前选中的节点
    if (selectedNodeIds.value.size !== 1) {
      console.warn('createChildNode: 需要选中一个节点')
      return
    }

    const parentId = Array.from(selectedNodeIds.value)[0]
    const parentNode = graphEditor.graph.value.nodes.find(n => n.id === parentId)
    if (!parentNode) return

    // 在父节点右侧创建子节点
    const offsetLon = 0.0005 // 约 50 米
    const childNode = graphEditor.addNode(
      parentNode.lon + offsetLon,
      parentNode.lat,
      'default',
      { label: '新节点' }
    )

    // 连接父节点到子节点
    graphEditor.addEdge(parentId, childNode.id, 'straight')

    // 选中新节点
    selectedNodeIds.value.clear()
    selectedNodeIds.value.add(childNode.id)
    graphEditor.selectNode(childNode.id)
  }

  function createSiblingNode(): void {
    // 获取当前选中的节点
    if (selectedNodeIds.value.size !== 1) {
      console.warn('createSiblingNode: 需要选中一个节点')
      return
    }

    const siblingId = Array.from(selectedNodeIds.value)[0]
    const siblingNode = graphEditor.graph.value.nodes.find(n => n.id === siblingId)
    if (!siblingNode) return

    // 在兄弟节点下方创建新节点
    const offsetLat = -0.0003 // 约 30 米
    const newNode = graphEditor.addNode(
      siblingNode.lon,
      siblingNode.lat + offsetLat,
      'default',
      { label: '新节点' }
    )

    // 复用兄弟节点的父连接（共享同一父节点）
    const parentEdge = graphEditor.graph.value.edges.find(e => e.targetId === siblingId)
    if (parentEdge) {
      graphEditor.addEdge(parentEdge.sourceId, newNode.id, 'straight')
    }

    // 选中新节点
    selectedNodeIds.value.clear()
    selectedNodeIds.value.add(newNode.id)
    graphEditor.selectNode(newNode.id)
  }

  function connectNodes(sourceId: string, targetId: string, type: EdgeType = 'straight'): void {
    graphEditor.addEdge(sourceId, targetId, type)
  }

  function deleteSelected(): void {
    // 删除选中的节点
    selectedNodeIds.value.forEach(nodeId => {
      graphEditor.removeNode(nodeId)
    })

    // 删除选中的边
    selectedEdgeIds.value.forEach(edgeId => {
      graphEditor.removeEdge(edgeId)
    })

    // 清除选中
    selectedNodeIds.value.clear()
    selectedEdgeIds.value.clear()
  }

  function duplicateSelected(): void {
    // TODO: 实现复制逻辑
    console.log('duplicateSelected - 待实现')
  }

  function selectNode(nodeId: string): void {
    selectedNodeIds.value.clear()
    selectedEdgeIds.value.clear()
    selectedNodeIds.value.add(nodeId)
    graphEditor.selectNode(nodeId)
  }

  function selectEdge(edgeId: string): void {
    selectedNodeIds.value.clear()
    selectedEdgeIds.value.clear()
    selectedEdgeIds.value.add(edgeId)
    graphEditor.selectEdge(edgeId)
  }

  function toggleNodeSelection(nodeId: string): void {
    if (selectedNodeIds.value.has(nodeId)) {
      selectedNodeIds.value.delete(nodeId)
      if (selectedNodeIds.value.size === 0) {
        graphEditor.clearSelection()
      } else {
        // 将 graphEditor 指向集合中仍然选中的任意一个节点
        const remaining = Array.from(selectedNodeIds.value)[selectedNodeIds.value.size - 1]
        graphEditor.selectNode(remaining)
      }
    } else {
      selectedNodeIds.value.add(nodeId)
      graphEditor.selectNode(nodeId)
    }
  }

  function clearSelection(): void {
    selectedNodeIds.value.clear()
    selectedEdgeIds.value.clear()
    graphEditor.clearSelection()
  }

  function selectAll(): void {
    selectedNodeIds.value.clear()
    selectedEdgeIds.value.clear()
    graphEditor.graph.value.nodes.forEach(node => {
      selectedNodeIds.value.add(node.id)
    })
  }

  function undo(): void {
    graphEditor.undoGraph()
  }

  function redo(): void {
    graphEditor.redoGraph()
  }

  function exitCurrentMode(): void {
    mode.value = EditorModeHelpers.idle()
  }

  function enterConnectMode(nodeId: string, direction: string): void {
    mode.value = EditorModeHelpers.connect(nodeId, direction as any)
  }

  function enterEditTextMode(nodeId: string): void {
    mode.value = EditorModeHelpers.editText(nodeId, '')
  }

  // ========== 返回 API ==========

  return {
    // 状态
    mode,
    selectedNodeIds,
    selectedEdgeIds,
    hoveredNodeId,
    hoveredEdgeId,

    // 计算属性
    modeHint,
    cursorClass,
    canUndo,
    canRedo,
    hasSelection,

    // 操作方法
    createNodeAt,
    createChildNode,
    createSiblingNode,
    connectNodes,
    deleteSelected,
    duplicateSelected,
    selectNode,
    selectEdge,
    toggleNodeSelection,
    clearSelection,
    selectAll,
    undo,
    redo,
    exitCurrentMode,
    enterConnectMode,
    enterEditTextMode,
  }
}
