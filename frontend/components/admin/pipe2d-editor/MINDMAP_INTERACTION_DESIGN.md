# 思维导图式交互设计方案

## 目标

将管道编辑器重构为类似 XMind、Miro、Figma 的思维导图交互模式，提供直观、高效的节点编辑体验。

---

## 核心交互原则

### 1. 节点为中心（Node-Centric）

**传统思维导图**：
- 节点是第一公民
- 所有操作围绕节点展开
- 连接线是节点之间的关系

**当前管道编辑器**：
- Lines（坐标数组）为中心
- 需要先选择工具，再操作
- 连接线需要手动编辑坐标

**改进方向**：
- 图结构（Graph）为主，Lines 为辅
- 直接操作节点，自动生成连接线
- 工具栏变为辅助，主要靠快捷键

---

### 2. 直接操作（Direct Manipulation）

| 操作 | 传统思维导图 | 当前编辑器 | 改进方案 |
|------|-------------|-----------|---------|
| 创建节点 | 双击空白处 | 选择工具 → 点击 | 双击空白处 |
| 移动节点 | 直接拖拽 | 拖拽坐标点 | 直接拖拽节点 |
| 连接节点 | 从节点拖出 | 手动编辑线段 | 从节点拖出连接线 |
| 删除节点 | 选中 → Delete | 选择工具 → 点击 | 选中 → Delete |
| 编辑属性 | 双击节点 | 右侧面板 | 双击节点 + 右侧面板 |

---

### 3. 快捷键优先（Keyboard-First）

**核心快捷键**：

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| **双击空白** | 创建节点 | 在鼠标位置创建新节点 |
| **Tab** | 创建子节点 | 从选中节点创建连接的新节点 |
| **Enter** | 创建兄弟节点 | 在同一层级创建节点 |
| **Delete / Backspace** | 删除选中 | 删除节点或边 |
| **Ctrl/Cmd + D** | 复制节点 | 复制选中的节点 |
| **Ctrl/Cmd + Z** | 撤销 | 撤销上一步操作 |
| **Ctrl/Cmd + Y** | 重做 | 重做操作 |
| **Ctrl/Cmd + A** | 全选 | 选中所有节点 |
| **Ctrl/Cmd + 点击** | 多选 | 添加/移除选择 |
| **Shift + 拖拽** | 框选 | 框选多个节点 |
| **空格 + 拖拽** | 平移画布 | 移动视口 |
| **Ctrl/Cmd + 滚轮** | 缩放 | 缩放画布 |
| **方向键** | 移动选择 | 移动到相邻节点 |
| **Shift + 方向键** | 微调位置 | 精确移动节点 |

---

## 详细交互流程

### 1. 创建节点

#### 方式 A：双击空白处
```
用户操作：双击画布空白区域
系统响应：
  1. 在鼠标位置创建新节点
  2. 自动进入编辑模式（可输入文本）
  3. 按 Enter 确认，Esc 取消
```

#### 方式 B：Tab 键（创建子节点）
```
用户操作：选中节点 A → 按 Tab
系统响应：
  1. 在节点 A 右侧创建新节点 B
  2. 自动创建 A → B 的连接线
  3. 自动进入编辑模式
```

#### 方式 C：Enter 键（创建兄弟节点）
```
用户操作：选中节点 A → 按 Enter
系统响应：
  1. 在节点 A 下方创建新节点 C
  2. 如果 A 有父节点，自动连接父节点 → C
  3. 自动进入编辑模式
```

---

### 2. 连接节点

#### 方式 A：拖拽连接
```
用户操作：
  1. 鼠标悬停在节点 A 上
  2. 显示连接点（4 个方向）
  3. 从连接点拖拽到节点 B
  4. 释放鼠标

系统响应：
  1. 显示连接预览线（虚线）
  2. 目标节点高亮
  3. 创建 A → B 的连接线
  4. 自动选择合适的连接类型（直线/曲线）
```

#### 方式 B：快捷键连接
```
用户操作：
  1. 选中节点 A
  2. 按住 Shift + 点击节点 B

系统响应：
  1. 创建 A → B 的连接线
  2. 保持 A 的选中状态
```

---

### 3. 编辑节点

#### 双击编辑
```
用户操作：双击节点
系统响应：
  1. 进入文本编辑模式
  2. 显示输入框
  3. 自动选中现有文本
  4. Enter 确认，Esc 取消
```

#### 属性面板编辑
```
用户操作：选中节点 → 右侧面板修改
系统响应：
  1. 实时更新节点属性
  2. 显示预览效果
  3. 支持批量编辑（多选时）
```

---

### 4. 删除节点

```
用户操作：选中节点 → 按 Delete
系统响应：
  1. 删除节点
  2. 自动删除相关的连接线
  3. 如果有子节点，询问是否一并删除
  4. 支持撤销
```

---

### 5. 多选操作

#### Ctrl/Cmd + 点击
```
用户操作：按住 Ctrl/Cmd + 点击节点
系统响应：
  1. 添加到选择集
  2. 显示选中状态（高亮边框）
  3. 再次点击取消选择
```

#### Shift + 拖拽框选
```
用户操作：按住 Shift + 拖拽
系统响应：
  1. 显示选择框（虚线矩形）
  2. 框内节点高亮
  3. 释放鼠标后选中所有框内节点
```

#### 批量操作
```
选中多个节点后：
  - Delete：批量删除
  - 拖拽：批量移动
  - 属性面板：批量修改属性
  - Ctrl+D：批量复制
```

---

## 视觉反馈设计

### 1. 节点状态

| 状态 | 视觉效果 |
|------|---------|
| 默认 | 圆形，蓝色填充，白色边框 |
| 悬停 | 放大 1.1 倍，边框加粗 |
| 选中 | 蓝色边框 3px，显示控制点 |
| 多选 | 蓝色边框 2px |
| 编辑中 | 显示输入框，边框闪烁 |
| 拖拽中 | 半透明，显示阴影 |

### 2. 连接线状态

| 状态 | 视觉效果 |
|------|---------|
| 默认 | 灰色实线，2px |
| 悬停 | 蓝色，3px |
| 选中 | 蓝色，3px，显示控制点 |
| 预览 | 蓝色虚线，2px |

### 3. 连接点（Connection Points）

```
节点悬停时显示 4 个连接点：
  ┌─────┐
  │  ●  │  ← 上
● │     │ ●  ← 左右
  │  ●  │  ← 下
  └─────┘

拖拽时：
  - 连接点放大
  - 显示吸附提示
  - 目标节点高亮
```

---

## 技术实现方案

### 1. 状态管理重构

**当前架构**：
```typescript
// 主要状态
draftLines: Ref<Lines>  // 坐标数组
originalLines: Ref<Lines>
history: Ref<Lines[]>

// 图结构（辅助）
graph: Ref<PipeGraph>
```

**重构后架构**：
```typescript
// 主要状态（图结构优先）
graph: Ref<PipeGraph>  // 节点 + 边
selected: Ref<SelectedElement>  // 选中状态
graphHistory: Ref<PipeGraph[]>  // 历史记录

// Lines（派生状态，用于保存）
draftLines: ComputedRef<Lines>  // 从 graph 派生
```

### 2. 交互模式重构

**当前模式**：
```typescript
// 工具模式
activeTool: 'select' | 'addNode' | 'addPipe' | 'bindAsset'
addPointMode: boolean
deletePointMode: boolean
```

**重构后模式**：
```typescript
// 编辑器模式（更简洁）
type EditorMode =
  | { type: 'idle' }                    // 默认模式
  | { type: 'editText'; nodeId: string } // 编辑文本
  | { type: 'dragNode'; nodeIds: string[] } // 拖拽节点
  | { type: 'connect'; sourceId: string } // 连接模式
  | { type: 'boxSelect'; start: Point }  // 框选模式
  | { type: 'panCanvas' }                // 平移画布

const mode = ref<EditorMode>({ type: 'idle' })
```

### 3. 事件处理重构

**核心事件处理器**：

```typescript
// 1. 画布点击
function handleCanvasClick(event: PointerEvent) {
  const target = pickEntity(event.position)

  if (!target) {
    // 点击空白
    if (!event.ctrlKey && !event.metaKey) {
      clearSelection()
    }
    return
  }

  if (target.type === 'node') {
    handleNodeClick(target.nodeId, event)
  } else if (target.type === 'edge') {
    handleEdgeClick(target.edgeId, event)
  }
}

// 2. 画布双击
function handleCanvasDoubleClick(event: PointerEvent) {
  const target = pickEntity(event.position)

  if (!target) {
    // 双击空白 → 创建节点
    const point = screenToLonLat(event.position)
    createNodeAt(point)
  } else if (target.type === 'node') {
    // 双击节点 → 编辑文本
    enterEditMode(target.nodeId)
  }
}

// 3. 节点点击
function handleNodeClick(nodeId: string, event: PointerEvent) {
  if (event.ctrlKey || event.metaKey) {
    // Ctrl + 点击 → 多选
    toggleSelection(nodeId)
  } else if (event.shiftKey && selected.value?.kind === 'node') {
    // Shift + 点击 → 连接
    connectNodes(selected.value.nodeId, nodeId)
  } else {
    // 单击 → 选中
    selectNode(nodeId)
  }
}

// 4. 键盘事件
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    event.preventDefault()
    createChildNode()
  } else if (event.key === 'Enter') {
    if (mode.value.type === 'editText') {
      exitEditMode()
    } else {
      createSiblingNode()
    }
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelected()
  } else if (event.key === 'Escape') {
    exitCurrentMode()
  } else if (event.key === ' ') {
    enterPanMode()
  }
}
```

### 4. 连接点渲染

```typescript
// 节点悬停时显示连接点
function renderConnectionPoints(nodeId: string) {
  const node = graph.value.nodes.find(n => n.id === nodeId)
  if (!node) return

  const positions = [
    { dir: 'top', offset: [0, -20] },
    { dir: 'right', offset: [20, 0] },
    { dir: 'bottom', offset: [0, 20] },
    { dir: 'left', offset: [-20, 0] },
  ]

  for (const pos of positions) {
    const point = [node.lon + pos.offset[0] * 0.00001, node.lat + pos.offset[1] * 0.00001]
    viewer.entities.add({
      position: toCartesian(point),
      point: {
        pixelSize: 8,
        color: Cesium.Color.BLUE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      properties: {
        type: 'connectionPoint',
        nodeId,
        direction: pos.dir,
      }
    })
  }
}
```

---

## 实施计划

### Phase 1: 基础重构（2-3 天）

**目标**：建立图结构优先的架构

1. ✅ 图结构已存在（`usePipe2DEditorGraph.ts`）
2. 重构状态管理：
   - 将 `graph` 作为主要状态
   - `draftLines` 改为 computed
   - 迁移历史记录到 `graphHistory`
3. 重构模式管理：
   - 引入 `EditorMode` 类型
   - 替换现有的多个布尔值
4. 测试基础功能

### Phase 2: 核心交互（3-4 天）

**目标**：实现思维导图式的核心操作

1. 双击创建节点
2. Tab/Enter 快捷键创建
3. 拖拽连接节点
4. 双击编辑文本
5. Delete 删除节点
6. 基础视觉反馈

### Phase 3: 高级功能（2-3 天）

**目标**：多选、框选、批量操作

1. Ctrl + 点击多选
2. Shift + 拖拽框选
3. 批量移动/删除
4. 批量属性编辑
5. 连接点渲染

### Phase 4: 优化和测试（1-2 天）

**目标**：性能优化和用户体验打磨

1. 性能优化
2. 边界情况处理
3. 用户测试
4. 文档更新

**总计**：8-12 天

---

## 兼容性考虑

### 1. 数据格式兼容

```typescript
// 保存时仍使用 Lines 格式（兼容后端）
async function saveGeometry() {
  const lines = graphToLines(graph.value)
  await twinService.updatePipeGeometry(backendBaseUrl, featureId, {
    type: lines.length > 1 ? 'MultiLineString' : 'LineString',
    coordinates: lines.length > 1 ? lines : lines[0]
  })
}

// 加载时转换为 Graph
async function loadPipe(featureId: string) {
  const feature = await geoFeatureService.get(backendBaseUrl, featureId)
  const lines = geometryToLines(feature.geometry)
  const graph = linesToGraph(lines)
  // ...
}
```

### 2. 渐进式迁移

- 保留旧的 Lines 编辑模式（作为备选）
- 添加模式切换开关
- 用户可以选择使用新旧模式

---

## 参考案例

### XMind
- 优点：快捷键丰富，Tab/Enter 创建节点
- 缺点：连接线不够灵活

### Miro
- 优点：自由度高，拖拽连接直观
- 缺点：快捷键较少

### Figma
- 优点：多选和批量操作强大
- 缺点：不是专门的思维导图工具

### 我们的方案
- 结合三者优点
- 针对管道编辑场景优化
- 保持专业性和易用性的平衡

---

## 风险和挑战

### 1. 学习曲线
- **风险**：用户需要适应新的交互模式
- **缓解**：提供引导教程，保留旧模式作为备选

### 2. 性能问题
- **风险**：大量节点时渲染性能下降
- **缓解**：虚拟化渲染，只渲染视口内节点

### 3. 兼容性
- **风险**：与现有数据格式不兼容
- **缓解**：保持 Lines 格式作为存储格式，Graph 仅用于编辑

### 4. 开发时间
- **风险**：重构工作量大
- **缓解**：分阶段实施，每个阶段都可独立交付

---

## 成功指标

### 用户体验指标
- 创建节点时间：< 2 秒
- 连接节点时间：< 3 秒
- 学习时间：< 10 分钟
- 用户满意度：> 4.5/5

### 性能指标
- 支持节点数：> 500
- 拖拽延迟：< 16ms
- 渲染 FPS：> 55

### 功能完整性
- 核心快捷键覆盖率：> 90%
- 操作可撤销率：100%
- 数据兼容性：100%

---

**最后更新**：2026-03-28
**状态**：设计阶段
**负责人**：Claude
