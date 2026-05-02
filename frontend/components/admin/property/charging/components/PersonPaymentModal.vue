<template>
  <div v-if="isOpen && bill" class="mask" @click.self="$emit('close')">
    <div class="modal">
      <div class="head">
        <div class="title">确认缴费 - {{ bill.personName }}</div>
        <button class="iconBtn" @click="$emit('close')"><X :size="18" /></button>
      </div>

      <div class="body">
        <div class="summary">
          <div class="line"><span class="k">月份</span><span class="v">{{ bill.month }}</span></div>
          <div class="line"><span class="k">部门</span><span class="v">{{ bill.departmentName }}</span></div>
          <div class="line total"><span class="k">应缴金额</span><span class="money">¥{{ bill.amount.toLocaleString() }}</span></div>
        </div>

        <div class="form">
          <label class="label">支付方式</label>
          <select class="select" v-model="method">
            <option value="Alipay">支付宝</option>
            <option value="WeChat">微信</option>
            <option value="Card">银行卡</option>
            <option value="SalaryDeduction">工资代扣</option>
          </select>
        </div>

        <div class="hint">该操作用于模拟缴费入账，确认后账单状态将更新为“已完结”。</div>
      </div>

      <div class="foot">
        <button class="btnGhost" :disabled="paying" @click="$emit('close')">取消</button>
        <button class="btnPrimary" :disabled="paying" @click="$emit('confirm', method)">
          {{ paying ? '处理中...' : '确认缴费' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { PersonFeeBill, PersonPayment } from '~/server/utils/charging-db'

const props = defineProps<{
  isOpen: boolean
  bill: PersonFeeBill | null
  paying: boolean
}>()

defineEmits<{
  close: []
  confirm: [method: PersonPayment['paymentMethod']]
}>()

const method = ref<PersonPayment['paymentMethod']>('WeChat')

watch(
  () => props.isOpen,
  (open) => {
    if (open) method.value = 'WeChat'
  }
)
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.modal {
  width: 100%;
  max-width: 520px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.head {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-weight: 700;
  color: #1f2329;
}

.iconBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #3370ff;
  padding: 2px;
}

.body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary {
  background: #f5f6f7;
  border-radius: 12px;
  padding: 12px;
}

.line {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.line .k { color: #646a73; }
.line .v { color: #1f2329; font-weight: 600; }

.line.total {
  border-top: 1px solid #dee0e3;
  padding-top: 10px;
  margin-top: 6px;
  font-weight: 700;
}

.money { color: #1f2329; }

.form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  color: #8f959e;
}

.select {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: #fff;
}

.hint {
  font-size: 12px;
  color: #8f959e;
}

.foot {
  padding: 12px 14px;
  border-top: 1px solid #eef0f2;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  color: #1f2329;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.btnGhost:disabled,
.btnPrimary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

