<template>
  <div class="row-actions">
    <button class="btn btn--link" type="button" :disabled="disabled" @click="$emit('edit')">编辑</button>
    <button class="btn btn--link btn--danger" type="button" :disabled="disabled" @click="$emit('delete')">删除</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  disabled?: boolean
}>()

defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
}>()
</script>

<style scoped>
.row-actions {
  display: inline-flex;
  justify-content: flex-end;
  gap: 4px;
}

.btn {
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--primary);
  padding: 0 8px;
  font-size: 12px;
  cursor: pointer;
}

.btn:hover {
  background: rgba(22, 100, 255, .08);
}

.btn--danger {
  color: #c03631;
}

.btn--danger:hover {
  background: rgba(245, 74, 69, .12);
}

.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
</style>

