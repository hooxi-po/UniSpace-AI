import { computed, onMounted, ref } from 'vue'
import { chargingService } from '~/services/charging'
import type { ExtendedDepartmentFee, FeeStatus, ReminderRecord } from '~/server/utils/charging-db'

export function useChargingOverview() {
  const fees = ref<ExtendedDepartmentFee[]>([])
  const loading = ref(false)
  const yearFilter = ref(2025)
  const statusFilter = ref<FeeStatus | 'all'>('all')
  const searchTerm = ref('')

  async function fetchFees() {
    loading.value = true
    try {
      const res = await chargingService.fetchFees()
      fees.value = res.list
    } catch (err) {
      console.error('Failed to fetch fees:', err)
    } finally {
      loading.value = false
    }
  }

  const filteredFees = computed(() => {
    return fees.value.filter(f => {
      const matchSearch = f.departmentName.includes(searchTerm.value)
      const matchStatus = statusFilter.value === 'all' || f.status === statusFilter.value
      const matchYear = f.year === yearFilter.value
      return matchSearch && matchStatus && matchYear
    })
  })

  const stats = computed(() => {
    const currentYearFees = fees.value.filter(f => f.year === yearFilter.value)
    return {
      totalAmount: currentYearFees.reduce((acc, f) => acc + f.totalCost, 0),
      paidAmount: currentYearFees.reduce((acc, f) => acc + f.paidAmount, 0),
      pendingCount: currentYearFees.filter(f => ['BillGenerated', 'PendingConfirm'].includes(f.status)).length,
      overQuotaCount: currentYearFees.filter(f => f.excessArea > 0).length,
    }
  })

  const chartData = computed(() => {
    return filteredFees.value.map(f => ({
      name: f.departmentName.replace('学院', ''),
      quota: f.quotaArea,
      actual: f.actualArea,
      excess: f.excessArea,
      cost: f.totalCost,
    }))
  })

  async function sendReminder(payload: { fee: ExtendedDepartmentFee; reminderType: ReminderRecord['reminderType']; content: string }) {
    await chargingService.sendReminder({
      feeId: payload.fee.id,
      reminderType: payload.reminderType,
      content: payload.content,
    })
    await fetchFees()
  }

  async function generateBill(fee: ExtendedDepartmentFee) {
    await chargingService.updateFee(
      fee.id,
      {
        status: 'BillGenerated',
      },
      `生成账单：${fee.departmentName}`
    )
    await fetchFees()
  }

  async function pushConfirm(fee: ExtendedDepartmentFee) {
    await chargingService.updateFee(
      fee.id,
      {
        status: 'PendingConfirm',
      },
      `推送学院确认：${fee.departmentName}`
    )
    await fetchFees()
  }

  async function confirmBill(fee: ExtendedDepartmentFee) {
    await chargingService.updateFee(
      fee.id,
      {
        status: 'FinanceProcessing',
        confirmedAt: new Date().toISOString().split('T')[0],
      },
      `学院确认账单：${fee.departmentName}`
    )
    await fetchFees()
  }

  async function confirmPayment(fee: ExtendedDepartmentFee) {
    await chargingService.recordDepartmentPayment({
      feeId: fee.id,
      billId: `BILL-${fee.departmentName}-${fee.month}`,
      billNo: `GF-${fee.month}-${fee.departmentName.slice(0, 4)}`,
      departmentName: fee.departmentName,
      amount: fee.remainingAmount,
      paymentMethod: 'FinanceDeduction',
      paymentDate: new Date().toISOString().split('T')[0],
      operator: '财务处',
    })
    await fetchFees()
  }

  onMounted(fetchFees)

  return {
    fees,
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
  }
}
