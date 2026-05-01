<template>
  <div v-if="isOpen" class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal__header">
        <h3 class="modal__title">合同详情</h3>
        <button class="modal__close" @click="$emit('close')"><X :size="20" /></button>
      </div>

      <div class="modal__body">
        <div class="detailGrid">
          <div class="detailItem">
            <span class="detailLabel">合同编号</span>
            <span class="detailValue">{{ contract.contractNo }}</span>
          </div>
          <div class="detailItem">
            <span class="detailLabel">关联房源</span>
            <span class="detailValue">{{ contract.spaceName }}</span>
          </div>
          <div class="detailItem">
            <span class="detailLabel">承租方</span>
            <span class="detailValue">{{ contract.tenant }}</span>
          </div>
          <div class="detailItem">
            <span class="detailLabel">月租金</span>
            <span class="detailValue font-bold text-primary">¥{{ contract.rentPerMonth.toLocaleString() }}</span>
          </div>
          <div class="detailItem">
            <span class="detailLabel">合同开始日期</span>
            <span class="detailValue">{{ contract.startDate }}</span>
          </div>
          <div class="detailItem">
            <span class="detailLabel">合同结束日期</span>
            <span class="detailValue">{{ contract.endDate }}</span>
          </div>
          <div class="detailItem">
            <span class="detailLabel">当前状态</span>
            <span :class="['badge', contract.status === 'Active' ? 'badge--success' : 'badge--warn']">
              {{ contract.status === 'Active' ? '履约中' : '即将到期' }}
            </span>
          </div>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { OperatingContractItem } from '~/services/operating'

defineProps<{
  isOpen: boolean
  contract: OperatingContractItem
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>

<style scoped>
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal__title {
  font-size: 16px;
  font-weight: 700;
}

.modal__close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
}

.modal__body {
  padding: 20px;
}

.detailGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detailItem {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detailLabel {
  font-size: 12px;
  color: var(--muted);
}

.detailValue {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}

.font-bold {
  font-weight: 700;
}

.text-primary {
  color: var(--primary);
}

.badge {
  display: inline-block;
  width: fit-content;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.badge--success {
  background: #eefdf3;
  color: #16a34a;
}

.badge--warn {
  background: #fffbeb;
  color: #d97706;
}

.modal__footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
}
</style>























