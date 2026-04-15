<template>
  <div v-if="isOpen" class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal__header">
        <h3 class="modal__title">登记缴费</h3>
        <button class="modal__close" @click="$emit('close')"><X :size="20" /></button>
      </div>

      <div class="modal__body">
        <div class="summary">
          <div class="row"><span class="k">承租方</span><span class="v">{{ bill.tenant }}</span></div>
          <div class="row"><span class="k">房源</span><span class="v">{{ bill.spaceName }}</span></div>
          <div class="row"><span class="k">账期</span><span class="v">{{ bill.period }}</span></div>
          <div class="row"><span class="k">应缴总额</span><span class="v">¥{{ bill.totalAmount.toLocaleString() }}</span></div>
          <div class="row"><span class="k">已缴金额</span><span class="v">¥{{ bill.paidAmount.toLocaleString() }}</span></div>
        </div>

        <div class="form">
          <label class="field">
            <span class="label">本次缴纳金额（元）</span>
            <input v-model.number="form.amount" type="number" class="input" :min="1" :max="remain" />
            <div class="hint">最大可登记：¥{{ remain.toLocaleString() }}</div>
          </label>

          <label class="field">
            <span class="label">支付方式</span>
            <select v-model="form.method" class="input">
              <option value="银行转账">银行转账</option>
              <option value="现金">现金</option>
              <option value="支票">支票</option>
            </select>
          </label>

          <label class="field">
            <span class="label">交易流水号</span>
            <input v-model="form.transactionNo" class="input" placeholder="请输入银行流水号或收据编号" />
          </label>

          <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn--ghost" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" @click="submit">确认登记</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { OperatingRentBill } from '~/services/operating'

const props = defineProps<{
  isOpen: boolean
  bill: OperatingRentBill
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { amount: number; method: string; transactionNo: string }): void
}>()

const remain = computed(() => Math.max(0, props.bill.totalAmount - props.bill.paidAmount))

const form = reactive({
  amount: 0,
  method: '银行转账',
  transactionNo: '',
})

const errorMsg = ref('')

watch(
  () => props.bill,
  () => {
    form.amount = remain.value
    form.method = '银行转账'
    form.transactionNo = ''
    errorMsg.value = ''
  },
  { immediate: true }
)

function submit() {
  errorMsg.value = ''
  if (!Number.isFinite(form.amount) || form.amount <= 0) {
    errorMsg.value = '请输入正确的缴费金额'
    return
  }
  if (form.amount > remain.value) {
    errorMsg.value = '缴费金额不能超过待缴金额'
    return
  }
  if (!form.transactionNo.trim()) {
    errorMsg.value = '请输入交易流水号'
    return
  }

  emit('submit', {
    amount: Number(form.amount),
    method: form.method,
    transactionNo: form.transactionNo.trim(),
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
  max-width: 520px;
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
  font-weight: 800;
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
  display: grid;
  gap: 14px;
}

.summary {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: #f8fafc;
  padding: 12px;
  display: grid;
  gap: 6px;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.k {
  color: var(--muted);
}

.v {
  color: var(--text);
  font-weight: 700;
}

.form {
  display: grid;
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
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

.error {
  color: #ef4444;
  font-size: 12px;
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
  font-weight: 700;
}

.btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.btn--ghost {
  background: transparent;
}
</style>























