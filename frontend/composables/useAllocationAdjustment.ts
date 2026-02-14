import { computed, onMounted, ref } from 'vue'
import type { AdjustmentRequest, TemporaryBorrow } from '~/server/utils/allocation-db'
import { fixationService } from '~/services/fixation'
import { useListFetcher } from '~/composables/shared/useListFetcher'

export function useAllocationAdjustment() {
  const {
    list: adjustments,
    loading: adjustmentsLoading,
    error: adjustmentsError,
    fetchList: fetchAdjustments,
    updateItem: updateAdjustment,
    prependItem: prependAdjustment,
  } = useListFetcher<AdjustmentRequest>(async () => {
    const res = await $fetch<{ list: AdjustmentRequest[] }>('/api/allocation/adjustments')
    return res.list
  }, { immediate: false })

  const borrows = ref<TemporaryBorrow[]>([])
  const borrowsLoading = ref(false)

  async function fetchBorrows() {
    borrowsLoading.value = true
    try {
      const res = await $fetch<{ list: TemporaryBorrow[] }>('/api/allocation/borrows')
      borrows.value = res.list
    } finally {
      borrowsLoading.value = false
    }
  }

  async function createBorrow(data: Omit<TemporaryBorrow, 'id' | 'status'>) {
    const res = await $fetch<{ borrow: TemporaryBorrow }>('/api/allocation/borrows', {
      method: 'POST',
      body: data
    })
    borrows.value.unshift(res.borrow)
    return res.borrow
  }

  const stockRooms = ref<any[]>([])
  async function fetchStockRooms() {
    const res = await fixationService.fetchStock()
    stockRooms.value = res.rooms || []
  }

  async function createAdjustment(data: Omit<AdjustmentRequest, 'id' | 'createdAt' | 'status'>) {
    const res = await $fetch<{ request: AdjustmentRequest }>('/api/allocation/adjustments', {
      method: 'POST',
      body: data
    })
    prependAdjustment(res.request)
    return res.request
  }

  async function approveAdjustment(id: string) {
    const res = await $fetch<{ request: AdjustmentRequest }>('/api/allocation/adjustments', {
      method: 'PATCH',
      body: { 
        id, 
        updates: { status: 'Approved', approvedAt: new Date().toISOString().split('T')[0] },
        logSummary: '审批通过用房调整申请'
      }
    })
    updateAdjustment(id, res.request)
    return res.request
  }

  async function allocateAdjustment(id: string, toRoom: { buildingName: string, roomNo: string, area: number }) {
    const res = await $fetch<{ request: AdjustmentRequest }>('/api/allocation/adjustments', {
      method: 'PATCH',
      body: {
        id,
        updates: {
          status: 'Allocated',
          toBuildingName: toRoom.buildingName,
          toRoomNo: toRoom.roomNo,
          toArea: toRoom.area,
          allocatedAt: new Date().toISOString().split('T')[0]
        },
        logSummary: `为调整申请分配房源：${toRoom.buildingName}${toRoom.roomNo}`
      }
    })
    updateAdjustment(id, res.request)
    return res.request
  }

  async function completeAdjustment(id: string) {
    const res = await $fetch<{ request: AdjustmentRequest }>('/api/allocation/adjustments', {
      method: 'PATCH',
      body: {
        id,
        updates: { status: 'Completed', completedAt: new Date().toISOString().split('T')[0] },
        logSummary: '确认完成用房调整'
      }
    })
    updateAdjustment(id, res.request)
    return res.request
  }

  onMounted(() => {
    fetchAdjustments()
    fetchBorrows()
    fetchStockRooms()
  })

  return {
    adjustments,
    adjustmentsLoading,
    borrows,
    borrowsLoading,
    stockRooms,
    createAdjustment,
    approveAdjustment,
    allocateAdjustment,
    completeAdjustment,
    createBorrow,
    fetchAdjustments,
    fetchBorrows
  }
}

