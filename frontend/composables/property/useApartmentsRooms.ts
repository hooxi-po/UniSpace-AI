import { computed, onMounted, ref, watch } from 'vue'
import { apartmentsService, type ApartmentRoom, type DormType } from '~/services/apartments'

function buildBeds(room: ApartmentRoom | null) {
  if (!room) return [] as string[]
  const bedCount = room.type === 'TeacherApartment' ? 2 : 4
  return Array.from({ length: bedCount }, (_, i) => `${i + 1}号床`)
}

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

  const sourceBedNo = ref('')
  const targetBuildingCode = ref('')
  const targetFloor = ref<number | null>(null)
  const targetRoomId = ref('')
  const targetBedNo = ref('')

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

  const sourceBeds = computed(() => buildBeds(activeRoom.value))

  const targetCandidates = computed(() => {
    const currentRoom = activeRoom.value
    if (!currentRoom) return [] as ApartmentRoom[]

    return rooms.value.filter((r) => {
      if (r.id === currentRoom.id) return false
      if (r.type !== currentRoom.type) return false
      if (!targetBuildingCode.value) return true
      if ((r.buildingCode || '') !== targetBuildingCode.value) return false
      if (!targetFloor.value) return true
      return r.floor === targetFloor.value
    })
  })

  const targetBuildingOptions = computed(() => {
    const map = new Map<string, string>()
    const sameTypeRooms = rooms.value.filter(r => !activeRoom.value || r.type === activeRoom.value.type)
    sameTypeRooms.forEach((r) => {
      const code = String(r.buildingCode || '').trim()
      if (!code) return
      if (!map.has(code)) map.set(code, `${r.buildingName} (${code})`)
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  })

  const targetFloorOptions = computed(() => {
    const floors = new Set<number>()
    const filtered = rooms.value.filter((r) => {
      if (activeRoom.value && r.type !== activeRoom.value.type) return false
      if (targetBuildingCode.value && (r.buildingCode || '') !== targetBuildingCode.value) return false
      return true
    })
    filtered.forEach(r => floors.add(r.floor))
    return Array.from(floors).sort((a, b) => a - b)
  })

  const targetRoomOptions = computed(() => {
    return targetCandidates.value.map((r) => ({
      value: r.id,
      label: `${r.buildingName} ${r.floor}层 ${r.roomNo}（${r.status === 'Occupied' ? '在住' : '空置'}）`,
    }))
  })

  const targetBeds = computed(() => {
    const room = rooms.value.find(r => r.id === targetRoomId.value) || null
    return buildBeds(room)
  })

  const bedTransferPreview = computed(() => {
    if (!activeRoom.value || !sourceBedNo.value || !targetRoomId.value || !targetBedNo.value) return ''
    const targetRoom = rooms.value.find(r => r.id === targetRoomId.value)
    if (!targetRoom) return ''
    return `确认后将从 ${activeRoom.value.buildingName}-${activeRoom.value.roomNo}-${sourceBedNo.value} 调整到 ${targetRoom.buildingName}-${targetRoom.roomNo}-${targetBedNo.value}，并发送床位调整通知。`
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

  watch([selectedType, selectedStatus], () => {
    loadRooms()
  })

  watch([targetBuildingCode], () => {
    targetFloor.value = null
    targetRoomId.value = ''
    targetBedNo.value = ''
  })

  watch([targetFloor], () => {
    targetRoomId.value = ''
    targetBedNo.value = ''
  })

  watch([targetRoomId], () => {
    targetBedNo.value = ''
  })

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
    if (room.status !== 'Occupied') {
      window.alert('当前房间非在住状态，无需腾退。')
      return
    }
    activeRoom.value = room
    oldTenantName.value = room.department || ''
    noticeRemark.value = ''
    vacateOpen.value = true
  }

  function openReassign(room: ApartmentRoom) {
    if (room.status !== 'Occupied') {
      window.alert('仅在住房间可执行床位再分配。')
      return
    }
    activeRoom.value = room
    reassignType.value = room.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍'
    reassignDepartment.value = room.department || ''
    oldTenantName.value = room.department || ''
    sourceBedNo.value = ''
    targetBuildingCode.value = ''
    targetFloor.value = null
    targetRoomId.value = ''
    targetBedNo.value = ''
    noticeRemark.value = ''
    reassignOpen.value = true
  }

  function closeDialogs() {
    vacateOpen.value = false
    reassignOpen.value = false
    activeRoom.value = null
    noticeRemark.value = ''
    oldTenantName.value = ''
    sourceBedNo.value = ''
    targetBuildingCode.value = ''
    targetFloor.value = null
    targetRoomId.value = ''
    targetBedNo.value = ''
  }

  async function confirmVacate() {
    if (!activeRoom.value) return
    operating.value = true
    try {
      await apartmentsService.vacateRoom(activeRoom.value.id)
      await apartmentsService.sendRoomNotice({
        roomId: activeRoom.value.id,
        roomNo: activeRoom.value.roomNo,
        buildingName: activeRoom.value.buildingName,
        action: '腾退通知',
        oldTenant: oldTenantName.value || undefined,
        remark: noticeRemark.value || undefined,
      })
      closeDialogs()
      await loadRooms()
    } catch (error: any) {
      const message = error?.message || '腾退失败，请重试'
      window.alert(message)
    } finally {
      operating.value = false
    }
  }

  async function confirmReassign() {
    if (!activeRoom.value) return
    if (!sourceBedNo.value) {
      window.alert('请选择来源床位。')
      return
    }
    if (!targetRoomId.value || !targetBedNo.value) {
      window.alert('请完整选择目标楼栋、楼层、房间和床位。')
      return
    }
    const targetRoom = rooms.value.find(r => r.id === targetRoomId.value)
    if (!targetRoom) {
      window.alert('目标房间不存在，请重新选择。')
      return
    }

    operating.value = true
    try {
      await apartmentsService.vacateRoom(activeRoom.value.id)
      await apartmentsService.reassignRoom({
        roomId: targetRoom.id,
        tenantType: reassignType.value,
        department: reassignDepartment.value.trim() || undefined,
      })
      const transferRemark = `床位调整：${activeRoom.value.buildingName}${activeRoom.value.roomNo}${sourceBedNo.value} -> ${targetRoom.buildingName}${targetRoom.roomNo}${targetBedNo.value}${noticeRemark.value ? `；备注：${noticeRemark.value}` : ''}`
      await apartmentsService.sendRoomNotice({
        roomId: targetRoom.id,
        roomNo: targetRoom.roomNo,
        buildingName: targetRoom.buildingName,
        action: '再分配通知',
        oldTenant: oldTenantName.value || undefined,
        remark: transferRemark,
      })

      window.alert(`已对 ${activeRoom.value.roomNo}${sourceBedNo.value} 与 ${targetRoom.roomNo}${targetBedNo.value} 发送通知。`)
      closeDialogs()
      await loadRooms()
    } catch (error: any) {
      const message = error?.message || '再分配失败，请重试'
      window.alert(message)
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
    sourceBeds,
    sourceBedNo,
    targetBuildingCode,
    targetFloor,
    targetRoomId,
    targetBedNo,
    targetBuildingOptions,
    targetFloorOptions,
    targetRoomOptions,
    targetBeds,
    bedTransferPreview,
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
