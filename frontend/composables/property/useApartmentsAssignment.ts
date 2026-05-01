import { computed, onMounted, reactive, ref } from 'vue'
import { apartmentsService, type ApartmentRoom } from '~/services/apartments'

type DormPersonType = '学生' | '教师'

type AssignForm = {
  roomId: string
  roomLabel: string
  personType: DormPersonType
  personName: string
  personNo: string
  department: string
}

type BedAssignableRoom = ApartmentRoom & {
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
}

const DEFAULT_FORM: AssignForm = {
  roomId: '',
  roomLabel: '',
  personType: '学生',
  personName: '',
  personNo: '',
  department: '',
}

export const useApartmentsAssignment = () => {
  const loading = ref(false)
  const assigning = ref(false)

  const draftKeyword = ref('')
  const appliedKeyword = ref('')
  const selectedType = ref<'all' | 'Student' | 'TeacherApartment'>('all')

  const rooms = ref<BedAssignableRoom[]>([])

  const assignOpen = ref(false)
  const activeRoom = ref<BedAssignableRoom | null>(null)
  const form = reactive<AssignForm>({ ...DEFAULT_FORM })

  const filteredRooms = computed(() => {
    const key = appliedKeyword.value.trim().toLowerCase()
    return rooms.value.filter((r) => {
      if (selectedType.value !== 'all' && r.type !== selectedType.value) return false
      if (r.availableBeds <= 0) return false
      if (!key) return true
      return [
        r.buildingName,
        r.buildingCode,
        r.roomNo,
        r.department,
        r.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍',
      ].some((v) => String(v || '').toLowerCase().includes(key))
    })
  })

  const stats = computed(() => ({
    roomCount: filteredRooms.value.length,
    totalAvailableBeds: filteredRooms.value.reduce((sum, r) => sum + r.availableBeds, 0),
  }))

  async function loadRooms() {
    loading.value = true
    try {
      const resp = await apartmentsService.getRooms({ status: 'Empty' })
      rooms.value = (resp.rooms || [])
        .filter((r) => r.type === 'Student' || r.type === 'TeacherApartment')
        .map((r, idx) => {
          const totalBeds = r.type === 'TeacherApartment' ? 2 : 4
          const occupiedBeds = 0
          const availableBeds = totalBeds - occupiedBeds
          return {
            ...r,
            totalBeds,
            occupiedBeds,
            availableBeds,
            // 给没有部门信息的空房间展示默认值
            department: r.department || (idx % 2 === 0 ? '待分配' : ''),
          }
        })
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
  }

  function openAssign(room: BedAssignableRoom) {
    activeRoom.value = room
    form.roomId = room.id
    form.roomLabel = `${room.buildingName} ${room.roomNo}`
    form.personType = room.type === 'TeacherApartment' ? '教师' : '学生'
    form.personName = ''
    form.personNo = ''
    form.department = ''
    assignOpen.value = true
  }

  function closeAssign() {
    assignOpen.value = false
    activeRoom.value = null
  }

  async function submitAssign() {
    if (!activeRoom.value) return
    if (!form.personName.trim() || !form.personNo.trim()) return

    assigning.value = true
    try {
      await $fetch('/api/apartments/room-reassign', {
        method: 'PATCH',
        body: {
          roomId: activeRoom.value.id,
          tenantType: form.personType === '教师' ? '教师宿舍' : '学生宿舍',
          department: form.department || form.personName,
        },
      })

      await $fetch('/api/allocation/notifications', {
        method: 'POST',
        body: {
          targetType: 'ROOM',
          targetId: activeRoom.value.id,
          targetName: form.roomLabel,
          level: 'INFO',
          channel: 'SYSTEM',
          content: `床位分配通知：${form.roomLabel} 已分配给${form.personType} ${form.personName}（${form.personNo}）`,
        },
      })

      closeAssign()
      await loadRooms()
    } finally {
      assigning.value = false
    }
  }

  onMounted(loadRooms)

  return {
    loading,
    assigning,
    draftKeyword,
    selectedType,
    filteredRooms,
    stats,
    assignOpen,
    activeRoom,
    form,
    applySearch,
    resetSearch,
    openAssign,
    closeAssign,
    submitAssign,
  }
}