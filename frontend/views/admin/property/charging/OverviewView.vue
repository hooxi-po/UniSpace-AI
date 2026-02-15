<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">费用总览</h2>
        <p class="subtitle">年度收费核算与账单状态统计</p>
      </div>
      <button class="btnPrimary" @click="fetchFees">
        <RefreshCw :size="14" :class="{ spinning: loading }" /> 刷新
      </button>
    </div>

    <FeeStatsCards :stats="stats" />

    <FeeCharts :data="chartData" />

    <FeeOverviewFilters
      :search-term="searchTerm"
      :year="yearFilter"
      :status="statusFilter"
      :status-options="statusOptions"
      :get-status-label="getStatusLabel"
      @update:search-term="searchTerm = $event"
      @update:year="yearFilter = $event"
      @update:status="statusFilter = $event"
      @export="exportFees"
    />

    <FeeOverviewFeeList
      :loading="loading"
      :fees="filteredFees"
      :get-status-label="getStatusLabel"
      :get-status-color-class="getStatusColorClass"
      :get-tier-label="getTierLabel"
      :get-tier-color-class="getTierColorClass"
      @open-detail="openDetail"
      @open-reminder="openReminder"
      @generate-bill="generateBill"
      @push-confirm="pushConfirm"
      @confirm-bill="confirmBill"
      @confirm-payment="confirmPayment"
    />

    <FeeOverviewDetailModal
      :is-open="detailOpen"
      :fee="selectedFee"
      :get-status-label="getStatusLabel"
      :get-status-color-class="getStatusColorClass"
      :get-tier-label="getTierLabel"
      :get-tier-color-class="getTierColorClass"
      @close="closeDetail"
    />

    <FeeOverviewReminderModal
      :is-open="reminderOpen"
      :fee="selectedFee"
      @close="closeReminder"
      @send="handleSendReminder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import FeeCharts from '~/components/admin/property/charging/components/FeeCharts.vue'
import FeeStatsCards from '~/components/admin/property/charging/components/FeeStatsCards.vue'
import FeeOverviewDetailModal from '~/components/admin/property/charging/components/FeeOverviewDetailModal.vue'
import FeeOverviewFeeList from '~/components/admin/property/charging/components/FeeOverviewFeeList.vue'
import FeeOverviewFilters from '~/components/admin/property/charging/components/FeeOverviewFilters.vue'
import FeeOverviewReminderModal from '~/components/admin/property/charging/components/FeeOverviewReminderModal.vue'
import { useChargingOverview } from '~/composables/property/useChargingOverview'
import type { ExtendedDepartmentFee, FeeStatus } from '~/server/utils/charging-db'

const {
  loading,
  yearFilter,
  statusFilter,
  searchTerm,
  filteredFees,
  stats,
  chartData,
  fetchFees,
  sendReminder,
  generateBill,
  pushConfirm,
  confirmBill,
  confirmPayment,
} = useChargingOverview()

const selectedFee = ref<ExtendedDepartmentFee | null>(null)
const detailOpen = ref(false)
const reminderOpen = ref(false)

const statusLabels = computed<Record<FeeStatus, string>>(() => ({
  Verifying: '数据核对中',
  BillGenerated: '账单已生成',
  PendingConfirm: '待学院确认',
  Disputed: '争议处理中',
  FinanceProcessing: '财务处理中',
  Completed: '已完结',
}))

const statusOptions = computed(() => {
  return Object.keys(statusLabels.value) as FeeStatus[]
})

function getStatusLabel(status: FeeStatus) {
  return statusLabels.value[status] || status
}

function getStatusColorClass(status: FeeStatus) {
  const colors: Record<FeeStatus, string> = {
    Verifying: 'bgGray',
    BillGenerated: 'bgBlue',
    PendingConfirm: 'bgAmber',
    Disputed: 'bgRed',
    FinanceProcessing: 'bgPurple',
    Completed: 'bgGreen',
  }
  return colors[status] || 'bgGray'
}

function getTierColorClass(percent: number) {
  if (percent <= 10) return 'good'
  if (percent <= 30) return 'warn'
  if (percent <= 50) return 'mid'
  return 'bad'
}

function getTierLabel(percent: number) {
  if (percent <= 10) return '基础费率'
  if (percent <= 30) return '1.5倍费率'
  if (percent <= 50) return '2倍费率'
  return '熔断费率(3倍)'
}

function exportFees() {
  const data = filteredFees.value.map(f => ({
    部门: f.departmentName,
    年度: f.year,
    定额面积: f.quotaArea,
    实际面积: f.actualArea,
    超额面积: f.excessArea,
    超额比例: `${f.excessPercent.toFixed(1)}%`,
    基础费用: f.baseCost,
    阶梯加收: f.tierCost,
    总费用: f.totalCost,
    已缴金额: f.paidAmount,
    待缴金额: f.remainingAmount,
    状态: getStatusLabel(f.status),
  }))

  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csv = [headers.join(','), ...data.map(row => headers.map(h => (row as any)[h]).join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `公房收费汇总_${yearFilter.value}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

function openDetail(fee: ExtendedDepartmentFee) {
  selectedFee.value = fee
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  selectedFee.value = null
}

function openReminder(fee: ExtendedDepartmentFee) {
  selectedFee.value = fee
  reminderOpen.value = true
}

function closeReminder() {
  reminderOpen.value = false
  selectedFee.value = null
}

async function handleSendReminder(payload: any) {
  await sendReminder(payload)
  closeReminder()
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  color: #646a73;
  font-size: 14px;
  margin-top: 4px;
}

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .header {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
