import { computed, onMounted, reactive, ref } from 'vue'
import {
  servicesWorkordersService,
  type ServiceWorkOrder,
  type WorkOrderLog,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '~/services/services-workorders'

const DEFAULT_CREATE_FORM = {
  roomId: '',
  roomLabel: '',
  assetName: '',
  faultDesc: '',
  priority: '中' as WorkOrderPriority,
  reporter: '',
  reportPhone: '',
}

const DEFAULT_ASSIGN_FORM = {
  teamName: '',
  assignee: '',
  planArrivalAt: '',
  operatorName: '',
}

export const useServicesWorkOrders = () => {
  const loading = ref(false)
  const submitting = ref(false)

  const draftKeyword = ref('')
  const appliedKeyword = ref('')
  const selectedStatus = ref<WorkOrderStatus | 'all'>('all')
  const selectedPriority = ref<WorkOrderPriority | 'all'>('all')

  const items = ref<ServiceWorkOrder[]>([])

  const createOpen = ref(false)
  const assignOpen = ref(false)
  const detailOpen = ref(false)

  const activeItem = ref<ServiceWorkOrder | null>(null)
  const activeLogs = ref<WorkOrderLog[]>([])

  const createForm = reactive({ ...DEFAULT_CREATE_FORM })
  const assignForm = reactive({ ...DEFAULT_ASSIGN_FORM })

  const stats = computed(() => {
    return {
      total: items.value.length,
      pending: items.value.filter(i => i.status === '待派单').length,
      processing: items.value.filter(i => i.status === '处理中').length,
      done: items.value.filter(i => i.status === '已完成').length,
    }
  })

  async function loadList() {
    loading.value = true
    try {
      const resp = await servicesWorkordersService.list({
        keyword: appliedKeyword.value || undefined,
        status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
        priority: selectedPriority.value === 'all' ? undefined : selectedPriority.value,
        limit: 500,
        offset: 0,
      })
      items.value = resp.items || []
    } finally {
      loading.value = false
    }
  }

  function applySearch() {
    appliedKeyword.value = draftKeyword.value
    loadList()
  }

  function resetSearch() {
    draftKeyword.value = ''
    appliedKeyword.value = ''
    selectedStatus.value = 'all'
    selectedPriority.value = 'all'
    loadList()
  }

  function openCreate() {
    Object.assign(createForm, DEFAULT_CREATE_FORM)
    createOpen.value = true
  }

  function closeCreate() {
    createOpen.value = false
  }

  async function submitCreate() {
    if (!createForm.roomLabel.trim() || !createForm.assetName.trim() || !createForm.faultDesc.trim() || !createForm.reporter.trim()) return
    submitting.value = true
    try {
      await servicesWorkordersService.create({
        roomId: createForm.roomId,
        roomLabel: createForm.roomLabel,
        assetName: createForm.assetName,
        faultDesc: createForm.faultDesc,
        priority: createForm.priority,
        reporter: createForm.reporter,
        reportPhone: createForm.reportPhone || undefined,
      })
      closeCreate()
      await loadList()
    } finally {
      submitting.value = false
    }
  }

  function openAssign(item: ServiceWorkOrder) {
    activeItem.value = item
    Object.assign(assignForm, DEFAULT_ASSIGN_FORM)
    assignOpen.value = true
  }

  function closeAssign() {
    assignOpen.value = false
    activeItem.value = null
  }

  async function submitAssign() {
    if (!activeItem.value) return
    if (!assignForm.teamName.trim() || !assignForm.assignee.trim()) return
    submitting.value = true
    try {
      await servicesWorkordersService.assign(activeItem.value.id, {
        teamName: assignForm.teamName,
        assignee: assignForm.assignee,
        planArrivalAt: assignForm.planArrivalAt || undefined,
        operatorName: assignForm.operatorName || undefined,
      })
      closeAssign()
      await loadList()
    } finally {
      submitting.value = false
    }
  }

  async function quickStatusUpdate(item: ServiceWorkOrder, status: WorkOrderStatus) {
    await servicesWorkordersService.updateStatus(item.id, { status, operatorName: '系统用户' })
    await loadList()
  }

  async function openDetail(item: ServiceWorkOrder) {
    const resp = await servicesWorkordersService.detail(item.id)
    activeItem.value = resp.item
    activeLogs.value = resp.logs || []
    detailOpen.value = true
  }

  function closeDetail() {
    detailOpen.value = false
    activeItem.value = null
    activeLogs.value = []
  }

  onMounted(loadList)

  return {
    loading,
    submitting,
    draftKeyword,
    selectedStatus,
    selectedPriority,
    items,
    stats,
    createOpen,
    createForm,
    assignOpen,
    assignForm,
    detailOpen,
    activeItem,
    activeLogs,
    applySearch,
    resetSearch,
    openCreate,
    closeCreate,
    submitCreate,
    openAssign,
    closeAssign,
    submitAssign,
    quickStatusUpdate,
    openDetail,
    closeDetail,
  }
}