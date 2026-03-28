# 思维导图式交互重构 - 实施路线图

## 概述

本文档详细说明如何将管道编辑器重构为思维导图式交互模式，包括具体的代码修改步骤和测试计划。

---

## 已完成的准备工作 ✅

1. **设计文档**：`MINDMAP_INTERACTION_DESIGN.md`
2. **类型定义**：`utils/editor-modes.ts`
3. **吸附辅助**：`utils/snap-helpers.ts`
4. **图结构基础**：`composables/admin/usePipe2DEditorGraph.ts`（已存在）

---

## Phase 1: 核心架构重构（优先级：高）

### 目标
建立以图结构为中心的编辑架构，替换现有的 Lines 中心模式。

### 1.1 创建新的 Composable

**文件**：`frontend/composables/admin/useMindmapEditor.ts`

```typescript
/**
 * 思维导图式编辑器核心逻辑
 * 整合图结构、模式管理、选择状态
 */
import { ref, computed, watch } from 'vue'
import { usePipe2DEditorGraph } from './usePipe2DEditorGraph'
import { EditorModeHelpers, SelectionHelpers, type EditorMode, type SelectionState } from '~/utils/editor-modes'

export function useMindmapEditor(options: {
  draftLines: Ref<Lines>
  backendBaseUrl: Ref<string>
}) {
  // 图结构管理
  const graphEditor = usePipe2DEditorGraph({ draftLines: options.draftLines })

  // 编辑器模式
  const mode = ref<EditorMode>(EditorModeHelpers.idle())

  // 选择状态
  const selection = ref<SelectionState>(SelectionHelpers.empty())

  // 派生状态
  const isIdle = computed(() => mode.value.type === 'idle')
  const hasSelection = computed(() => SelectionHelpers.hasSelection(selection.value))
  const selectedNodeCount = computed(() => SelectionHelpers.getNodeCount(selection.value))

  // 模式提示
  const modeHint = computed(() => EditorModeHelpers.getHintText(mode.value))
  const cursorClass = computed(() => EditorModeHelpers.getCursorClass(mode.value))

  // 核心操作
  function createNodeAt(point: Point, text = '新节点') {
    const nodeId = graphEditor.addNode(point, 'default', { label: text })
    selection.value = SelectionHelpers.selectNode(nodeId)
    mode.value = EditorModeHelpers.editText(nodeId, text)
  }

  function createChildNode() {
    if (!selection.value.primary || selection.value.primary.type !== 'node') return

    const parentNode = graphEditor.graph.value.nodes.find(n => n.id === selection.value.primary!.id)
    if (!parentNode) return

    // 在父节点右侧创建子节点
    const childPoint: Point = [parentNode.lon + 0.001, parentNode.lat]
    const childId = graphEditor.addNode(childPoint, 'default', { label: '新节点' })

    // 创建连接
    graphEditor.addEdge(selection.value.primary.id, childId, 'straight')

    // 选中新节点并进入编辑模式
    selection.value = SelectionHelpers.selectNode(childId)
    mode.value = EditorModeHelpers.editText(childId, '新节点')
  }

  function deleteSelected() {
    for (const nodeId of selection.value.nodeIds) {
      graphEditor.removeNode(nodeId)
    }
    for (const edgeId of selection.value.edgeIds) {
      graphEditor.removeEdge(edgeId)
    }
    selection.value = SelectionHelpers.empty()
  }

  function exitCurrentMode() {
    if (EditorModeHelpers.canExit(mode.value)) {
      mode.value = EditorModeHelpers.idle()
    }
  }

  return {
    // 状态
    graph: graphEditor.graph,
    mode,
    selection,
    isIdle,
    hasSelection,
    selectedNodeCount,
    modeHint,
    cursorClass,

    // 图操作
    addNode: graphEditor.addNode,
    addEdge: graphEditor.addEdge,
    removeNode: graphEditor.removeNode,
    removeEdge: graphEditor.removeEdge,
    updateNode: graphEditor.updateNode,
    updateEdge: graphEditor.updateEdge,

    // 高级操作
    createNodeAt,
    createChildNode,
    deleteSelected,
    exitCurrentMode,

    // 历史
    undo: graphEditor.undoGraph,
    redo: graphEditor.redoGraph,
    canUndo: graphEditor.canUndo,
    canRedo: graphEditor.canRedo,
  }
}
```

### 1.2 修改主容器组件

**文件**：`frontend/components/admin/Pipe2DEditorDialog.vue`

**修改点**：
1. 引入 `useMindmapEditor`
2. 替换现有的状态管理
3. 更新事件处理

```typescript
// 旧代码
const {
  history,
  mapView,
  activeLineIndex,
  selectedPoint,
  // ...
} = usePipe2DEditorMap({ ... })

// 新代码
const mindmapEditor = useMindmapEditor({
  draftLines,
  backendBaseUrl: toRef(props, 'backendBaseUrl')
})

// 保留地图交互（但简化）
const mapInteraction = usePipe2DEditorMapInteraction({
  graph: mindmapEditor.graph,
  mode: mindmapEditor.mode,
  selection: mindmapEditor.selection,
  // ...
})
```

---

## Phase 2: 事件处理重构（优先级：高）

### 2.1 创建事件处理 Composable

**文件**：`frontend/composables/admin/useMindmapEditorEvents.ts`

```typescript
/**
 * 思维导图编辑器事件处理
 * 处理鼠标、键盘、触摸事件
 */
export function useMindmapEditorEvents(options: {
  graph: Ref<PipeGraph>
  mode: Ref<EditorMode>
  selection: Ref<SelectionState>
  createNodeAt: (point: Point, text?: string) => void
  createChildNode: () => void
  deleteSelected: () => void
  exitCurrentMode: () => void
  // ...
}) {
  // 画布点击
  function handleCanvasClick(event: PointerEvent) {
    const target = pickEntity(event.position)

    if (!target) {
      // 点击空白
      if (!event.ctrlKey && !event.metaKey) {
        options.selection.value = SelectionHelpers.empty()
      }
      return
    }

    if (target.type === 'node') {
      handleNodeClick(target.nodeId, event)
    }
  }

  // 画布双击
  function handleCanvasDoubleClick(event: PointerEvent) {
    const target = pickEntity(event.position)

    if (!target) {
      // 双击空白 → 创建节点
      const point = screenToLonLat(event.position)
      if (point) {
        options.createNodeAt(point)
      }
    } else if (target.type === 'node') {
      // 双击节点 → 编辑文本
      options.mode.value = EditorModeHelpers.editText(target.nodeId, getNodeLabel(target.nodeId))
    }
  }

  // 键盘事件
  function handleKeyDown(event: KeyboardEvent) {
    // 阻止默认行为
    const shouldPreventDefault = ['Tab', 'Enter', 'Delete', 'Backspace', ' '].includes(event.key)
    if (shouldPreventDefault) {
      event.preventDefault()
    }

    // 编辑模式下的特殊处理
    if (options.mode.value.type === 'editText') {
      if (event.key === 'Enter') {
        // 确认编辑
        options.exitCurrentMode()
      } else if (event.key === 'Escape') {
        // 取消编辑
        options.exitCurrentMode()
      }
      return
    }

    // 全局快捷键
    if (event.key === 'Tab') {
      options.createChildNode()
    } else if (event.key === 'Enter') {
      // TODO: 创建兄弟节点
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      options.deleteSelected()
    } else if (event.key === 'Escape') {
      options.exitCurrentMode()
    } else if (event.key === ' ') {
      // TODO: 进入平移模式
    } else if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      // 撤销
      if (event.shiftKey) {
        // Ctrl+Shift+Z = 重做
        // TODO: redo
      } else {
        // Ctrl+Z = 撤销
        // TODO: undo
      }
    }
  }

  return {
    handleCanvasClick,
    handleCanvasDoubleClick,
    handleKeyDown,
  }
}
```

### 2.2 绑定事件

**文件**：`frontend/composables/admin/usePipe2DEditorMap.ts`

**修改点**：
1. 移除旧的事件处理逻辑
2. 集成新的事件处理器

```typescript
// 在 ensureMapReady() 中
const events = useMindmapEditorEvents({
  graph: mindmapEditor.graph,
  mode: mindmapEditor.mode,
  selection: mindmapEditor.selection,
  createNodeAt: mindmapEditor.createNodeAt,
  createChildNode: mindmapEditor.createChildNode,
  deleteSelected: mindmapEditor.deleteSelected,
  exitCurrentMode: mindmapEditor.exitCurrentMode,
})

// 绑定事件
viewer.screenSpaceEventHandler.setInputAction(
  events.handleCanvasClick,
  Cesium.ScreenSpaceEventType.LEFT_CLICK
)

viewer.screenSpaceEventHandler.setInputAction(
  events.handleCanvasDoubleClick,
  Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
)

window.addEventListener('keydown', events.handleKeyDown)
```

---

## Phase 3: 渲染优化（优先级：中）

### 3.1 节点渲染增强

**目标**：
- 显示节点类型图标
- 悬停效果
- 选中状态
- 连接点

**文件**：`frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`

**修改点**：

```typescript
function renderNode(node: PipeNode, isSelected: boolean, isHovered: boolean) {
  const viewer = options.getViewer()
  if (!viewer) return

  // 基础样式
  const baseSize = 12
  const size = isHovered ? baseSize * 1.2 : baseSize
  const outlineWidth = isSelected ? 3 : 2

  // 节点实体
  const entity = viewer.entities.add({
    position: toCartesian([node.lon, node.lat]),
    point: {
      pixelSize: size,
      color: Cesium.Color.fromCssColorString(NODE_TYPE_COLORS[node.type]),
      outlineColor: isSelected ? Cesium.Color.BLUE : Cesium.Color.WHITE,
      outlineWidth,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: node.attributes.label || '',
      font: '14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    properties: {
      type: 'node',
      nodeId: node.id,
    }
  })

  // 悬停时显示连接点
  if (isHovered) {
    renderConnectionPoints(node.id)
  }

  return entity
}
```

### 3.2 连接点渲染

```typescript
function renderConnectionPoints(nodeId: string) {
  const node = graph.value.nodes.find(n => n.id === nodeId)
  if (!node) return

  const directions = [
    { dir: 'top', offset: [0, -0.0002] },
    { dir: 'right', offset: [0.0002, 0] },
    { dir: 'bottom', offset: [0, 0.0002] },
    { dir: 'left', offset: [-0.0002, 0] },
  ]

  for (const { dir, offset } of directions) {
    const point: Point = [node.lon + offset[0], node.lat + offset[1]]
    viewer.entities.add({
      position: toCartesian(point),
      point: {
        pixelSize: 8,
        color: Cesium.Color.BLUE.withAlpha(0.8),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        type: 'connectionPoint',
        nodeId,
        direction: dir,
      }
    })
  }
}
```

---

## Phase 4: 测试和优化（优先级：中）

### 4.1 单元测试

**文件**：`frontend/composables/admin/__tests__/useMindmapEditor.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { useMindmapEditor } from '../useMindmapEditor'

describe('useMindmapEditor', () => {
  it('should create node at position', () => {
    const editor = useMindmapEditor({ draftLines: ref([]), backendBaseUrl: ref('') })
    editor.createNodeAt([119.1, 26.0], '测试节点')

    expect(editor.graph.value.nodes).toHaveLength(1)
    expect(editor.graph.value.nodes[0].attributes.label).toBe('测试节点')
  })

  it('should create child node with Tab', () => {
    const editor = useMindmapEditor({ draftLines: ref([]), backendBaseUrl: ref('') })
    editor.createNodeAt([119.1, 26.0], '父节点')
    editor.createChildNode()

    expect(editor.graph.value.nodes).toHaveLength(2)
    expect(editor.graph.value.edges).toHaveLength(1)
  })

  it('should delete selected nodes', () => {
    const editor = useMindmapEditor({ draftLines: ref([]), backendBaseUrl: ref('') })
    editor.createNodeAt([119.1, 26.0], '节点1')
    editor.createNodeAt([119.2, 26.1], '节点2')

    editor.deleteSelected()

    expect(editor.graph.value.nodes).toHaveLength(1)
  })
})
```

### 4.2 E2E 测试

**文件**：`e2e/mindmap-editor.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('should create node on double click', async ({ page }) => {
  await page.goto('/admin-pipe-editor')

  // 双击画布
  await page.locator('.mars-canvas').dblclick({ position: { x: 400, y: 300 } })

  // 应该显示输入框
  await expect(page.locator('[data-testid="node-text-input"]')).toBeVisible()

  // 输入文本
  await page.keyboard.type('新节点')
  await page.keyboard.press('Enter')

  // 节点应该被创建
  await expect(page.locator('[data-node-label="新节点"]')).toBeVisible()
})

test('should create child node with Tab', async ({ page }) => {
  await page.goto('/admin-pipe-editor')

  // 创建父节点
  await page.locator('.mars-canvas').dblclick({ position: { x: 400, y: 300 } })
  await page.keyboard.type('父节点')
  await page.keyboard.press('Enter')

  // 按 Tab 创建子节点
  await page.keyboard.press('Tab')
  await page.keyboard.type('子节点')
  await page.keyboard.press('Enter')

  // 应该有两个节点和一条连接线
  await expect(page.locator('[data-node-label="父节点"]')).toBeVisible()
  await expect(page.locator('[data-node-label="子节点"]')).toBeVisible()
  await expect(page.locator('[data-edge-count]')).toHaveText('1')
})
```

---

## 实施时间表

| 阶段 | 任务 | 预计时间 | 依赖 |
|------|------|---------|------|
| Phase 1 | 创建 useMindmapEditor | 4 小时 | - |
| Phase 1 | 修改主容器组件 | 3 小时 | useMindmapEditor |
| Phase 2 | 创建事件处理器 | 4 小时 | Phase 1 |
| Phase 2 | 绑定事件 | 2 小时 | 事件处理器 |
| Phase 3 | 节点渲染增强 | 3 小时 | Phase 2 |
| Phase 3 | 连接点渲染 | 2 小时 | 节点渲染 |
| Phase 4 | 单元测试 | 3 小时 | Phase 1-3 |
| Phase 4 | E2E 测试 | 2 小时 | Phase 1-3 |
| Phase 4 | 优化和调试 | 4 小时 | 所有阶段 |

**总计**：27 小时（约 3-4 个工作日）

---

## 风险缓解

### 风险 1：破坏现有功能
**缓解措施**：
- 保留旧代码作为备份
- 添加功能开关，可以切换新旧模式
- 充分测试后再删除旧代码

### 风险 2：性能下降
**缓解措施**：
- 使用 requestAnimationFrame 优化渲染
- 虚拟化大量节点
- 性能监控和基准测试

### 风险 3：学习曲线
**缓解措施**：
- 提供交互式教程
- 添加操作提示
- 保留旧模式作为备选

---

## 验收标准

### 功能完整性
- [ ] 双击创建节点
- [ ] Tab 创建子节点
- [ ] Enter 创建兄弟节点
- [ ] 拖拽移动节点
- [ ] 拖拽连接节点
- [ ] Delete 删除节点
- [ ] Ctrl+Z 撤销
- [ ] Ctrl+Y 重做
- [ ] Ctrl+点击多选
- [ ] Shift+拖拽框选

### 性能指标
- [ ] 支持 500+ 节点
- [ ] 拖拽延迟 < 16ms
- [ ] 渲染 FPS > 55

### 用户体验
- [ ] 操作提示清晰
- [ ] 视觉反馈及时
- [ ] 学习时间 < 10 分钟

---

## 下一步行动

1. **立即开始**：创建 `useMindmapEditor.ts`
2. **并行开发**：事件处理和渲染可以并行
3. **持续测试**：每完成一个功能就测试
4. **用户反馈**：尽早让用户试用，收集反馈

---

**最后更新**：2026-03-28
**状态**：准备开始实施
**负责人**：Claude
