<template>
  <div v-if="dialog.open" class="detail-mask detail-mask--center" @click.self="emit('close')">
    <div class="action-dialog">
      <div class="action-dialog__header">
        <div>
          <h3>{{ dialog.title }}</h3>
          <div class="detail-sub">{{ dialog.workorderTitle }}</div>
        </div>
        <button class="ops-btn ops-btn--mini" type="button" @click="emit('close')">关闭</button>
      </div>
      <div class="action-dialog__body">
        <template v-if="dialog.action === 'assign'">
          <label class="ops-field">
            <span>执行人</span>
            <input v-model="dialog.assignee" class="ops-input" placeholder="请输入执行人" />
          </label>
          <label class="ops-field">
            <span>审核人</span>
            <input v-model="dialog.reviewer" class="ops-input" placeholder="请输入审核人（可选）" />
          </label>
        </template>
        <template v-else-if="dialog.action === 'reject'">
          <label class="ops-field">
            <span>驳回原因</span>
            <textarea
              v-model="dialog.comment"
              class="ops-textarea ops-textarea--compact"
              placeholder="请输入驳回原因"
            />
          </label>
        </template>
      </div>
      <div class="action-dialog__footer">
        <button class="ops-btn" type="button" @click="emit('close')">取消</button>
        <button class="ops-btn ops-btn--primary" type="button" :disabled="submitting" @click="emit('confirm')">
          {{ dialog.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type ActionDialogState = {
  open: boolean
  action: '' | 'assign' | 'reject'
  orderId: string
  workorderTitle: string
  title: string
  confirmText: string
  assignee: string
  reviewer: string
  comment: string
}

defineProps<{
  dialog: ActionDialogState
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>
