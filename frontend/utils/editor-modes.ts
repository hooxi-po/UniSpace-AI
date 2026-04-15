/**
 * 思维导图式编辑器模式定义
 *
 * 设计原则：
 * 1. 使用联合类型（Union Type）确保类型安全
 * 2. 每种模式携带必要的上下文数据
 * 3. 模式之间互斥，避免状态冲突
 */

import type { Point } from './pipe2d-geometry'

/**
 * 编辑器模式
 */
export type EditorMode =
  | IdleMode
  | EditTextMode
  | DragNodeMode
  | ConnectMode
  | BoxSelectMode
  | PanCanvasMode

/**
 * 空闲模式（默认）
 * - 可以点击选择节点
 * - 可以双击创建节点
 * - 可以使用快捷键
 */
export interface IdleMode {
  type: 'idle'
}

/**
 * 编辑文本模式
 * - 双击节点进入
 * - 显示输入框
 * - Enter 确认，Esc 取消
 */
export interface EditTextMode {
  type: 'editText'
  nodeId: string
  initialText: string
}

/**
 * 拖拽节点模式
 * - 按住节点拖拽进入
 * - 支持多选拖拽
 * - 显示拖拽预览
 */
export interface DragNodeMode {
  type: 'dragNode'
  nodeIds: string[]
  startPositions: Map<string, Point>  // 记录初始位置，用于撤销
  currentOffset: Point  // 当前偏移量
}

/**
 * 连接模式
 * - 从节点连接点拖拽进入
 * - 显示连接预览线
 * - 目标节点高亮
 */
export interface ConnectMode {
  type: 'connect'
  sourceNodeId: string
  sourceDirection: 'top' | 'right' | 'bottom' | 'left'
  previewTarget: Point | null  // 当前鼠标位置
  targetNodeId: string | null  // 悬停的目标节点
}

/**
 * 框选模式
 * - Shift + 拖拽进入
 * - 显示选择框
 * - 框内节点高亮
 */
export interface BoxSelectMode {
  type: 'boxSelect'
  startPoint: Point
  currentPoint: Point
  selectedNodeIds: Set<string>  // 当前框内的节点
}

/**
 * 平移画布模式
 * - 空格 + 拖拽进入
 * - 或中键拖拽
 * - 鼠标变为手型
 */
export interface PanCanvasMode {
  type: 'panCanvas'
  startViewport: { centerLon: number; centerLat: number }
  startMousePos: { x: number; y: number }
}

/**
 * 模式转换辅助函数
 */
export const EditorModeHelpers = {
  /**
   * 创建空闲模式
   */
  idle(): IdleMode {
    return { type: 'idle' }
  },

  /**
   * 创建编辑文本模式
   */
  editText(nodeId: string, initialText: string): EditTextMode {
    return { type: 'editText', nodeId, initialText }
  },

  /**
   * 创建拖拽节点模式
   */
  dragNode(nodeIds: string[], startPositions: Map<string, Point>): DragNodeMode {
    return {
      type: 'dragNode',
      nodeIds,
      startPositions,
      currentOffset: [0, 0],
    }
  },

  /**
   * 创建连接模式
   */
  connect(
    sourceNodeId: string,
    sourceDirection: 'top' | 'right' | 'bottom' | 'left'
  ): ConnectMode {
    return {
      type: 'connect',
      sourceNodeId,
      sourceDirection,
      previewTarget: null,
      targetNodeId: null,
    }
  },

  /**
   * 创建框选模式
   */
  boxSelect(startPoint: Point): BoxSelectMode {
    return {
      type: 'boxSelect',
      startPoint,
      currentPoint: startPoint,
      selectedNodeIds: new Set(),
    }
  },

  /**
   * 创建平移画布模式
   */
  panCanvas(
    startViewport: { centerLon: number; centerLat: number },
    startMousePos: { x: number; y: number }
  ): PanCanvasMode {
    return {
      type: 'panCanvas',
      startViewport,
      startMousePos,
    }
  },

  /**
   * 判断是否可以退出当前模式
   */
  canExit(mode: EditorMode): boolean {
    // 编辑文本模式需要确认或取消才能退出
    if (mode.type === 'editText') return false
    return true
  },

  /**
   * 获取模式的显示名称
   */
  getDisplayName(mode: EditorMode): string {
    switch (mode.type) {
      case 'idle':
        return '选择模式'
      case 'editText':
        return '编辑文本'
      case 'dragNode':
        return `拖拽 ${mode.nodeIds.length} 个节点`
      case 'connect':
        return '连接节点'
      case 'boxSelect':
        return '框选'
      case 'panCanvas':
        return '平移画布'
      default:
        return '未知模式'
    }
  },

  /**
   * 获取模式的提示文本
   */
  getHintText(mode: EditorMode): string {
    switch (mode.type) {
      case 'idle':
        return '双击空白创建节点 | 拖拽节点移动 | Tab 创建子节点'
      case 'editText':
        return '输入文本 | Enter 确认 | Esc 取消'
      case 'dragNode':
        return '拖拽移动节点 | 释放鼠标完成'
      case 'connect':
        return '拖拽到目标节点 | 释放鼠标创建连接'
      case 'boxSelect':
        return '拖拽选择多个节点 | 释放鼠标完成'
      case 'panCanvas':
        return '拖拽移动画布 | 释放鼠标完成'
      default:
        return ''
    }
  },

  /**
   * 获取鼠标样式
   */
  getCursorClass(mode: EditorMode): string {
    switch (mode.type) {
      case 'idle':
        return 'cursor-default'
      case 'editText':
        return 'cursor-text'
      case 'dragNode':
        return 'cursor-grabbing'
      case 'connect':
        return 'cursor-crosshair'
      case 'boxSelect':
        return 'cursor-crosshair'
      case 'panCanvas':
        return 'cursor-grab'
      default:
        return 'cursor-default'
    }
  },
}

/**
 * 选择状态
 */
export interface SelectionState {
  /** 选中的节点 ID 集合 */
  nodeIds: Set<string>
  /** 选中的边 ID 集合 */
  edgeIds: Set<string>
  /** 主选中项（用于 Tab/Enter 等操作的参考） */
  primary: { type: 'node' | 'edge'; id: string } | null
}

/**
 * 选择状态辅助函数
 */
export const SelectionHelpers = {
  /**
   * 创建空选择
   */
  empty(): SelectionState {
    return {
      nodeIds: new Set(),
      edgeIds: new Set(),
      primary: null,
    }
  },

  /**
   * 选中单个节点
   */
  selectNode(nodeId: string): SelectionState {
    return {
      nodeIds: new Set([nodeId]),
      edgeIds: new Set(),
      primary: { type: 'node', id: nodeId },
    }
  },

  /**
   * 选中单个边
   */
  selectEdge(edgeId: string): SelectionState {
    return {
      nodeIds: new Set(),
      edgeIds: new Set([edgeId]),
      primary: { type: 'edge', id: edgeId },
    }
  },

  /**
   * 添加节点到选择
   */
  addNode(state: SelectionState, nodeId: string): SelectionState {
    const newNodeIds = new Set(state.nodeIds)
    newNodeIds.add(nodeId)
    return {
      ...state,
      nodeIds: newNodeIds,
      primary: { type: 'node', id: nodeId },
    }
  },

  /**
   * 移除节点从选择
   */
  removeNode(state: SelectionState, nodeId: string): SelectionState {
    const newNodeIds = new Set(state.nodeIds)
    newNodeIds.delete(nodeId)
    return {
      ...state,
      nodeIds: newNodeIds,
      primary: newNodeIds.size > 0
        ? { type: 'node', id: Array.from(newNodeIds)[0] }
        : null,
    }
  },

  /**
   * 切换节点选择状态
   */
  toggleNode(state: SelectionState, nodeId: string): SelectionState {
    if (state.nodeIds.has(nodeId)) {
      return SelectionHelpers.removeNode(state, nodeId)
    } else {
      return SelectionHelpers.addNode(state, nodeId)
    }
  },

  /**
   * 判断是否有选中项
   */
  hasSelection(state: SelectionState): boolean {
    return state.nodeIds.size > 0 || state.edgeIds.size > 0
  },

  /**
   * 判断节点是否被选中
   */
  isNodeSelected(state: SelectionState, nodeId: string): boolean {
    return state.nodeIds.has(nodeId)
  },

  /**
   * 判断边是否被选中
   */
  isEdgeSelected(state: SelectionState, edgeId: string): boolean {
    return state.edgeIds.has(edgeId)
  },

  /**
   * 获取选中的节点数量
   */
  getNodeCount(state: SelectionState): number {
    return state.nodeIds.size
  },

  /**
   * 获取选中的边数量
   */
  getEdgeCount(state: SelectionState): number {
    return state.edgeIds.size
  },
}
