import { computed, onMounted, ref } from 'vue'
import {
  inventoryService,
  type InventoryDiscrepancy,
  type InventoryTask,
  type InventoryTaskStatus,
} from '~/services/inventory'

type InventoryPhase = '准备阶段' | '现场盘点' | '差异复核' | '结果归档'

export const useInventoryTasksOverview = () => {
  const viewMode = ref<'card' | 'list'>('card')
  const loading = ref(false)
  const acting = ref(false)

  const draftKeyword = ref('')
  const appliedKeyword = ref('')
  const selectedYear = ref<number | 'all'>(2026)
  const selectedStatus = ref<InventoryTaskStatus | 'all'>('all')

  const tasks = ref<InventoryTask[]>([])

  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const activeTask = ref<InventoryTask | null>(null)
  const activeDiscrepancies = ref<InventoryDiscrepancy[]>([])

  const yearOptions = computed(() => {
    const years = Array.from(new Set(tasks.value.map(t => t.year))).sort((a, b) => b - a)
    return ['all', ...years] as Array<'all' | number>
  })

  const statusOptions: Array<'all' | InventoryTaskStatus> = ['all', '未开始', '进行中', '待复核', '已完成', '逾期']

  const filteredTasks = computed(() => {
    const key = appliedKeyword.value.trim().toLowerCase()
    return tasks.value.filter((task) => {
      if (selectedYear.value !== 'all' && task.year !== selectedYear.value) return false
      if (selectedStatus.value !== 'all' && task.status !== selectedStatus.value) return false
      if (!key) return true
      return [task.id, task.taskName, task.building, task.ownerDept, task.leader, task.scope]
        .some(v => String(v).toLowerCase().includes(key))
    })
  })

  const stats = computed(() => {
    const list = filteredTasks.value
    const total = list.length
    const completed = list.filter(t => t.status === '已完成').length
    const overdue = list.filter(t => t.status === '逾期').length
    const reviewing = list.filter(t => t.status === '待复核').length
    const progressAvg = total ? Number((list.reduce((s, t) => s + t.progress, 0) / total).toFixed(1)) : 0
    return { total, completed, overdue, reviewing, progressAvg }
  })

  const statusStats = computed(() => {
    const total = filteredTasks.value.length || 1
    return statusOptions
      .filter(s => s !== 'all')
      .map((status) => {
        const count = filteredTasks.value.filter(t => t.status === status).length
        return { status, count, percent: Number(((count / total) * 100).toFixed(1)) }
      })
  })

  const phaseStats = computed(() => {
    const phases: InventoryPhase[] = ['准备阶段', '现场盘点', '差异复核', '结果归档']
    const total = filteredTasks.value.length || 1
    return phases.map((phase) => {
      const count = filteredTasks.value.filter(t => t.phase === phase).length
      return { phase, count, percent: Number(((count / total) * 100).toFixed(1)) }
    })
  })

  const statusMeta: Record<InventoryTaskStatus, { bg: string; text: string; dot: string }> = {
    未开始: { bg: '#eef2ff', text: '#3730a3', dot: '#6366f1' },
    进行中: { bg: '#e0f2fe', text: '#0c4a6e', dot: '#38bdf8' },
    待复核: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    已完成: { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    逾期: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  }

  const phaseColor: Record<InventoryPhase, string> = {
    准备阶段: '#6366f1',
    现场盘点: '#38bdf8',
    差异复核: '#f59e0b',
    结果归档: '#22c55e',
  }

  async function loadTasks() {
    loading.value = true
    try {
      const { items } = await inventoryService.getTasks({
        year: selectedYear.value,
        status: selectedStatus.value,
        keyword: appliedKeyword.value.trim() || undefined,
      })
      tasks.value = items || []
    } finally {
      loading.value = false
    }
  }

  const applySearch = async () => {
    appliedKeyword.value = draftKeyword.value
    await loadTasks()
  }

  const resetSearch = async () => {
    draftKeyword.value = ''
    appliedKeyword.value = ''
    selectedStatus.value = 'all'
    selectedYear.value = 2026
    await loadTasks()
  }

  const getStatusMeta = (status: InventoryTaskStatus) => statusMeta[status]

  async function openDetail(task: InventoryTask) {
    detailOpen.value = true
    detailLoading.value = true
    activeTask.value = task
    try {
      const { data } = await inventoryService.getTaskDetail(task.id)
      activeTask.value = data.task
      activeDiscrepancies.value = data.discrepancies
    } finally {
      detailLoading.value = false
    }
  }

  function closeDetail() {
    detailOpen.value = false
    activeTask.value = null
    activeDiscrepancies.value = []
  }

  async function startReview(task: InventoryTask) {
    if (!task.permissions?.canStartReview || acting.value) return
    acting.value = true
    try {
      await inventoryService.startReview(task.id)
      await loadTasks()
      if (activeTask.value?.id === task.id) await openDetail(task)
    } finally {
      acting.value = false
    }
  }

  async function archiveTask(task: InventoryTask) {
    if (!task.permissions?.canArchive || acting.value) return
    acting.value = true
    try {
      await inventoryService.archiveTask(task.id)
      await loadTasks()
      if (activeTask.value?.id === task.id) await openDetail(task)
    } finally {
      acting.value = false
    }
  }

  onMounted(loadTasks)

  return {
    viewMode,
    loading,
    acting,
    draftKeyword,
    selectedYear,
    selectedStatus,
    yearOptions,
    statusOptions,
    filteredTasks,
    stats,
    statusStats,
    phaseStats,
    phaseColor,
    applySearch,
    resetSearch,
    getStatusMeta,
    detailOpen,
    detailLoading,
    activeTask,
    activeDiscrepancies,
    openDetail,
    closeDetail,
    startReview,
    archiveTask,
  }
}
