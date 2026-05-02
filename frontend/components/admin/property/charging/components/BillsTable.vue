<template>
  <div class="tableWrapper">
    <table class="table">
      <thead>
        <tr>
          <th>账单编号</th>
          <th>部门</th>
          <th>定额面积</th>
          <th>实际面积</th>
          <th>超额面积</th>
          <th>费率倍数</th>
          <th>应缴金额</th>
          <th>状态</th>
          <th>生成时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="bill in data" :key="bill.id">
          <td class="billNo">{{ bill.billNo }}</td>
          <td>{{ bill.departmentName }}</td>
          <td>{{ bill.quotaArea }} m²</td>
          <td>{{ bill.actualArea }} m²</td>
          <td>
            <span :class="bill.excessArea > 0 ? 'dangerText' : 'successText'">
              {{ bill.excessArea > 0 ? `+${bill.excessArea}` : bill.excessArea }} m²
            </span>
          </td>
          <td>{{ bill.tierMultiplier }}x</td>
          <td class="amount">¥{{ bill.calculatedAmount.toLocaleString() }}</td>
          <td>
            <span :class="['statusTag', statusClass(bill.status)]">
              {{ statusLabel(bill.status) }}
            </span>
          </td>
          <td class="muted">{{ bill.generatedAt }}</td>
        </tr>
        <tr v-if="data.length === 0">
          <td colspan="9" class="empty">暂无账单</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { FeeBill, FeeStatus } from '~/server/utils/charging-db'

defineProps<{
  data: FeeBill[]
}>()

function statusLabel(s: FeeStatus) {
  const map: Record<FeeStatus, string> = {
    Verifying: '数据核对中',
    BillGenerated: '账单已生成',
    PendingConfirm: '待学院确认',
    Disputed: '争议处理中',
    FinanceProcessing: '财务处理中',
    Completed: '已完结',
  }
  return map[s] || s
}

function statusClass(s: FeeStatus) {
  const map: Record<FeeStatus, string> = {
    Verifying: 'verifying',
    BillGenerated: 'generated',
    PendingConfirm: 'pending',
    Disputed: 'disputed',
    FinanceProcessing: 'finance',
    Completed: 'completed',
  }
  return map[s] || 'verifying'
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

.dangerText {
  color: #cf1322;
}

.successText {
  color: #389e0d;
}

.statusTag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.statusTag.verifying {
  background: #f5f6f7;
  color: #646a73;
}

.statusTag.generated {
  background: #e6f4ff;
  color: #1677ff;
}

.statusTag.pending {
  background: #fff7e6;
  color: #d48806;
}

.statusTag.disputed {
  background: #fff1f0;
  color: #cf1322;
}

.statusTag.finance {
  background: #f9f0ff;
  color: #722ed1;
}

.statusTag.completed {
  background: #f6ffed;
  color: #389e0d;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #8f959e;
}
</style>
