import { computed, onMounted, ref } from 'vue'
import { apartmentsService, type ApartmentRoom, type DormType } from '~/services/apartments'

export const useApartmentsRooms = () => {
  const loading = ref(false)
  const operating = ref(false)
  const draftKeyword = ref('')
  const selectedType = ref<'all' | 'Student' | 'TeacherApartment'>('all')
  const selectedStatus = ref<'all' | 'Empty' | 'Occupied'>('all')
  const appliedKeyword = ref('')
  const rooms = ref<ApartmentRoom[]>([])

  const vacateOpen = ref(false)
  const reassignOpen = ref(false)
  const activeRoom = ref<ApartmentRoom | null>(null)
  const reassignType = ref<DormType>('学生宿舍')
  const reassignDepartment = ref('')
  const noticeRemark = ref('')
  const oldTenantName = ref('')

  const filteredRooms = computed(() => {
    const key = appliedKeyword.value.trim().toLowerCase()
    return rooms.value.filter((r) => {
      if (selectedType.value !== 'all' && r.type !== selectedType.value) return false
      if (selectedStatus.value !== 'all' && r.status !== selectedStatus.value) return false
      if (!key) return true
      return [
        r.buildingName,
        r.buildingCode,
        r.roomNo,
        r.department,
        r.statusCn,
      ].some((v) => String(v || '').toLowerCase().includes(key))
    })
  })

  const stats = computed(() => {
    const total = filteredRooms.value.length
    const occupied = filteredRooms.value.filter(r => r.status === 'Occupied').length
    const empty = total - occupied
    return { total, occupied, empty }
  })

  async function loadRooms() {
    loading.value = true
    try {
      const resp = await apartmentsService.getRooms({
        type: selectedType.value === 'all' ? undefined : selectedType.value,
        status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
      })
      rooms.value = resp.rooms || []
    } finally {
      loading.value = false
    }
  }

  function applySearch() {
    appliedKeyword.value = draftKeyword.value
  }

  function resetSearch() {
    draftKeyword.value = ''
    appliedKeyword.value = ''
    selectedType.value = 'all'
    selectedStatus.value = 'all'
    loadRooms()
  }

  function openVacate(room: ApartmentRoom) {
    activeRoom.value = room
    oldTenantName.value = room.department || ''
    noticeRemark.value = ''
    vacateOpen.value = true
  }

  function openReassign(room: ApartmentRoom) {
    activeRoom.value = room
    reassignType.value = room.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍'
    reassignDepartment.value = room.department || ''
    noticeRemark.value = ''
    reassignOpen.value = true
  }

  function closeDialogs() {
    vacateOpen.value = false
    reassignOpen.value = false
    activeRoom.value = null
    noticeRemark.value = ''
    oldTenantName.value = ''
  }

  async function confirmVacate() {
    if (!activeRoom.value) return
    operating.value = true
    try {
      await $fetch('/api/apartments/room-vacate', {
        method: 'PATCH',
        body: { roomId: activeRoom.value.id },
      })
      await $fetch('/api/allocation/notifications', {
        method: 'POST',
        body: {
          targetType: 'ROOM',
          targetId: activeRoom.value.id,
          targetName: `${activeRoom.value.buildingName} ${activeRoom.value.roomNo}`,
          level: 'INFO',
          channel: 'SYSTEM',
          content: `腾退通知：${activeRoom.value.buildingName}${activeRoom.value.roomNo}${oldTenantName.value ? `，原住户：${oldTenantName.value}` : ''}${noticeRemark.value ? `，备注：${noticeRemark.value}` : ''}`,
        },
      })
      closeDialogs()
      await loadRooms()
    } finally {
      operating.value = false
    }
  }

  async function confirmReassign() {
    if (!activeRoom.value) return
    operating.value = true
    try {
      await $fetch('/api/apartments/room-reassign', {
        method: 'PATCH',
        body: {
          roomId: activeRoom.value.id,
          tenantType: reassignType.value,
          department: reassignDepartment.value || undefined,
        },
      })
      await $fetch('/api/allocation/notifications', {
        method: 'POST',
        body: {
          targetType: 'ROOM',
          targetId: activeRoom.value.id,
          targetName: `${activeRoom.value.buildingName} ${activeRoom.value.roomNo}`,
          level: 'INFO',
          channel: 'SYSTEM',
          content: `再分配通知：${activeRoom.value.buildingName}${activeRoom.value.roomNo}${oldTenantName.value ? `，原住户：${oldTenantName.value}` : ''}${noticeRemark.value ? `，备注：${noticeRemark.value}` : ''}`,
        },
      })
      closeDialogs()
      await loadRooms()
    } finally {
      operating.value = false
    }
  }

  onMounted(loadRooms)

  return {
    loading,
    operating,
    draftKeyword,
    selectedType,
    selectedStatus,
    filteredRooms,
    stats,
    vacateOpen,
    reassignOpen,
    activeRoom,
    reassignType,
    reassignDepartment,
    noticeRemark,
    oldTenantName,
    applySearch,
    resetSearch,
    loadRooms,
    openVacate,
    openReassign,
    closeDialogs,
    confirmVacate,
    confirmReassign,
  }
}