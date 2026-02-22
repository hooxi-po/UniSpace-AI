import { computed } from 'vue'
import { getOperatingOverview } from '~/services/operating'

export function useOperatingOverview() {
  const { data, pending, error, refresh } = useAsyncData('operating-overview', () => getOperatingOverview())

  const spaces = computed(() => data.value?.spaces || [])
  const contracts = computed(() => data.value?.contracts || [])
  const rentBills = computed(() => data.value?.rentBills || [])

  const stats = computed(() => {
    const activeContracts = contracts.value.filter(c => c.status === 'Active').length
    const expiringContracts = contracts.value.filter(c => c.status === 'Expiring').length

    const totalRentReceivable = rentBills.value
      .filter(b => b.status !== 'Paid')
      .reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0)

    const overdueAmount = rentBills.value
      .filter(b => b.status === 'Overdue')
      .reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0)

    // 当前 mock 用固定月份；后续可由接口返回“当前月份”或服务端计算
    const month = '2025-01'
    const monthlyIncome = rentBills.value
      .filter(b => b.period === month && b.status === 'Paid')
      .reduce((sum, b) => sum + b.paidAmount, 0)

    const availableSpaces = spaces.value.filter(s => s.status === '公开招租').length

    return {
      activeContracts,
      expiringContracts,
      totalRentReceivable,
      overdueAmount,
      monthlyIncome,
      availableSpaces,
    }
  })

  const getDaysToExpiry = (endDate: string) => {
    return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  const expiringItems = computed(() => {
    return contracts.value
      .filter(c => c.status === 'Expiring')
      .map(c => ({
        id: c.id,
        tenant: c.tenant,
        spaceName: c.spaceName,
        endDate: c.endDate,
        days: getDaysToExpiry(c.endDate),
      }))
  })

  const rentTrend = computed(() => {
    const months = ['2024-10', '2024-11', '2024-12', '2025-01']
    const receivablePerMonth = contracts.value.reduce((sum, c) => sum + c.rentPerMonth, 0) / 10000

    return months.map(m => {
      const paid = rentBills.value
        .filter(b => b.period === m && b.status === 'Paid')
        .reduce((sum, b) => sum + b.paidAmount, 0)
        / 10000

      return {
        month: m.slice(5),
        receivable: Number(receivablePerMonth.toFixed(2)),
        paid: Number(paid.toFixed(2)),
      }
    })
  })

  const collectionRates = computed(() => {
    const month = '2025-01'

    return contracts.value.map(c => {
      const bills = rentBills.value.filter(b => b.contractId === c.id && b.period === month)
      const paid = bills.filter(b => b.status === 'Paid').reduce((sum, b) => sum + b.paidAmount, 0)
      const total = bills.reduce((sum, b) => sum + b.totalAmount, 0)
      // 方案 A：若本月无账单，则视为无应收，展示 0%
      const rate = total > 0 ? (paid / total) * 100 : 0

      return {
        contractId: c.id,
        tenant: c.tenant,
        rate,
      }
    })
  })

  const tenantRankings = computed(() => {
    return contracts.value.map(c => {
      const bills = rentBills.value.filter(b => b.contractId === c.id)
      const totalReceived = bills.filter(b => b.status === 'Paid' || b.status === 'PartialPaid').reduce((sum, b) => sum + b.paidAmount, 0)
      const outstanding = bills.filter(b => b.status !== 'Paid').reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0)
      
      // 模拟评分逻辑：根据欠费情况给分
      let rating = 5
      if (outstanding > 50000) rating = 2
      else if (outstanding > 20000) rating = 3
      else if (outstanding > 0) rating = 4

      return {
        id: c.id,
        tenant: c.tenant,
        spaceName: c.spaceName,
        totalReceived,
        outstanding,
        rating
      }
    }).sort((a, b) => b.totalReceived - a.totalReceived)
  })

  return {
    data,
    pending,
    error,
    refresh,
    spaces,
    contracts,
    rentBills,
    stats,
    expiringItems,
    rentTrend,
    collectionRates,
    tenantRankings,
  }
}


