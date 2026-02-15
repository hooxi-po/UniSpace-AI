import { computed, onMounted, ref } from 'vue'
import { chargingService } from '~/services/charging'
import type { PersonFeeBill, PersonPayment, PersonTitle, PersonUsage } from '~/server/utils/charging-db'

export function useChargingPersonal() {
  const month = ref<string>('2025-01')
  const year = ref<number>(2025)

  const searchTerm = ref<string>('')
  const deptFilter = ref<string>('all')
  const titleFilter = ref<PersonTitle | 'all'>('all')

  const loadingUsages = ref(false)
  const loadingBills = ref(false)
  const creatingBills = ref(false)
  const paying = ref(false)

  const personUsages = ref<PersonUsage[]>([])
  const personBills = ref<PersonFeeBill[]>([])

  const filteredUsages = computed(() => {
    return personUsages.value.filter(u => {
      const matchSearch = !searchTerm.value || u.personName.includes(searchTerm.value) || u.departmentName.includes(searchTerm.value)
      const matchDept = deptFilter.value === 'all' || u.departmentName === deptFilter.value
      const matchTitle = titleFilter.value === 'all' || u.title === titleFilter.value
      return matchSearch && matchDept && matchTitle
    })
  })

  const filteredBills = computed(() => {
    return personBills.value.filter(b => {
      const matchSearch = !searchTerm.value || b.personName.includes(searchTerm.value) || b.departmentName.includes(searchTerm.value)
      const matchDept = deptFilter.value === 'all' || b.departmentName === deptFilter.value
      return matchSearch && matchDept
    })
  })

  const departmentOptions = computed(() => {
    const set = new Set<string>()
    personUsages.value.forEach(u => set.add(u.departmentName))
    personBills.value.forEach(b => set.add(b.departmentName))
    return Array.from(set)
  })

  async function fetchUsages() {
    loadingUsages.value = true
    try {
      const res = await chargingService.fetchPersonUsages(month.value)
      personUsages.value = res.list
    } finally {
      loadingUsages.value = false
    }
  }

  async function fetchBills() {
    loadingBills.value = true
    try {
      const res = await chargingService.fetchPersonBills(year.value)
      personBills.value = res.list
    } finally {
      loadingBills.value = false
    }
  }

  async function generateBills() {
    creatingBills.value = true
    try {
      const res = await chargingService.generatePersonBills(month.value)
      // 生成后按年刷新账单
      await fetchBills()
      // 同时刷新当月使用情况
      await fetchUsages()
      return res.list
    } finally {
      creatingBills.value = false
    }
  }

  async function recordPayment(payload: {
    bill: PersonFeeBill
    paymentMethod: PersonPayment['paymentMethod']
  }) {
    paying.value = true
    try {
      await chargingService.recordPersonPayment({
        billId: payload.bill.id,
        personName: payload.bill.personName,
        amount: payload.bill.amount,
        paymentMethod: payload.paymentMethod,
        paymentDate: new Date().toISOString().split('T')[0],
      })
      await fetchBills()
    } finally {
      paying.value = false
    }
  }

  function setMonth(next: string) {
    month.value = next
    const y = Number(next.slice(0, 4))
    if (!Number.isNaN(y)) year.value = y
  }

  onMounted(async () => {
    await fetchUsages()
    await fetchBills()
  })

  return {
    month,
    year,
    searchTerm,
    deptFilter,
    titleFilter,

    loadingUsages,
    loadingBills,
    creatingBills,
    paying,

    personUsages,
    personBills,
    filteredUsages,
    filteredBills,
    departmentOptions,

    fetchUsages,
    fetchBills,
    generateBills,
    recordPayment,
    setMonth,
  }
}

