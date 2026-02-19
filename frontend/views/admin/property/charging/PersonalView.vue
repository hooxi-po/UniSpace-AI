<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">个人缴费</h2>
        <p class="subtitle">按月生成个人账单，按年展示与缴费入账</p>
      </div>
      <button class="btnGhost" @click="refreshAll" :disabled="loadingUsages || loadingBills">
        <RefreshCw :size="14" :class="{ spinning: loadingUsages || loadingBills }" /> 刷新
      </button>
    </div>

    <PersonFeeFilters
      :month="month"
      :year="year"
      :year-options="yearOptions"
      :search-term="searchTerm"
      :dept-filter="deptFilter"
      :title-filter="titleFilter"
      :department-options="departmentOptions"
      :title-options="titleOptions"
      :creating-bills="creatingBills"
      @update:month="handleMonthChange"
      @update:year="year = $event"
      @update:search-term="searchTerm = $event"
      @update:dept-filter="deptFilter = $event"
      @update:title-filter="titleFilter = $event"
      @generate="handleGenerateBills"
    />

    <div class="grid">
      <PersonUsageTable :month="month" :loading="loadingUsages" :usages="filteredUsages" />
      <PersonBillsTable :year="year" :loading="loadingBills" :bills="filteredBills" @detail="openDetail" @pay="openPay" />
    </div>

    <PersonBillDetailModal :is-open="detailOpen" :bill="selectedBill" @close="closeDetail" />

    <PersonPaymentModal
      :is-open="payOpen"
      :bill="selectedBill"
      :paying="paying"
      @close="closePay"
      @confirm="confirmPay"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import PersonFeeFilters from '~/components/admin/property/charging/components/PersonFeeFilters.vue'
import PersonUsageTable from '~/components/admin/property/charging/components/PersonUsageTable.vue'
import PersonBillsTable from '~/components/admin/property/charging/components/PersonBillsTable.vue'
import PersonBillDetailModal from '~/components/admin/property/charging/components/PersonBillDetailModal.vue'
import PersonPaymentModal from '~/components/admin/property/charging/components/PersonPaymentModal.vue'
import { useChargingPersonal } from '~/composables/property/useChargingPersonal'
import type { PersonFeeBill, PersonPayment } from '~/server/utils/charging-db'
import type { PersonTitle } from '~/server/utils/persons-db'

const {
  month,
  year,
  searchTerm,
  deptFilter,
  titleFilter,

  loadingUsages,
  loadingBills,
  creatingBills,
  paying,

  filteredUsages,
  filteredBills,
  departmentOptions,

  fetchUsages,
  fetchBills,
  generateBills,
  recordPayment,
  setMonth,
} = useChargingPersonal()

const titleOptions = computed<PersonTitle[]>(() => [
  'Assistant',
  'Lecturer',
  'AssociateProfessor',
  'Professor',
  'Other',
])

const yearOptions = computed(() => {
  const base = year.value
  return [base + 1, base, base - 1, base - 2].filter(y => y >= 2020)
})

const selectedBill = ref<PersonFeeBill | null>(null)
const detailOpen = ref(false)
const payOpen = ref(false)

async function refreshAll() {
  await fetchUsages()
  await fetchBills()
}

function handleMonthChange(next: string) {
  setMonth(next)
  fetchUsages()
}

async function handleGenerateBills() {
  await generateBills()
}

function openDetail(bill: PersonFeeBill) {
  selectedBill.value = bill
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  selectedBill.value = null
}

function openPay(bill: PersonFeeBill) {
  selectedBill.value = bill
  payOpen.value = true
}

function closePay() {
  payOpen.value = false
  selectedBill.value = null
}

async function confirmPay(method: PersonPayment['paymentMethod']) {
  if (!selectedBill.value) return
  await recordPayment({ bill: selectedBill.value, paymentMethod: method })
  closePay()
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
  gap: 12px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  margin-top: 4px;
  font-size: 14px;
  color: #646a73;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  color: #1f2329;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.btnGhost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 600px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
