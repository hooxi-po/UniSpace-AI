<template>
  <div class="listCard">
    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="fees.length === 0" class="empty">暂无费用记录</div>

    <div v-else class="list">
      <div v-for="fee in fees" :key="fee.id" class="row">
        <div class="rowMain">
          <div class="rowTop">
            <div class="dept">
              <span class="deptName">{{ fee.departmentName }}</span>
              <span class="badge" :class="getStatusColorClass(fee.status)">{{ getStatusLabel(fee.status) }}</span>
              <span v-if="fee.excessPercent >= 50" class="badge danger"><AlertTriangle :size="10" /> 熔断预警</span>
            </div>

            <div class="actions">
              <button class="iconBtn" title="查看详情" @click="$emit('open-detail', fee)">
                <Eye :size="18" />
              </button>
              <button
                v-if="fee.status === 'Verifying'"
                class="btnWarn"
                @click="$emit('generate-bill', fee)"
              >
                <FileSpreadsheet :size="12" /> 生成账单
              </button>
              <button
                v-if="fee.status === 'BillGenerated'"
                class="btnWarn"
                @click="$emit('push-confirm', fee)"
              >
                <Send :size="12" /> 推送确认
              </button>
              <button
                v-if="['BillGenerated', 'PendingConfirm'].includes(fee.status)"
                class="btnWarn"
                @click="$emit('open-reminder', fee)"
              >
                <Bell :size="12" /> 催缴
              </button>
              <button
                v-if="fee.status === 'PendingConfirm'"
                class="btnOk"
                @click="$emit('confirm-bill', fee)"
              >
                <Check :size="12" /> 确认账单
              </button>
              <button
                v-if="fee.status === 'FinanceProcessing'"
                class="btnOk"
                @click="$emit('confirm-payment', fee)"
              >
                <CreditCard :size="12" /> 确认扣款
              </button>
            </div>
          </div>

          <div class="grid">
            <div class="cell">
              <div class="k">定额/实占</div>
              <div class="v">
                {{ fee.quotaArea }} /
                <span :class="{ over: fee.excessArea > 0 }">{{ fee.actualArea }}</span>
                m²
              </div>
            </div>
            <div class="cell">
              <div class="k">超额面积</div>
              <div class="v" :class="fee.excessArea > 0 ? 'bad' : 'good'">
                {{ fee.excessArea > 0 ? `+${fee.excessArea}` : fee.excessArea }} m² ({{ fee.excessPercent.toFixed(1) }}%)
              </div>
            </div>
            <div class="cell">
              <div class="k">适用费率</div>
              <div class="v" :class="getTierColorClass(fee.excessPercent)">
                {{ getTierLabel(fee.excessPercent) }}
              </div>
            </div>
            <div class="cell">
              <div class="k">应缴费用</div>
              <div class="v money">¥{{ fee.totalCost.toLocaleString() }}</div>
            </div>
          </div>

          <div v-if="fee.remainingAmount > 0 && fee.remainingAmount !== fee.totalCost" class="sub">
            已缴: ¥{{ fee.paidAmount.toLocaleString() }} |
            待缴: <span class="subBad">¥{{ fee.remainingAmount.toLocaleString() }}</span>
          </div>
          <div v-if="fee.hasReminder" class="subWarn">
            <Bell :size="12" /> 已催缴 {{ fee.reminderCount }} 次，最近: {{ fee.lastReminderAt }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, Bell, Check, CreditCard, Eye, FileSpreadsheet, Send } from 'lucide-vue-next'
import type { ExtendedDepartmentFee, FeeStatus } from '~/server/utils/charging-db'

defineEmits<{
  'open-detail': [fee: ExtendedDepartmentFee]
  'open-reminder': [fee: ExtendedDepartmentFee]
  'generate-bill': [fee: ExtendedDepartmentFee]
  'push-confirm': [fee: ExtendedDepartmentFee]
  'confirm-bill': [fee: ExtendedDepartmentFee]
  'confirm-payment': [fee: ExtendedDepartmentFee]
}>()

defineProps<{
  loading: boolean
  fees: ExtendedDepartmentFee[]
  getStatusLabel: (s: FeeStatus) => string
  getStatusColorClass: (s: FeeStatus) => string
  getTierLabel: (p: number) => string
  getTierColorClass: (p: number) => string
}>()
</script>

<style scoped>
.listCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.empty {
  padding: 32px;
  text-align: center;
  color: #8f959e;
}

.list {
  display: flex;
  flex-direction: column;
}

.row {
  padding: 14px 14px;
  border-top: 1px solid #eef0f2;
}

.row:first-child {
  border-top: none;
}

.rowTop {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.dept {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.deptName {
  font-weight: 600;
  color: #1f2329;
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

.badge.danger { background: #fee2e2; color: #dc2626; }

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.iconBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #3370ff;
  padding: 2px;
}

.btnWarn {
  border: 1px solid #fcd34d;
  background: #fff;
  color: #b45309;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.btnOk {
  border: none;
  background: #22c55e;
  color: #fff;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.cell .k {
  font-size: 12px;
  color: #8f959e;
}

.cell .v {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  margin-top: 4px;
}

.cell .v.over {
  color: #dc2626;
}

.good { color: #16a34a; }
.warn { color: #d97706; }
.mid { color: #ea580c; }
.bad { color: #dc2626; }

.money { color: #1f2329; }

.sub {
  margin-top: 8px;
  font-size: 12px;
  color: #646a73;
}

.subBad {
  color: #dc2626;
  font-weight: 600;
}

.subWarn {
  margin-top: 8px;
  font-size: 12px;
  color: #b45309;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 1000px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .grid { grid-template-columns: 1fr; }
}
</style>

