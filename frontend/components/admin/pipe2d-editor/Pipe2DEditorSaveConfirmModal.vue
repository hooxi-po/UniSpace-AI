<script setup lang="ts">
import type { GraphDiff } from '~/utils/pipe2d-graph'

defineProps<{
  visible: boolean
  diff: GraphDiff | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

function previewItems(items: Array<{ id: string; summary: string }>) {
  return items.slice(0, 5)
}
</script>

<template>
  <div v-if="visible" class="editor-modal-mask" @click.self="emit('close')">
    <div class="editor-modal">
      <div class="editor-modal__head">
        <div>
          <div class="editor-modal__title">保存前确认</div>
          <div class="editor-modal__sub">即将提交本次拓扑编辑变更</div>
        </div>
      </div>

      <div class="editor-modal__body">
        <div class="diff-grid">
          <div class="diff-card">
            <span>新增节点</span>
            <strong>{{ diff?.addedNodes.length || 0 }}</strong>
          </div>
          <div class="diff-card">
            <span>修改节点</span>
            <strong>{{ diff?.modifiedNodes.length || 0 }}</strong>
          </div>
          <div class="diff-card">
            <span>删除节点</span>
            <strong>{{ diff?.removedNodes.length || 0 }}</strong>
          </div>
          <div class="diff-card">
            <span>新增管段</span>
            <strong>{{ diff?.addedEdges.length || 0 }}</strong>
          </div>
          <div class="diff-card">
            <span>修改管段</span>
            <strong>{{ diff?.modifiedEdges.length || 0 }}</strong>
          </div>
          <div class="diff-card">
            <span>删除管段</span>
            <strong>{{ diff?.removedEdges.length || 0 }}</strong>
          </div>
        </div>

        <div v-if="diff" class="diff-section">
          <div class="diff-section__title">变更预览</div>
          <ul class="diff-list">
            <li v-for="item in previewItems([...diff.addedNodes, ...diff.modifiedNodes, ...diff.removedNodes, ...diff.addedEdges, ...diff.modifiedEdges, ...diff.removedEdges])" :key="item.id">
              {{ item.summary }}
            </li>
          </ul>
          <div v-if="diff.totalChanges > 5" class="diff-more">其余 {{ diff.totalChanges - 5 }} 项将在保存后写入服务端</div>
        </div>
      </div>

      <div class="editor-modal__foot">
        <button class="btn btn--sm" type="button" :disabled="submitting" @click="emit('close')">取消</button>
        <button class="btn btn--primary" type="button" :disabled="submitting" @click="emit('confirm')">
          {{ submitting ? '保存中...' : '确认保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-modal-mask {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
}

.editor-modal {
  width: min(560px, calc(100vw - 48px));
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.editor-modal__head,
.editor-modal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
}

.editor-modal__body {
  padding: 0 20px 20px;
}

.editor-modal__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.editor-modal__sub {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}

.diff-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.diff-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
  background: #f8fafc;
}

.diff-card span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.diff-card strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  color: #0f172a;
}

.diff-section {
  margin-top: 16px;
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.diff-section__title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.diff-list {
  margin: 0;
  padding-left: 18px;
  color: #475569;
  font-size: 13px;
}

.diff-list li + li {
  margin-top: 6px;
}

.diff-more {
  margin-top: 10px;
  font-size: 12px;
  color: #64748b;
}

.editor-modal__foot {
  border-top: 1px solid #e2e8f0;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .diff-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
