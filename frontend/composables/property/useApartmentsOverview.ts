import { computed, onMounted, ref } from 'vue'
import { apartmentsService, type DormOverviewRoom, type DormStatus, type DormType } from '~/services/apartments'

export const STATUSES: DormStatus[] = ['空置', '在住', '维修中', '预留']

export const STATUS_META: Record<DormStatus, { dot: string; bg: string; text: string }> = {
  空置: { dot: '#38bdf8', bg: '#e0f2fe', text: '#0369a1' },
  在住: { dot: '#34d399', bg: '#d1fae5', text: '#065f46' },
  维修中: { dot: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  预留: { dot: '#a78bfa', bg: '#ede9fe', text: '#5b21b6' },
}

export function useApartmentsOverview() {
  const viewMode = ref<'card' | 'list'>('card')
  const loading = ref(false)
  const rooms = ref<DormOverviewRoom[]>([])

  const draftKeyword = ref('')
  const appliedKeyword = ref('')
  const selectedType = ref<'all' | DormType>('all')
  const selectedBuilding = ref<string>('all')

  const buildingOptions = computed(() => Array.from(new Set(rooms.value.map(r => r.building).filter(Boolean))))

  const filteredRooms = computed(() => {
    const keyword = appliedKeyword.value.trim().toLowerCase()

    return rooms.value.filter((room) => {
      if (selectedType.value !== 'all' && room.type !== selectedType.value) return false
      if (selectedBuilding.value !== 'all' && room.building !== selectedBuilding.value) return false
      if (!keyword) return true

      const typeText = room.type.toLowerCase()
      const buildingText = room.building.toLowerCase()
      const roomNoText = room.roomNo.toLowerCase()
      const statusText = room.status.toLowerCase()

      return typeText.includes(keyword)
        || buildingText.includes(keyword)
        || roomNoText.includes(keyword)
        || statusText.includes(keyword)
    })
  })

  const studentRooms = computed(() => filteredRooms.value.filter(r => r.type === '学生宿舍'))
  const teacherRooms = computed(() => filteredRooms.value.filter(r => r.type === '教师宿舍'))
  const totalBeds = computed(() => filteredRooms.value.reduce((sum, r) => sum + r.beds, 0))
  const occupiedBeds = computed(() => filteredRooms.value.reduce((sum, r) => sum + r.occupiedBeds, 0))

  const typeOccupancy = computed(() => {
    return (['学生宿舍', '教师宿舍'] as DormType[]).map((type) => {
      const list = filteredRooms.value.filter(r => r.type === type)
      const totalBedsByType = list.reduce((sum, item) => sum + item.beds, 0)
      const occupiedBedsByType = list.reduce((sum, item) => sum + item.occupiedBeds, 0)
      const percent = totalBedsByType ? Number(((occupiedBedsByType / totalBedsByType) * 100).toFixed(1)) : 0
      return {
        type,
        totalBeds: totalBedsByType,
        occupiedBeds: occupiedBedsByType,
        percent,
        color: type === '学生宿舍' ? '#3370ff' : '#10b981',
      }
    })
  })

  const getStatusMeta = (status: DormStatus) => STATUS_META[status]

  const getTypePercent = (type: DormType, status: DormStatus) => {
    const list = filteredRooms.value.filter(r => r.type === type)
    if (!list.length) return 0
    const count = list.filter(r => r.status === status).length
    return Number(((count / list.length) * 100).toFixed(1))
  }

  const applySearch = () => {
    appliedKeyword.value = draftKeyword.value
  }

  const resetSearch = () => {
    draftKeyword.value = ''
    appliedKeyword.value = ''
    selectedType.value = 'all'
    selectedBuilding.value = 'all'
  }

  onMounted(async () => {
    loading.value = true
    try {
      const resp = await apartmentsService.getOverview()
      rooms.value = resp.rooms || []
    } finally {
      loading.value = false
    }
  })

  return {
    viewMode,
    loading,
    filteredRooms,
    studentRooms,
    teacherRooms,
    totalBeds,
    occupiedBeds,
    statuses: STATUSES,
    typeOccupancy,
    draftKeyword,
    selectedType,
    selectedBuilding,
    buildingOptions,
    applySearch,
    resetSearch,
    getStatusMeta,
    getTypePercent,
  }
}

