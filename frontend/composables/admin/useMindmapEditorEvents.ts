/**
 * 思维导图编辑器事件处理
 *
 * 处理鼠标、键盘事件，实现思维导图式的交互
 *
 * 核心交互：
 * - 双击空白：创建节点
 * - 双击节点：编辑文本
 * - Tab：创建子节点
 * - Enter：创建兄弟节点
 * - Delete：删除选中
 * - Ctrl+点击：多选
 * - Shift+拖拽：框选
 */

import type { Ref } from 'vue'
import type { UseMindmapEditorReturn } from './useMindmapEditor'
import type { Point } from '~/utils/pipe2d-geometry'

export interface UseMindmapEditorEventsOptions {
  /** 思维导图编辑器实例 */
  editor: UseMindmapEditorReturn
  /** 屏幕坐标转世界坐标 */
  screenToLonLat: (screenPosition: { x: number; y: number }) => Point | null
  /** 拾取实体 */
  pickEntity: (screenPosition: { x: number; y: number }) => PickResult | null
  /** 地图容器引用（用于绑定事件） */
  mapContainerRef: Ref<HTMLDivElement | null>
  /** 是否打开（用于控制事件监听） */
  open: Ref<boolean>
}

export interface PickResult {
  type: 'node' | 'edge' | 'connectionPoint'
  nodeId?: string
  edgeId?: string
  direction?: 'top' | 'right' | 'bottom' | 'left'
}

export interface UseMindmapEditorEventsReturn {
  /** 处理画布点击 */
  handleCanvasClick: (event: PointerEvent) => void
  /** 处理画布双击 */
  handleCanvasDoubleClick: (event: PointerEvent) => void
  /** 处理键盘按下 */
  handleKeyDown: (event: KeyboardEvent) => void
  /** 处理键盘释放 */
  handleKeyUp: (event: KeyboardEvent) => void
  /** 绑定事件监听器 */
  bindEvents: () => void
  /** 解绑事件监听器 */
  unbindEvents: () => void
}

export function useMindmapEditorEvents(
  options: UseMindmapEditorEventsOptions
): UseMindmapEditorEventsReturn {
  const { editor, screenToLonLat, pickEntity, mapContainerRef, open } = options

  // ========== 辅助函数 ==========

  /**
   * 检查是否启用
   */
  function isEnabled(): boolean {
    return open.value === true
  }

  /**
   * 检查是否按下了修饰键
   */
  function hasModifier(event: MouseEvent | KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
  }

  // ========== 鼠标事件处理 ==========

  /**
   * 处理画布点击
   */
  function handleCanvasClick(event: PointerEvent): void {
    if (!isEnabled()) return

    const screenPos = { x: event.clientX, y: event.clientY }
    const target = pickEntity(screenPos)

    if (!target) {
      // 点击空白
      if (!event.ctrlKey && !event.metaKey) {
        editor.clearSelection()
      }
      return
    }

    if (target.type === 'node' && target.nodeId) {
      handleNodeClick(target.nodeId, event)
    } else if (target.type === 'edge' && target.edgeId) {
      handleEdgeClick(target.edgeId, event)
    } else if (target.type === 'connectionPoint' && target.nodeId && target.direction) {
      handleConnectionPointClick(target.nodeId, target.direction, event)
    }
  }

  /**
   * 处理节点点击
   */
  function handleNodeClick(nodeId: string, event: PointerEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击 → 多选
      editor.toggleNodeSelection(nodeId)
    } else if (event.shiftKey) {
      // Shift + 点击 → 连接（暂时简化，不检查 primary）
      // TODO: 实现连接逻辑
      console.log('Shift+click to connect', nodeId)
    } else {
      // 单击 → 选中
      editor.selectNode(nodeId)
    }
  }

  /**
   * 处理边点击
   */
  function handleEdgeClick(edgeId: string, event: PointerEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击 → 多选（暂不支持）
      return
    } else {
      // 单击 → 选中
      editor.selectEdge(edgeId)
    }
  }

  /**
   * 处理连接点点击
   */
  function handleConnectionPointClick(
    nodeId: string,
    direction: 'top' | 'right' | 'bottom' | 'left',
    event: PointerEvent
  ): void {
    // 进入连接模式
    editor.enterConnectMode(nodeId, direction)
  }

  /**
   * 处理画布双击
   */
  function handleCanvasDoubleClick(event: PointerEvent): void {
    if (!isEnabled()) return

    const screenPos = { x: event.clientX, y: event.clientY }
    const target = pickEntity(screenPos)

    if (!target) {
      // 双击空白 → 创建节点
      const point = screenToLonLat(screenPos)
      if (point) {
        editor.createNodeAt(point)
      }
    } else if (target.type === 'node' && target.nodeId) {
      // 双击节点 → 编辑文本
      editor.enterEditTextMode(target.nodeId)
    }
  }

  // ========== 键盘事件处理 ==========

  /**
   * 处理键盘按下
   */
  function handleKeyDown(event: KeyboardEvent): void {
    if (!isEnabled()) return

    // 在输入框中不处理快捷键
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return
    }

    // 编辑文本模式下的特殊处理
    if (editor.mode.value.type === 'editText') {
      handleEditTextModeKeyDown(event)
      return
    }

    // 全局快捷键
    handleGlobalKeyDown(event)
  }

  /**
   * 处理编辑文本模式下的键盘事件
   */
  function handleEditTextModeKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter 确认编辑
      event.preventDefault()
      editor.exitCurrentMode()
    } else if (event.key === 'Escape') {
      // Esc 取消编辑
      event.preventDefault()
      editor.exitCurrentMode()
    }
    // 其他键让输入框处理
  }

  /**
   * 处理全局快捷键
   */
  function handleGlobalKeyDown(event: KeyboardEvent): void {
    // Tab - 创建子节点
    if (event.key === 'Tab') {
      event.preventDefault()
      editor.createChildNode()
      return
    }

    // Enter - 创建兄弟节点
    if (event.key === 'Enter') {
      event.preventDefault()
      editor.createSiblingNode()
      return
    }

    // Delete/Backspace - 删除选中
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (editor.hasSelection.value) {
        editor.deleteSelected()
      }
      return
    }

    // Escape - 退出当前模式或清除选中
    if (event.key === 'Escape') {
      // 检查是否有需要处理的状态
      const hasMode = editor.mode.value.type !== 'idle'
      const hasSelection = editor.hasSelection.value

      if (hasMode || hasSelection) {
        event.preventDefault()
        event.stopPropagation() // 阻止事件冒泡到对话框的 ESC 处理器

        if (hasMode) {
          editor.exitCurrentMode()
        }
        if (hasSelection) {
          editor.clearSelection()
        }
      }
      // 如果既没有模式也没有选中，不处理，让对话框的 ESC 处理器关闭对话框
      return
    }

    // Ctrl/Cmd + Z - 撤销
    if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (event.shiftKey) {
        // Ctrl+Shift+Z = 重做
        editor.redo()
      } else {
        // Ctrl+Z = 撤销
        editor.undo()
      }
      return
    }

    // Ctrl/Cmd + Y - 重做
    if (event.key === 'y' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      editor.redo()
      return
    }

    // Ctrl/Cmd + D - 复制
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (editor.hasSelection.value) {
        editor.duplicateSelected()
      }
      return
    }

    // Ctrl/Cmd + A - 全选
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      editor.selectAll()
      return
    }
  }

  /**
   * 处理键盘释放
   */
  function handleKeyUp(event: KeyboardEvent): void {
    if (!isEnabled()) return
    // 暂时不需要处理
  }

  // ========== 事件绑定 ==========

  let eventsBound = false

  /**
   * 绑定事件监听器
   */
  function bindEvents(): void {
    if (eventsBound) return

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
    }

    // 绑定画布事件
    const container = mapContainerRef.value
    if (container) {
      container.addEventListener('click', handleCanvasClick as EventListener)
      container.addEventListener('dblclick', handleCanvasDoubleClick as EventListener)
    }

    eventsBound = true
  }

  /**
   * 解绑事件监听器
   */
  function unbindEvents(): void {
    if (!eventsBound) return

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }

    // 解绑画布事件
    const container = mapContainerRef.value
    if (container) {
      container.removeEventListener('click', handleCanvasClick as EventListener)
      container.removeEventListener('dblclick', handleCanvasDoubleClick as EventListener)
    }

    eventsBound = false
  }

  // ========== 返回 API ==========
  return {
    handleCanvasClick,
    handleCanvasDoubleClick,
    handleKeyDown,
    handleKeyUp,
    bindEvents,
    unbindEvents,
  }
}
