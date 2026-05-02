import { computed, onMounted, reactive, ref } from 'vue'
import {
  apartmentsService,
  type ApartmentApplicationItem,
  type ApartmentApplicationPayload,
  type ApartmentRoom,
  type ApplicationStatus,
  type DormType,
} from '~/services/apartments'

type FormState = {
  applicantName: string
  applicantNo: string
  applicantPhone: string
  applicantType: DormType
  department: string
  preferredBuildingCode: string
  note: string
}

const DEFAULT_FORM: FormState = {
  applicantName: '',
  applicantNo: '',
  applicantPhone: '',
  applicantType: '学生宿舍',
  department: '',
  preferredBuildingCode: '',
  note: '',
}

export function useApartmentsApplications() {
  const loading = ref(false)
  const saving = ref(false)
  const assigning = ref(false)

  const draftKeyword = ref('')
  const appliedKeyword = ref('')
  const selectedStatus = ref<'all' | ApplicationStatus>('all')

  const applications = ref<ApartmentApplicationItem[]>([])
  const availableRooms = ref<ApartmentRoom[]>([])

  const formOpen = ref(false)
  const formMode = ref<'create' | 'edit'>('create')
  const editingId = ref<number | null>(null)
  const form = reactive<FormState>({ ...DEFAULT_FORM })

  const assignOpen = ref(false)
  const assignTarget = ref<ApartmentApplicationItem | null>(null)
  const selectedRoomId = ref('')

  const filteredApplications = computed(() => {
    return applications.value.filter((item) => {
      if (selectedStatus.value !== 'all' && item.status !== selectedStatus.value) return false
      if (!appliedKeyword.value.trim()) return true
      const key = appliedKeyword.value.trim().toLowerCase()
      return [
        String(item.id),
        item.applicantName,
        item.applicantNo,
        item.department,
        item.applicantType,
        item.assignedRoom?.buildingName,
        item.assignedRoom?.roomNo,
        item.status,
      ].some((v) => String(v || '').toLowerCase().includes(key))
    })
  })

  const pendingCount = computed(() => applications.value.filter((i) => i.status === '待处理').length)
  const assignedCount = computed(() => applications.value.filter((i) => i.status === '已分配').length)

  const roomOptions = computed(() => {
    const targetType = assignTarget.value?.applicantType
    return availableRooms.value
      .filter((r) => {
        if (!targetType) return true
        if (targetType === '学生宿舍') return r.type === 'Student'
        return r.type === 'TeacherApartment'
      })
      .map((r) => ({
        id: r.id,
        label: `${r.buildingName} ${r.roomNo}（${r.statusCn || (r.status === 'Occupied' ? '在住' : '空置')}）`,
      }))
  })

  async function loadApplications() {
    loading.value = true
    try {
      const statusParam = selectedStatus.value === '已分配' ? '已分配' : undefined
      const resp = await apartmentsService.listApplications({
        keyword: appliedKeyword.value || undefined,
        status: statusParam,
        limit: 500,
        offset: 0,
      })
      applications.value = (resp.items || []).map(normalizeApplication)
    } catch (error) {
      console.warn('[ApartmentsApplication] listApplications failed, fallback to empty list.', error)
      applications.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadAvailableRooms() {
    try {
      const resp = await apartmentsService.getRooms({ status: 'Empty' })
      availableRooms.value = resp.rooms || []
    } catch (error) {
      console.warn('[ApartmentsApplication] getRooms failed, fallback to empty rooms.', error)
      availableRooms.value = []
    }
  }

  function applySearch() {
    appliedKeyword.value = draftKeyword.value
    loadApplications()
  }

  function resetSearch() {
    draftKeyword.value = ''
    appliedKeyword.value = ''
    selectedStatus.value = 'all'
    loadApplications()
  }

  function openCreate() {
    formMode.value = 'create'
    editingId.value = null
    Object.assign(form, DEFAULT_FORM)
    formOpen.value = true
  }

  function openEdit(item: ApartmentApplicationItem) {
    formMode.value = 'edit'
    editingId.value = item.id
    Object.assign(form, {
      applicantName: item.applicantName || '',
      applicantNo: item.applicantNo || '',
      applicantPhone: item.applicantPhone || '',
      applicantType: item.applicantType,
      department: item.department || '',
      preferredBuildingCode: item.preferredBuildingCode || '',
      note: item.note || '',
    })
    formOpen.value = true
  }

  function closeForm() {
    formOpen.value = false
  }

  async function submitForm() {
    if (!form.applicantName.trim()) return
    saving.value = true
    try {
      const payload: ApartmentApplicationPayload = {
        applicantName: form.applicantName,
        applicantNo: form.applicantNo || undefined,
        applicantPhone: form.applicantPhone || undefined,
        applicantType: form.applicantType,
        department: form.department || undefined,
        preferredBuildingCode: form.preferredBuildingCode || undefined,
        note: form.note || undefined,
      }

      if (formMode.value === 'create') {
        await apartmentsService.createApplication(payload)
      } else if (editingId.value != null) {
        await apartmentsService.updateApplication(editingId.value, payload)
      }
      formOpen.value = false
      await loadApplications()
    } finally {
      saving.value = false
    }
  }

  async function removeItem(item: ApartmentApplicationItem) {
    const ok = window.confirm(`确认删除申请 #${item.id} 吗？`)
    if (!ok) return
    await apartmentsService.deleteApplication(item.id)
    await Promise.allSettled([loadApplications(), loadAvailableRooms()])
  }

  async function openAssign(item: ApartmentApplicationItem) {
    assignTarget.value = item
    selectedRoomId.value = item.assignedRoomId || ''
    await loadAvailableRooms()
    assignOpen.value = true
  }

  function closeAssign() {
    assignOpen.value = false
    assignTarget.value = null
    selectedRoomId.value = ''
  }

  async function submitAssign() {
    if (!assignTarget.value || !selectedRoomId.value) return
    assigning.value = true
    try {
      await apartmentsService.assignApplication(assignTarget.value.id, selectedRoomId.value)
      closeAssign()
      await Promise.allSettled([loadApplications(), loadAvailableRooms()])
    } finally {
      assigning.value = false
    }
  }

  onMounted(async () => {
    await Promise.allSettled([loadApplications(), loadAvailableRooms()])
  })

  return {
    loading,
    saving,
    assigning,
    draftKeyword,
    selectedStatus,
    filteredApplications,
    pendingCount,
    assignedCount,
    formOpen,
    formMode,
    form,
    assignOpen,
    assignTarget,
    selectedRoomId,
    roomOptions,
    applySearch,
    resetSearch,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    removeItem,
    openAssign,
    closeAssign,
    submitAssign,
  }
}

function normalizeApplication(raw: any): ApartmentApplicationItem {
  return {
    id: Number(raw.id),
    applicantName: String(raw.applicantName ?? raw.applicant_name ?? ''),
    applicantNo: toOpt(raw.applicantNo ?? raw.applicant_no),
    applicantPhone: toOpt(raw.applicantPhone ?? raw.applicant_phone),
    applicantType: normalizeType(raw.applicantType ?? raw.applicant_type),
    department: toOpt(raw.department),
    preferredBuildingCode: toOpt(raw.preferredBuildingCode ?? raw.preferred_building_code),
    note: toOpt(raw.note),
    status: normalizeStatus(raw.status),
    assignedRoomId: toOpt(raw.assignedRoomId ?? raw.assigned_room_id),
    assignedAt: toOpt(raw.assignedAt ?? raw.assigned_at),
    createdAt: toOpt(raw.createdAt ?? raw.created_at),
    updatedAt: toOpt(raw.updatedAt ?? raw.updated_at),
    assignedRoom: raw.room_no || raw.roomNo || raw.building_name || raw.buildingName
      ? {
          id: String(raw.assignedRoomId ?? raw.assigned_room_id ?? ''),
          buildingCode: toOpt(raw.buildingCode ?? raw.building_code),
          buildingName: toOpt(raw.buildingName ?? raw.building_name),
          roomNo: toOpt(raw.roomNo ?? raw.room_no),
          floor: raw.floor != null ? Number(raw.floor) : undefined,
        }
      : undefined,
  }
}

function normalizeStatus(value: unknown): ApplicationStatus {
  const text = String(value || '')
  return text.includes('分配') ? '已分配' : '待处理'
}

function normalizeType(value: unknown): DormType {
  const text = String(value || '').toLowerCase()
  return text.includes('teacher') || text.includes('教师') ? '教师宿舍' : '学生宿舍'
}

function toOpt(value: unknown) {
  const text = String(value ?? '').trim()
  return text ? text : undefined
}