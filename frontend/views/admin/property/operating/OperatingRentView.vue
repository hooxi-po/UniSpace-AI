<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">租金收缴</h2>
        <p class="page__subtitle">展示租金账单，支持筛选、催缴与缴费登记（Mock）</p>
      </div>

      <div class="page__headerActions">
        <button class="btn btn--warn" :disabled="pending || filteredBills.length === 0" @click="bulkRemind">
          批量催缴
        </button>
      </div>
    </div>

    <div class="filterCard">
      <select v-model="statusFilter" class="select">
        <option value="all">全部状态</option>
        <option value="Unpaid">待缴</option>
        <option value="Overdue">逾期</option>
        <option value="Paid">已缴</option>
      </select>

      <div class="countHint">共 {{ filteredBills.length }} 条账单</div>
    </div>

    <div v-if="pending" class="loading">
      <RefreshCw :size="24" class="spinning" />
      <span>加载中...</span>
    </div>

    <div v-else class="content">
      <OperatingRentBillList
        :items="filteredBills"
        :admin-mode="true"
        @remind="handleRemind"
        @pay="openPay"
      />
    </div>

    <OperatingRentPaymentModal
      v-if="payingBill"
      :is-open="true"
      :bill="payingBill"
      @close="payingBill = null"
      @submit="handlePaySubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { useOperatingOverview } from '~/composables/property/useOperatingOverview'
import { payRentBill, remindRentBill } from '~/services/operating'
import type { OperatingRentBill } from '~/services/operating'
import OperatingRentBillList from '~/components/admin/property/operating/components/OperatingRentBillList.vue'
import OperatingRentPaymentModal from '~/components/admin/property/operating/components/OperatingRentPaymentModal.vue'

const { rentBills, pending, refresh } = useOperatingOverview()

const statusFilter = ref<'all' | 'Unpaid' | 'Overdue' | 'Paid'>('all')

const filteredBills = computed(() => {
  let result = rentBills.value

  if (statusFilter.value !== 'all') {
    result = result.filter((b) => b.status === statusFilter.value)
  }

  return result
})

const payingBill = ref<OperatingRentBill | null>(null)

function openPay(b: OperatingRentBill) {
  payingBill.value = b
}

async function handleRemind(b: OperatingRentBill) {
  try {
    await remindRentBill(b.id)
    await refresh()
    alert(`催缴成功：已向 ${b.tenant} 发送通知`)
  } catch (e: any) {
    alert(e?.statusMessage || e?.message || '催缴失败')
  }
}

async function bulkRemind() {
  const targets = filteredBills.value.filter((b) => b.status !== 'Paid')
  if (targets.length === 0) {
    alert('没有需要催缴的账单')
    return
  }

  try {
    await Promise.all(targets.map((b) => remindRentBill(b.id)))
    await refresh()
    alert(`已批量向 ${targets.length} 条账单发送催缴通知`)
  } catch (e: any) {
    alert(e?.statusMessage || e?.message || '批量催缴失败')
  }
}

async function handlePaySubmit(payload: { amount: number; method: string; transactionNo: string }) {
  if (!payingBill.value) return

  try {
    await payRentBill({
      billId: payingBill.value.id,
      amount: payload.amount,
      method: payload.method,
      transactionNo: payload.transactionNo,
    })
    await refresh()
    payingBill.value = null
  } catch (e: any) {
    alert(e?.statusMessage || e?.message || '登记缴费失败')
  }
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.page__headerActions {
  display: flex;
  gap: 10px;
}

.page__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}

.page__subtitle {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}

.filterCard {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.countHint {
  font-size: 13px;
  color: var(--muted);
}

.loading {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
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

.content {
  display: grid;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border);
  background: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--warn {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #fff;
}

.btn--warn:hover:not(:disabled) {
  background: #d97706;
  border-color: #d97706;
}
</style>
