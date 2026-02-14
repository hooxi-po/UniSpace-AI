<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal small" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">驳回申请</div>
          <div v-if="request" class="modalSub">{{ request.department }} · {{ request.id }}</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>
      <div class="modalBody">
        <div class="k">驳回原因</div>
        <textarea v-model="localReason" class="textarea" placeholder="请输入驳回原因" />
        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">取消</button>
          <button class="btnDanger" :disabled="!localReason.trim()" @click="submit">确认驳回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AllocationRequest } from '~/server/utils/allocation-db'

const props = defineProps<{
  request: AllocationRequest | null
  reason: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', reason: string): void
}>()

const localReason = ref(props.reason)

watch(
  () => props.reason,
  (v) => {
    localReason.value = v
  }
)

function submit() {
  emit('submit', localReason.value.trim())
}
</script>

<style scoped>
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
}

.modal {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.modal.small {
  max-width: 560px;
}

.modalHeader {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modalTitle {
  font-weight: 800;
  color: #1f2329;
}

.modalSub {
  margin-top: 2px;
  font-size: 12px;
  color: #8f959e;
}

.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.modalBody {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.k {
  font-size: 12px;
  color: #8f959e;
}

.textarea {
  width: 100%;
  min-height: 110px;
  border: 1px solid #dee0e3;
  border-radius: 10px;
  padding: 10px;
  margin-top: 2px;
  font-size: 13px;
}

.actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnDanger {
  border: 1px solid #ef4444;
  background: #fff;
  color: #ef4444;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnDanger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

