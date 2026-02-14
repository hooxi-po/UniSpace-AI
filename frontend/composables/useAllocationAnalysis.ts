import { computed, onMounted, ref } from 'vue'
import { allocationService } from '~/services/allocation'
import { fixationService } from '~/services/fixation'
import type { AllocationRequest, AdjustmentRequest, TemporaryBorrow } from '~/server/utils/allocation-db'
import type { Room } from '~/server/utils/fixation-stock-db'

export function useAllocationAnalysis() {
  const requests = ref<AllocationRequest[]>([])
  const adjustments = ref<AdjustmentRequest[]>([])
  const borrows = ref<TemporaryBorrow[]>([])
  const rooms = ref<Room[]>([])
  const loading = ref(false)

  async function fetchData() {
    loading.value = true
    try {
      const [reqRes, stockRes, adjRes, borrowRes] = await Promise.all([
        allocationService.fetchRequests(),
        fixationService.fetchStock(),
        $fetch<{ list: AdjustmentRequest[] }>('/api/allocation/adjustments'),
        $fetch<{ list: TemporaryBorrow[] }>('/api/allocation/borrows')
      ])
      requests.value = reqRes.list
      rooms.value = stockRes.rooms
      adjustments.value = adjRes.list
      borrows.value = borrowRes.list
    } catch (err) {
      console.error('Failed to fetch analysis data:', err)
    } finally {
      loading.value = false
    }
  }

  const stats = computed(() => {
    const totalRequests = requests.value.length
    const pendingApproval = requests.value.filter(r => r.status === 'Pending').length
    const approved = requests.value.filter(r => r.status === 'Approved').length
    const rejected = requests.value.filter(r => r.status === 'Rejected').length

    const totalRooms = rooms.value.length
    const availableRooms = rooms.value.filter(r => r.status === 'Empty').length
    const occupiedRooms = rooms.value.filter(r => r.status === 'Occupied').length
    const totalAvailableArea = rooms.value.filter(r => r.status === 'Empty').reduce((acc, r) => acc + (r.area || 0), 0)

    const expiringBorrows = borrows.value.filter(b => {
      if (b.status !== 'Active') return false
      const daysLeft = Math.ceil((new Date(b.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 30
    }).length

    return {
      totalRequests,
      pendingApproval,
      approved,
      rejected,
      totalRooms,
      availableRooms,
      occupiedRooms,
      totalAvailableArea,
      expiringBorrows
    }
  })

  const buildingDistribution = computed(() => {
    const buildings = [...new Set(rooms.value.map(r => r.buildingName))]
    return buildings.map(name => {
      const buildingRooms = rooms.value.filter(r => r.buildingName === name)
      const available = buildingRooms.filter(r => r.status === 'Empty').length
      return {
        name,
        total: buildingRooms.length,
        available
      }
    }).sort((a, b) => b.total - a.total)
  })

  onMounted(() => {
    fetchData()
  })

  return {
    loading,
    stats,
    buildingDistribution,
    fetchData
  }
}

