<template>
  <div class="tableWrapper">
    <table class="table">
      <thead>
        <tr>
          <th>账单编号</th>
          <th>部门</th>
          <th>金额</th>
          <th>支付方式</th>
          <th>支付日期</th>
          <th>流水号</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="payment in data" :key="payment.id">
          <td class="billNo">{{ payment.billNo }}</td>
          <td>{{ payment.departmentName }}</td>
          <td class="amount">¥{{ payment.amount.toLocaleString() }}</td>
          <td>{{ methodLabel(payment.paymentMethod) }}</td>
          <td>{{ payment.paymentDate }}</td>
          <td class="muted">{{ payment.transactionNo || '-' }}</td>
          <td>
            <span :class="['statusTag', payment.status.toLowerCase()]">
              {{ statusLabel(payment.status) }}
            </span>
          </td>
          <td>
            <div class="actions">
              <button v-if="payment.voucherUrl" class="textBtn">
                <FileText :size="14" /> 查看凭证
              </button>
              <template v-if="isAdmin && payment.status === 'Pending'">
                <button class="textBtn success" @click="$emit('confirm', payment)">确认</button>
                <button class="textBtn danger" @click="$emit('reject', payment)">拒绝</button>
              </template>
            </div>
          </td>
        </tr>
        <tr v-if="data.length === 0">
          <td colspan="8" class="empty">暂无缴费记录</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import type { PaymentRecord } from '~/server/utils/charging-db'

defineProps<{
  data: PaymentRecord[]
  isAdmin: boolean
}>()

defineEmits<{
  confirm: [payment: PaymentRecord]
  reject: [payment: PaymentRecord]
}>()

function methodLabel(m: PaymentRecord['paymentMethod']) {
  const map: Record<PaymentRecord['paymentMethod'], string> = {
    BankTransfer: '银行转账',
    FinanceDeduction: '财务扣款',
    Other: '其他'
  }
  return map[m] || m
}

function statusLabel(s: PaymentRecord['status']) {
  const map: Record<PaymentRecord['status'], string> = {
    Pending: '待确认',
    Confirmed: '已确认',
    Rejected: '已拒绝'
  }
  return map[s] || s
}
</script>

<style scoped>
.tableWrapper {
  width: 100%;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
  background: #f5f6f7;
  color: #646a73;
  font-weight: 500;
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #dee0e3;
}

.table td {
  padding: 12px;
  border-bottom: 1px solid #dee0e3;
  color: #1f2329;
}

.billNo {
  color: #3370ff;
  font-weight: 500;
}

.amount {
  font-weight: 500;
}

.muted {
  color: #8f959e;
}

.statusTag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.statusTag.pending {
  background: #fff7e6;
  color: #d48806;
}

.statusTag.confirmed {
  background: #f6ffed;
  color: #389e0d;
}

.statusTag.rejected {
  background: #fff1f0;
  color: #cf1322;
}

.actions {
  display: flex;
  gap: 12px;
}

.textBtn {
  background: none;
  border: none;
  color: #3370ff;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.textBtn.success {
  color: #389e0d;
}

.textBtn.danger {
  color: #cf1322;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #8f959e;
}
</style>

