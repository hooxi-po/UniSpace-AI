<template>
  <div v-if="isOpen" class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal__header">
        <h3 class="modal__title">{{ initial ? '编辑合同' : '新增合同' }}</h3>
        <button class="modal__close" @click="$emit('close')"><X :size="20" /></button>
      </div>

      <div class="modal__body">
        <div class="formGrid">
          <label class="field">
            <span class="label">合同编号</span>
            <input v-model="form.contractNo" class="input" placeholder="例如：HT-2026-001" />
          </label>

          <label class="field">
            <span class="label">关联房源</span>
            <select v-model="form.spaceId" class="input">
              <option value="" disabled>请选择房源</option>
              <option v-for="s in spaces" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>

          <label class="field">
            <span class="label">承租方</span>
            <input v-model="form.tenant" class="input" placeholder="请输入承租方名称" />
          </label>

          <label class="field">
            <span class="label">月租金（元）</span>
            <input v-model.number="form.rentPerMonth" type="number" min="1" class="input" placeholder="例如：12000" />
          </label>

          <label class="field">
            <span class="label">开始日期</span>
            <input v-model="form.startDate" type="date" class="input" />
          </label>

          <label class="field">
            <span class="label">结束日期</span>
            <input v-model="form.endDate" type="date" class="input" />
          </label>

          <label class="field">
            <span class="label">状态</span>
            <select v-model="form.status" class="input">
              <option value="Active">履约中</option>
              <option value="Expiring">即将到期</option>
            </select>
          </label>

          <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn--ghost" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" @click="submit">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { OperatingContractItem, OperatingContractStatus, OperatingSpaceItem } from '~/services/operating'

const props = defineProps<{
  isOpen: boolean
  spaces: OperatingSpaceItem[]
  initial?: OperatingContractItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'submit',
    payload: {
      id?: string
      contractNo: string
      spaceId: string
      tenant: string
      rentPerMonth: number
      startDate: string
      endDate: string
      status: OperatingContractStatus
    }
  ): void
}>()

const errorMsg = computed(() => '')

const form = reactive({
  contractNo: '',
  spaceId: '',
  tenant: '',
  rentPerMonth: 0,
  startDate: '',
  endDate: '',
  status: 'Active' as OperatingContractStatus,
})

watch(
  () => props.initial,
  (val) => {
    if (!val) {
      form.contractNo = ''
      form.spaceId = ''
      form.tenant = ''
      form.rentPerMonth = 0
      form.startDate = new Date().toISOString().slice(0, 10)
      form.endDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10)
      form.status = 'Active'
      return
    }

    form.contractNo = val.contractNo
    form.spaceId = val.spaceId
    form.tenant = val.tenant
    form.rentPerMonth = val.rentPerMonth
    form.startDate = val.startDate
    form.endDate = val.endDate
    form.status = val.status
  },
  { immediate: true }
)

function submit() {
  if (!form.contractNo.trim()) return
  if (!form.spaceId) return
  if (!form.tenant.trim()) return
  if (!Number.isFinite(form.rentPerMonth) || form.rentPerMonth <= 0) return
  if (!form.startDate || !form.endDate) return

  emit('submit', {
    id: props.initial?.id,
    contractNo: form.contractNo.trim(),
    spaceId: form.spaceId,
    tenant: form.tenant.trim(),
    rentPerMonth: Number(form.rentPerMonth),
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status,
  })
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
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 640px;
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
  margin: 0;
}

.modal__close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
}

.modal__body {
  padding: 20px;
}

.formGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
}

.label {
  font-size: 12px;
  color: var(--muted);
}

.input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: #fff;
}

.modal__footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.btn--ghost {
  background: transparent;
}

.error {
  grid-column: 1 / -1;
  color: #ef4444;
  font-size: 12px;
}

@media (max-width: 720px) {
  .formGrid {
    grid-template-columns: 1fr;
  }
}
</style>

