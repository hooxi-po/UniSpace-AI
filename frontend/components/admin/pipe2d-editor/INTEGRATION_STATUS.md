# 思维导图编辑器集成状态

## 已完成 ✅

### Phase 1.1: 核心架构重构
- ✅ 创建 `utils/editor-modes.ts` - 类型安全的编辑器模式定义
- ✅ 创建 `composables/admin/useMindmapEditor.ts` - 核心状态管理（简化版）
- ✅ 创建 `composables/admin/useMindmapEditorEvents.ts` - 事件处理

### Phase 1.2: 主容器组件集成
- ✅ 在 `Pipe2DEditorDialog.vue` 中引入 `useMindmapEditor`
- ✅ 在 `Pipe2DEditorDialog.vue` 中引入 `useMindmapEditorEvents`
- ✅ 绑定事件处理器到组件生命周期
- ✅ 合并模式提示 (`combinedToolHint`)
- ✅ 合并光标样式 (`combinedCursorClass`)
- ✅ 合并撤销/重做状态和操作

### Phase 2.1: 地图交互辅助函数
- ✅ 在 `usePipe2DEditorMap` 中导出 `screenToLonLat` 函数
- ✅ 在 `usePipe2DEditorMap` 中导出 `worldToScreen` 函数
- ✅ 在 `usePipe2DEditorMap` 中实现 `pickEntity` 函数
- ✅ 将辅助函数传递给 `useMindmapEditorEvents`
- ✅ 绑定画布点击和双击事件
- ✅ 类型检查通过

## 集成细节

### 导入的 Composables
```typescript
import { useMindmapEditor } from '~/composables/admin/useMindmapEditor'
import { useMindmapEditorEvents } from '~/composables/admin/useMindmapEditorEvents'
```

### 初始化
```typescript
const mindmapEditor = useMindmapEditor({
  draftLines,
})

const mindmapEvents = useMindmapEditorEvents({
  editor: mindmapEditor,
  mapContainerRef,
  open: toRef(props, 'open'),
  screenToLonLat: (pos) => screenToLonLat(new Cesium.Cartesian2(pos.x, pos.y)),
  pickEntity,
})
```

### 地图交互函数
- **screenToLonLat**: 将屏幕坐标转换为经纬度坐标
- **pickEntity**: 拾取屏幕坐标处的实体（节点或边）
  - 使用 Cesium 的 `scene.pick` API
  - 检查实体的 `properties.graphNodeId` 或 `properties.graphEdgeId`
  - 返回 `{ type: 'node' | 'edge', nodeId?, edgeId? }`

### UI 集成
- **模式提示**: 优先显示思维导图编辑器的 `modeHint`，回退到原有的 `activeToolHint`
- **光标样式**: 优先使用思维导图编辑器的 `cursorClass`，智能合并到 `canvasClass` 数组
- **撤销/重做**: 优先使用思维导图编辑器的历史记录，回退到原有的历史记录

### 生命周期管理
- 对话框打开时：调用 `mindmapEvents.bindEvents()`
- 对话框关闭时：调用 `mindmapEvents.unbindEvents()`
- 组件卸载时：调用 `mindmapEvents.unbindEvents()`

### 事件绑定
- **键盘事件**: 绑定到 `window`
  - Tab: 创建子节点
  - Enter: 创建兄弟节点
  - Delete/Backspace: 删除选中
  - Escape: 退出当前模式
  - Ctrl+Z: 撤销
  - Ctrl+Shift+Z / Ctrl+Y: 重做
  - Ctrl+D: 复制
  - Ctrl+A: 全选
- **鼠标事件**: 绑定到 `mapContainerRef`
  - click: 选中节点/边
  - dblclick: 创建节点或编辑文本

## 待完成 🚧

### Phase 2.2: 实现核心操作
- ✅ 实现 `createNodeAt` - 在指定位置创建节点
- ✅ 实现 `createChildNode` - 创建子节点（Tab 键）
- ✅ 实现 `createSiblingNode` - 创建兄弟节点（Enter 键）
- ✅ 实现 `connectNodes` - 连接两个节点
- ✅ 实现 `deleteSelected` - 删除选中内容
- ⏳ 实现 `duplicateSelected` - 复制选中内容（待实现）
- ✅ 实现 `selectAll` - 全选
- ✅ 实现 `undo/redo` - 撤销/重做（集成 graphEditor）

### Phase 2.3: ESC 键处理优化
- ✅ 修复 ESC 键冲突问题
- ✅ 实现分层处理逻辑
- ✅ 创建 ESC_KEY_HANDLING.md 文档

### Phase 3: 渲染优化
- ⏳ 实现节点连接点渲染
- ⏳ 实现悬停效果
- ⏳ 实现选中状态视觉反馈
- ⏳ 优化大规模节点渲染性能

### Phase 4: 测试和优化
- ⏳ 单元测试
- ⏳ E2E 测试
- ⏳ 性能测试
- ⏳ 用户体验测试

## 技术决策

### 简化版实现
为了快速集成和验证架构，当前实现了简化版的 `useMindmapEditor`：
- 移除了对 `usePipe2DEditorGraph` 的直接依赖
- 核心操作方法暂时只打印日志
- 撤销/重做状态暂时为固定值
- 选中状态使用简单的 `Set<string>` 管理

### 下一步实现策略
1. 逐步实现核心操作方法，连接到 `editorGraph`
2. 实现历史记录管理
3. 实现节点和边的渲染
4. 添加视觉反馈和交互优化

## 已知问题

1. ~~**类型兼容性**: `combinedCursorClass` 可能需要类型调整~~ ✅ 已修复
2. ~~**事件冲突**: 需要确保思维导图事件和原有工具事件不会冲突~~ ✅ 通过优先级处理
3. **状态同步**: 需要确保 `mindmapEditor` 和 `editorGraph` 保持同步（待实现）
4. **pickEntity 实现**: 需要确保图形对象正确设置 `properties.graphNodeId/graphEdgeId`（待验证）

## 下一步行动

1. ✅ 修复类型错误
2. ✅ 通过类型检查
3. ⏳ 实现 `createNodeAt` 方法
4. ⏳ 测试双击创建节点功能
5. ⏳ 实现节点选中和视觉反馈

