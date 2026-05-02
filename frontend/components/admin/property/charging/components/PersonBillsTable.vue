<template>
  <div class="card">
    <div class="head">
      <div>
        <div class="title">当年个人账单</div>
        <div class="sub">年度：{{ year }}</div>
      </div>
    </div>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="bills.length === 0" class="empty">暂无账单记录</div>

    <div v-else class="tableWrap">
      <table class="table">
        <thead>
          <tr>
            <th>月份</th>
            <th>人员</th>
            <th>部门</th>
            <th class="right">定额</th>
            <th class="right">实占</th>
            <th class="right">超额</th>
            <th class="right">金额</th>
            <th>状态</th>
            <th class="right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bills" :key="b.id">
            <td>{{ b.month }}</td>
            <td class="bold">{{ b.personName }}</td>
            <td>{{ b.departmentName }}</td>
            <td class="right">{{ b.quotaArea }} ㎡</td>
            <td class="right">{{ b.actualArea }} ㎡</td>
            <td class="right" :class="b.excessArea > 0 ? 'bad' : 'good'">{{ b.excessArea }} ㎡</td>
            <td class="right money">¥{{ b.amount.toLocaleString() }}</td>
            <td>
              <span class="badge" :class="statusClass(b.status)">{{ statusLabel(b.status) }}</span>
            </td>
            <td class="right">
              <button class="btnLink" @click="$emit('detail', b)">详情</button>
              <button v-if="b.status !== 'Completed'" class="btnPay" @click="$emit('pay', b)">缴费</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeeStatus, PersonFeeBill } from '~/server/utils/charging-db'

defineEmits<{
  detail: [bill: PersonFeeBill]
  pay: [bill: PersonFeeBill]
}>()

defineProps<{
  year: number
  loading: boolean
  bills: PersonFeeBill[]
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
    Verifying: 'bgGray',
    BillGenerated: 'bgBlue',
    PendingConfirm: 'bgAmber',
    Disputed: 'bgRed',
    FinanceProcessing: 'bgPurple',
    Completed: 'bgGreen',
  }
  return map[s] || 'bgGray'
}
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.head {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
}

.title {
  font-weight: 700;
  color: #1f2329;
}

.sub {
  margin-top: 2px;
  font-size: 12px;
  color: #8f959e;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.tableWrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: 10px 12px;
  background: #f8fafc;
  font-size: 12px;
  color: #646a73;
  border-bottom: 1px solid #eef0f2;
  white-space: nowrap;
}

.table td {
  padding: 10px 12px;
  border-bottom: 1px solid #eef0f2;
  font-size: 13px;
  color: #1f2329;
  white-space: nowrap;
}

.bold {
  font-weight: 600;
}

.right {
  text-align: right;
}

.good {
  color: #16a34a;
}

.bad {
  color: #dc2626;
  font-weight: 600;
}

.money {
  font-weight: 700;
}

.badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.bgGray { background: #f2f3f5; color: #646a73; }
.bgBlue { background: #eff6ff; color: #1d4ed8; }
.bgAmber { background: #fff7ed; color: #c2410c; }
.bgRed { background: #fef2f2; color: #dc2626; }
.bgPurple { background: #f3e8ff; color: #6d28d9; }
.bgGreen { background: #ecfdf5; color: #047857; }

.btnLink {
  border: none;
  background: transparent;
  color: #3370ff;
  cursor: pointer;
  font-size: 12px;
  margin-right: 8px;
}

.btnPay {
  border: 1px solid #3370ff;
  background: #fff;
  color: #3370ff;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
</style>

