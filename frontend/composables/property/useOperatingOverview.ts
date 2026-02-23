import { computed } from 'vue'
import { getOperatingOverview } from '~/services/operating'

const PERIOD_PATTERN = /^\d{4}-\d{2}$/

function getLocalPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getRecentMonths(endMonth: string, count: number) {
  const [year, month] = endMonth.split('-').map(Number)
  const base = Number.isFinite(year) && Number.isFinite(month)
    ? new Date(year, month - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const months: string[] = []

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return months
}

export function useOperatingOverview() {
  const { data, pending, error, refresh } = useAsyncData('operating-overview', () => getOperatingOverview())

  const spaces = computed(() => data.value?.spaces || [])
  const contracts = computed(() => data.value?.contracts || [])
  const rentBills = computed(() => data.value?.rentBills || [])
  const periods = computed(() => {
    const values = rentBills.value
      .map(b => b.period)
      .filter((period): period is string => PERIOD_PATTERN.test(period))
    return [...new Set(values)].sort()
  })
  const activePeriod = computed(() => {
    const currentPeriod = getLocalPeriod()
    if (periods.value.includes(currentPeriod)) return currentPeriod
    return periods.value[periods.value.length - 1] || currentPeriod
  })

  const stats = computed(() => {
    const activeContracts = contracts.value.filter(c => c.status === 'Active').length
    const expiringContracts = contracts.value.filter(c => c.status === 'Expiring').length

    const totalRentReceivable = rentBills.value
      .filter(b => b.status !== 'Paid')
      .reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0)

    const overdueAmount = rentBills.value
      .filter(b => b.status === 'Overdue')
      .reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0)

    const monthlyIncome = rentBills.value
      .filter(b => b.period === activePeriod.value)
      .reduce((sum, b) => sum + Math.min(b.totalAmount, Math.max(0, b.paidAmount || 0)), 0)

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
    const months = periods.value.length > 0
      ? periods.value.slice(-4)
      : getRecentMonths(activePeriod.value, 4)
    const receivablePerMonth = contracts.value.reduce((sum, c) => sum + c.rentPerMonth, 0) / 10000

    return months.map(m => {
      const paid = rentBills.value
        .filter(b => b.period === m)
        .reduce((sum, b) => sum + Math.min(b.totalAmount, Math.max(0, b.paidAmount || 0)), 0)
        / 10000

      return {
        month: m.slice(5),
        receivable: Number(receivablePerMonth.toFixed(2)),
        paid: Number(paid.toFixed(2)),
      }
    })
  })

  const collectionRates = computed(() => {
    return contracts.value.map(c => {
      const bills = rentBills.value.filter(b => b.contractId === c.id && b.period === activePeriod.value)
      const paid = bills.reduce((sum, b) => sum + Math.min(b.totalAmount, Math.max(0, b.paidAmount || 0)), 0)
      const total = bills.reduce((sum, b) => sum + b.totalAmount, 0)
      // 方案 A：若本月无账单，则视为无应收，展示 0%
      const rate = total > 0 ? Math.min(100, (paid / total) * 100) : 0

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
      const totalReceived = bills.reduce((sum, b) => {
        return sum + Math.min(b.totalAmount, Math.max(0, b.paidAmount || 0))
      }, 0)
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
