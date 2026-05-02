<template>
  <div class="page">
    <div class="header">
      <div>
        <h3 class="title">账单管理</h3>
        <p class="subTitle">按年度/月份查看学院总账单（B）列表</p>
      </div>
    </div>

    <BillsFilters
      :year="year"
      :month="month"
      :year-options="yearOptions"
      @update:year="val => (year = val)"
      @update:month="val => (month = val)"
      @export="exportCsv"
    />

    <div class="card">
      <BillsTable :data="filteredBills" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BillsFilters from '~/components/admin/property/charging/components/BillsFilters.vue'
import BillsTable from '~/components/admin/property/charging/components/BillsTable.vue'
import { chargingService } from '~/services/charging'
import type { FeeBill } from '~/server/utils/charging-db'

const bills = ref<FeeBill[]>([])

let year = ref<number>(2025)
let month = ref<string>('')

const yearOptions = [2025, 2024, 2023]

async function fetchBills() {
  const res = await chargingService.fetchBills(year.value, month.value || undefined)
  bills.value = res.list
}

onMounted(async () => {
  await fetchBills()
})

const filteredBills = computed(() => {
  return bills.value.filter(b => {
    const matchYear = b.year === year.value
    const matchMonth = !month.value || b.month === month.value
    return matchYear && matchMonth
  })
})

function exportCsv() {
  const rows = filteredBills.value.map(b => ({
    账单编号: b.billNo,
    部门: b.departmentName,
    定额面积: b.quotaArea,
    实际面积: b.actualArea,
    超额面积: b.excessArea,
    费率倍数: b.tierMultiplier,
    应缴金额: b.calculatedAmount,
    状态: b.status,
    生成时间: b.generatedAt,
  }))

  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => (r as any)[h]).join(',')),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `账单管理_${year.value}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
}

.subTitle {
  margin-top: 4px;
  font-size: 12px;
  color: #8f959e;
}

.card {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}
</style>
