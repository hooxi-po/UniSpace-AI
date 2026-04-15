import { computed, onMounted, ref } from 'vue'
import { apartmentsService, type ApartmentRoom } from '~/services/apartments'

export type UtilityBill = {
  id: string
  roomId: string
  roomLabel: string
  month: string
  resident: string
  electricUsed: number
  waterUsed: number
  electricFree: number
  waterFree: number
  electricOver: number
  waterOver: number
  amount: number
  status: '未发送' | '已发送' | '发送中' | '发送失败'
  updatedAt: string
  sentAt?: string
  sendChannel?: '系统消息' | '短信' | '邮件'
  lastError?: string
}

const FREE_ELECTRIC = 5
const FREE_WATER = 5
const ELECTRIC_PRICE = 1.2
const WATER_PRICE = 2.0

function toErrorMessage(error: unknown) {
  const err = error as any
  return err?.data?.error || err?.statusMessage || err?.message || '发送失败'
}

export const useApartmentsUtilities = () => {
  const loading = ref(false)
  const syncing = ref(false)
  const sending = ref(false)
  const batchSending = ref(false)

  const draftKeyword = ref('')
  const appliedKeyword = ref('')
  const selectedMonth = ref(new Date().toISOString().slice(0, 7)) // yyyy-MM

  const occupiedRooms = ref<ApartmentRoom[]>([])
  const bills = ref<UtilityBill[]>([])

  const detailOpen = ref(false)
  const activeBill = ref<UtilityBill | null>(null)

  const monthOptions = computed(() => {
    const base = new Set<string>([selectedMonth.value])
    for (const b of bills.value) base.add(b.month)
    return Array.from(base).sort().reverse()
  })

  const filteredBills = computed(() => {
    const key = appliedKeyword.value.trim().toLowerCase()
    return bills.value.filter((b) => {
      if (b.month !== selectedMonth.value) return false
      if (!key) return true
      return [b.id, b.resident, b.roomLabel, b.roomId].some((v) =>
        String(v || '').toLowerCase().includes(key),
      )
    })
  })

  const unsentBills = computed(() => filteredBills.value.filter((b) => b.status !== '已发送'))

  const stats = computed(() => {
    const list = filteredBills.value
    return {
      occupiedCount: occupiedRooms.value.length,
      totalAmount: Number(list.reduce((sum, b) => sum + b.amount, 0).toFixed(2)),
      sentCount: list.filter((b) => b.status === '已发送').length,
      unsentCount: list.filter((b) => b.status !== '已发送').length,
      failedCount: list.filter((b) => b.status === '发送失败').length,
    }
  })

  async function loadOccupiedRooms() {
    loading.value = true
    try {
      const resp = await apartmentsService.getRooms({ status: 'Occupied' })
      occupiedRooms.value = resp.rooms || []
      ensureMonthBills()
    } finally {
      loading.value = false
    }
  }

  function ensureMonthBills() {
    const month = selectedMonth.value
    const incoming = occupiedRooms.value.map((room, idx) => {
      // 预估用量（后续由设备管理真实表计替换）
      const electricUsed = Number((4 + ((idx % 8) + 1) * 0.85).toFixed(1))
      const waterUsed = Number((3 + ((idx % 6) + 1) * 0.75).toFixed(1))

      const electricOver = Math.max(0, Number((electricUsed - FREE_ELECTRIC).toFixed(1)))
      const waterOver = Math.max(0, Number((waterUsed - FREE_WATER).toFixed(1)))
      const amount = Number((electricOver * ELECTRIC_PRICE + waterOver * WATER_PRICE).toFixed(2))

      return {
        id: `UTIL-${month}-${room.id}`,
        roomId: room.id,
        roomLabel: `${room.buildingName} ${room.roomNo}`,
        month,
        resident: room.department || `${room.buildingName}${room.roomNo}住户`,
        electricUsed,
        waterUsed,
        electricFree: FREE_ELECTRIC,
        waterFree: FREE_WATER,
        electricOver,
        waterOver,
        amount,
        status: '未发送' as const,
        updatedAt: new Date().toISOString(),
      }
    })

    const map = new Map(bills.value.map((b) => [b.id, b]))
    for (const item of incoming) {
      if (!map.has(item.id)) {
        map.set(item.id, item)
      }
    }

    // 清理不在当前在住名单中的旧账单（月份一致）
    const occupiedIdSet = new Set(occupiedRooms.value.map(r => r.id))
    for (const [id, bill] of map.entries()) {
      if (bill.month === month && !occupiedIdSet.has(bill.roomId)) {
        map.delete(id)
      }
    }

    bills.value = Array.from(map.values())
  }

  async function syncMetersForMonth() {
    syncing.value = true
    try {
      // 预留：设备管理接入后由后端落地
      await $fetch('/api/apartments/utilities/sync', {
        method: 'POST',
        body: { month: selectedMonth.value },
      })
    } catch {
      // 当前阶段接口可未实现，前端保留入口不阻塞
    } finally {
      ensureMonthBills()
      syncing.value = false
    }
  }

  async function sendBill(bill: UtilityBill) {
    if (bill.status === '已发送' || bill.status === '发送中') return

    bill.status = '发送中'
    bill.lastError = undefined
    bill.updatedAt = new Date().toISOString()
    sending.value = true

    try {
      await $fetch('/api/charging/reminders', {
        method: 'POST',
        body: {
          billId: bill.id,
          billNo: bill.id,
          owner: bill.resident,
          roomNo: bill.roomLabel,
          amountDue: bill.amount,
          action: 'water-electric-bill',
          month: bill.month,
          content: `水电账单提醒：${bill.month}，房间 ${bill.roomLabel}，待缴金额 ¥${bill.amount.toFixed(2)}`,
        },
      })

      bill.status = '已发送'
      bill.sentAt = new Date().toISOString()
      bill.sendChannel = '系统消息'
      bill.lastError = undefined
      bill.updatedAt = new Date().toISOString()
      window.alert(`账单已发送：${bill.roomLabel}（${bill.month}）`)
    } catch (error) {
      bill.status = '发送失败'
      bill.lastError = toErrorMessage(error)
      bill.updatedAt = new Date().toISOString()
      window.alert(`发送失败：${bill.lastError || '请稍后重试'}`)
      throw error
    } finally {
      sending.value = false
    }
  }

  async function sendAllUnsentBills() {
    const candidates = unsentBills.value
    if (!candidates.length) {
      window.alert('当前筛选条件下暂无可发送账单。')
      return
    }

    batchSending.value = true
    let success = 0
    let failed = 0

    try {
      for (const bill of candidates) {
        try {
          await sendBill(bill)
          success += 1
        } catch {
          failed += 1
        }
      }
    } finally {
      batchSending.value = false
    }

    if (failed > 0) {
      window.alert(`账单发送完成：成功 ${success} 条，失败 ${failed} 条。可在列表中查看失败原因。`)
      return
    }

    window.alert(`账单发送完成：成功 ${success} 条。`)
  }

  function openBillDetail(bill: UtilityBill) {
    activeBill.value = bill
    detailOpen.value = true
  }

  function closeBillDetail() {
    detailOpen.value = false
    activeBill.value = null
  }

  function applySearch() {
    appliedKeyword.value = draftKeyword.value
  }

  function resetSearch() {
    draftKeyword.value = ''
    appliedKeyword.value = ''
  }

  onMounted(loadOccupiedRooms)

  return {
    loading,
    syncing,
    sending,
    batchSending,
    draftKeyword,
    selectedMonth,
    monthOptions,
    filteredBills,
    unsentBills,
    stats,
    detailOpen,
    activeBill,
    loadOccupiedRooms,
    syncMetersForMonth,
    sendBill,
    sendAllUnsentBills,
    openBillDetail,
    closeBillDetail,
    applySearch,
    resetSearch,
  }
}
