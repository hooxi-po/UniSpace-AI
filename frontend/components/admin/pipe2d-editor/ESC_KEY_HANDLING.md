# ESC 键处理逻辑

## 问题背景

在集成思维导图编辑器后，ESC 键有两个处理器：
1. **对话框级别** (`Pipe2DEditorDialog.vue`): 关闭编辑器对话框
2. **编辑器级别** (`useMindmapEditorEvents.ts`): 退出当前编辑模式或清除选中

如果不协调处理，会导致用户按 ESC 时同时触发两个动作，体验不佳。

## 解决方案

采用**分层处理**策略，让 ESC 键根据当前状态执行不同的操作：

### 优先级顺序

1. **最高优先级**: 退出特殊编辑模式
   - 如果编辑器处于 `editText`、`connect`、`dragNode` 等模式
   - ESC 退出该模式，返回 `idle` 状态
   - 阻止事件冒泡，不关闭对话框

2. **次优先级**: 清除选中状态
   - 如果编辑器处于 `idle` 模式，但有选中的节点或边
   - ESC 清除所有选中
   - 阻止事件冒泡，不关闭对话框

3. **最低优先级**: 关闭对话框
   - 只有在编辑器处于 `idle` 模式且无选中时
   - ESC 才关闭整个编辑器对话框

## 实现细节

### 编辑器级别 (`useMindmapEditorEvents.ts`)

```typescript
// Escape - 退出当前模式或清除选中
if (event.key === 'Escape') {
  // 检查是否有需要处理的状态
  const hasMode = editor.mode.value.type !== 'idle'
  const hasSelection = editor.hasSelection.value

  if (hasMode || hasSelection) {
    event.preventDefault()
    event.stopPropagation() // 阻止事件冒泡

    if (hasMode) {
      editor.exitCurrentMode()
    }
    if (hasSelection) {
      editor.clearSelection()
    }
  }
  // 如果既没有模式也没有选中，不处理，让对话框处理器关闭对话框
  return
}
```

**关键点**:
- 使用 `event.stopPropagation()` 阻止事件冒泡到对话框
- 只在有状态需要清除时才处理事件
- 如果无状态，不处理，让事件继续传播

### 对话框级别 (`Pipe2DEditorDialog.vue`)

```typescript
function onWindowKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key !== 'Escape') return

  // 如果思维导图编辑器不在空闲模式，让它先处理 ESC
  if (mindmapEditor.mode.value.type !== 'idle') {
    return
  }

  // 如果有选中内容，先清除选中
  if (mindmapEditor.hasSelection.value) {
    return
  }

  // 只有在空闲模式且无选中时，才关闭对话框
  event.preventDefault()
  requestDialogClose()
}
```

**关键点**:
- 检查编辑器状态，只在空闲且无选中时才关闭
- 提供双重保护，即使事件没有被 `stopPropagation()`，也能正确处理

## 用户体验

### 场景 1: 正在编辑节点文本
```
用户状态: mode = 'editText'
按 ESC → 退出文本编辑，返回 idle 模式
再按 ESC → 清除选中（如果有）
再按 ESC → 关闭对话框
```

### 场景 2: 正在连接节点
```
用户状态: mode = 'connect'
按 ESC → 取消连接，返回 idle 模式
再按 ESC → 清除选中（如果有）
再按 ESC → 关闭对话框
```

### 场景 3: 选中了节点
```
用户状态: mode = 'idle', hasSelection = true
按 ESC → 清除选中
再按 ESC → 关闭对话框
```

### 场景 4: 空闲状态
```
用户状态: mode = 'idle', hasSelection = false
按 ESC → 直接关闭对话框
```

## 测试要点

1. ✅ 在编辑文本时按 ESC，应该退出编辑而不关闭对话框
2. ✅ 在连接模式时按 ESC，应该取消连接而不关闭对话框
3. ✅ 选中节点后按 ESC，应该清除选中而不关闭对话框
4. ✅ 空闲状态按 ESC，应该关闭对话框
5. ✅ 连续按 ESC，应该逐层退出，最终关闭对话框

## 扩展性

这个分层处理模式可以扩展到其他快捷键：
- **Enter**: 在不同模式下有不同行为（编辑文本时提交，空闲时创建兄弟节点）
- **Delete**: 在不同模式下有不同行为（编辑文本时删除字符，空闲时删除节点）
- **Tab**: 在不同模式下有不同行为（编辑文本时插入制表符，空闲时创建子节点）

## 相关文件

- `frontend/components/admin/Pipe2DEditorDialog.vue` - 对话框级别的 ESC 处理
- `frontend/composables/admin/useMindmapEditorEvents.ts` - 编辑器级别的 ESC 处理
- `frontend/composables/admin/useMindmapEditor.ts` - 编辑器状态管理

---

**最后更新**: 2026-03-28
