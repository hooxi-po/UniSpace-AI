<template>
  <div v-if="open" class="dialog">
    <div class="dialog__mask" @click="$emit('close')" />
    <div class="dialog__panel" @click.stop>
      <div class="dialog__title">确认删除</div>
      <div class="dialog__desc">要素 <span class="mono">{{ id }}</span> 删除后不可恢复。</div>
      <div v-if="error" class="dialog__error">{{ error }}</div>

      <div class="dialog__footer">
        <button class="btn" type="button" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="btn btn--danger" type="button" :disabled="submitting" @click="$emit('confirm')">
          {{ submitting ? '删除中...' : '确认删除' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  id: string
  error?: string | null
  submitting?: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: 65;
}

.dialog__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .35);
}

.dialog__panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100vw - 24px));
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(18, 24, 38, .2);
  padding: 16px;
}

.dialog__title {
  font-size: 16px;
  font-weight: 600;
}

.dialog__desc {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text);
}

.dialog__error {
  margin-top: 8px;
  font-size: 12px;
  color: #c03631;
}

.dialog__footer {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text);
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
}

.btn:hover {
  background: #f8f9fa;
}

.btn--danger {
  border-color: rgba(245, 74, 69, .35);
  color: #c03631;
}

.btn--danger:hover {
  background: rgba(245, 74, 69, .08);
}

.btn:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>

