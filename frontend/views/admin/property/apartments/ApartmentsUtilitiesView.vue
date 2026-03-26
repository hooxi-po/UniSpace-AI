<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">水电管理</h2>
        <p class="subtitle">面向在住房间的水电账单管理，支持按月查看与账单发送</p>
      </div>
    </div>

    <div class="stats">
      <div class="card"><span>在住房间</span><strong>{{ stats.occupiedCount }}</strong></div>
      <div class="card"><span>本月应缴</span><strong>¥{{ stats.totalAmount.toFixed(2) }}</strong></div>
      <div class="card"><span>已发送账单</span><strong>{{ stats.sentCount }}</strong></div>
      <div class="card"><span>未发送账单</span><strong>{{ stats.unsentCount }}</strong></div>
    </div>

    <ApartmentsUtilitiesFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-month="selectedMonth"
      :month-options="monthOptions"
      :count="filteredBills.length"
      @search="applySearch"
      @reset="resetSearch"
      @sync="syncMetersForMonth"
    />

    <ApartmentsUtilitiesTable
      :loading="loading || syncing"
      :sending="sending"
      :bills="filteredBills"
      @view="openBillDetail"
      @send="sendBill"
    />

    <ApartmentsUtilityBillDetailDialog
      :open="detailOpen"
      :bill="activeBill"
      @close="closeBillDetail"
    />

    <div class="tips">
      说明：当前“同步表计”已预留接口，后续将由设备管理模块接入真实水表/电表数据自动回填账单。
    </div>
  </div>
</template>

<script setup lang="ts">
import ApartmentsUtilitiesFilters from '~/components/admin/property/apartments/components/ApartmentsUtilitiesFilters.vue'
import ApartmentsUtilitiesTable from '~/components/admin/property/apartments/components/ApartmentsUtilitiesTable.vue'
import ApartmentsUtilityBillDetailDialog from '~/components/admin/property/apartments/components/ApartmentsUtilityBillDetailDialog.vue'
import { useApartmentsUtilities } from '~/composables/property/useApartmentsUtilities'

const {
  loading,
  syncing,
  sending,
  draftKeyword,
  selectedMonth,
  monthOptions,
  filteredBills,
  stats,
  detailOpen,
  activeBill,
  applySearch,
  resetSearch,
  syncMetersForMonth,
  openBillDetail,
  closeBillDetail,
  sendBill,
} = useApartmentsUtilities()
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { margin: 0; font-size: 20px; font-weight: 800; color: #1f2329; }
.subtitle { margin: 4px 0 0; color: #646a73; font-size: 13px; }
.stats { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.card { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 6px; }
.card span { color: #646a73; font-size: 12px; }
.card strong { font-size: 22px; }
.tips { font-size: 12px; color: #646a73; }

@media (max-width: 900px) {
  .stats { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .stats { grid-template-columns: 1fr; }
}
</style>