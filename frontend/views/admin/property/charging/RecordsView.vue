<template>
  <div class="page">
    <div class="header">
      <div>
        <h3 class="title">缴费记录</h3>
        <p class="subTitle">展示各单位缴费流水、状态与凭证信息</p>
      </div>
    </div>

    <PaymentRecordsFilters
      :search-term="searchTerm"
      :status-filter="statusFilter"
      @update:searchTerm="val => (searchTerm = val)"
      @update:statusFilter="val => (statusFilter = val)"
      @export="exportCsv"
    />

    <div class="card">
      <PaymentRecordsTable
        :data="filteredPayments"
        :is-admin="true"
        @confirm="handleConfirm"
        @reject="handleReject"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PaymentRecordsFilters from '~/components/admin/property/charging/components/PaymentRecordsFilters.vue'
import PaymentRecordsTable from '~/components/admin/property/charging/components/PaymentRecordsTable.vue'
import { chargingService } from '~/services/charging'
import type { PaymentRecord } from '~/server/utils/charging-db'

const payments = ref<PaymentRecord[]>([])

let searchTerm = ref('')
let statusFilter = ref<PaymentRecord['status'] | 'all'>('all')

onMounted(async () => {
  const res = await chargingService.fetchPayments()
  payments.value = res.list
})

const filteredPayments = computed(() => {
  const q = searchTerm.value.trim()
  return payments.value.filter(p => {
    const matchSearch = !q || p.departmentName.includes(q) || p.billNo.includes(q)
    const matchStatus = statusFilter.value === 'all' || p.status === statusFilter.value
    return matchSearch && matchStatus
  })
})

function exportCsv() {
  const rows = filteredPayments.value.map(p => ({
    账单编号: p.billNo,
    部门: p.departmentName,
    金额: p.amount,
    支付方式: p.paymentMethod === 'BankTransfer' ? '银行转账'
      : p.paymentMethod === 'FinanceDeduction' ? '财务扣款'
      : '其他',
    支付日期: p.paymentDate,
    流水号: p.transactionNo || '-',
    状态: p.status === 'Confirmed' ? '已确认'
      : p.status === 'Pending' ? '待确认'
      : '已拒绝',
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
  a.download = `缴费记录_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function handleConfirm(payment: PaymentRecord) {
  payments.value = payments.value.map(p => p.id === payment.id
    ? { ...p, status: 'Confirmed', confirmedAt: new Date().toISOString().split('T')[0] }
    : p
  )
}

function handleReject(payment: PaymentRecord) {
  payments.value = payments.value.map(p => p.id === payment.id
    ? { ...p, status: 'Rejected' }
    : p
  )
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
