import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pipelineOpsService, type PipelineOpsStats } from '~/services/pipeline-ops'
import type {
  ImpactedBuildingRef,
  PipelineMedium,
  PipelineOpsDashboard,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelineOrderUpsertPayload,
  PipelinePriority,
  PipelineWorkOrder,
  PumpAction,
} from '~/types/pipeline-ops'

export type PipelineOpsBoardMode = PipelineOrderType | 'linkage'
const WORKORDERS_UPDATED_EVENT = 'pipeline:workorders-updated'

function modeToType(mode: PipelineOpsBoardMode): PipelineOrderType | undefined {
  if (mode === 'linkage') return undefined
  return mode
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  return (error as any)?.data?.statusMessage || (error as any)?.message || fallback
}

export function usePipelineOpsBoard(mode: PipelineOpsBoardMode) {
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')
  const list = ref<PipelineWorkOrder[]>([])
  const detail = ref<PipelineWorkOrder | null>(null)
  const stats = ref<PipelineOpsStats>({
    total: 0,
    draft: 0,
    todo: 0,
    assigned: 0,
    in_progress: 0,
    paused: 0,
    inProgress: 0,
    review: 0,
    completed: 0,
    closed: 0,
    cancelled: 0,
    rejected: 0,
  })
  const dashboard = ref<PipelineOpsDashboard | null>(null)
  const page = ref(1)
  const limit = ref(20)
  const total = ref(0)
  const totalPages = ref(0)
  let refreshRequestId = 0

  const queryStatus = ref<PipelineOrderStatus | ''>('')
  const queryArea = ref('')
  const queryMedium = ref<PipelineMedium | ''>('')
  const queryPriority = ref<PipelinePriority | ''>('')
  const queryNodeId = ref('')
  const queryBuildingId = ref('')
  const queryAssignee = ref('')
  const queryCreatedFrom = ref('')
  const queryCreatedTo = ref('')
  const queryKeyword = ref('')

  const typeFilter = computed(() => modeToType(mode))

  const query = computed(() => ({
    type: typeFilter.value,
    status: queryStatus.value || undefined,
    area: queryArea.value || undefined,
    pipelineMedium: queryMedium.value || undefined,
    priority: queryPriority.value || undefined,
    nodeId: queryNodeId.value || undefined,
    buildingId: queryBuildingId.value || undefined,
    assignee: queryAssignee.value || undefined,
    createdFrom: queryCreatedFrom.value || undefined,
    createdTo: queryCreatedTo.value || undefined,
    q: queryKeyword.value || undefined,
    page: page.value,
    limit: limit.value,
  }))

  const summaryQuery = computed(() => ({
    type: typeFilter.value,
    status: queryStatus.value || undefined,
    area: queryArea.value || undefined,
    pipelineMedium: queryMedium.value || undefined,
    priority: queryPriority.value || undefined,
    nodeId: queryNodeId.value || undefined,
    buildingId: queryBuildingId.value || undefined,
    assignee: queryAssignee.value || undefined,
    createdFrom: queryCreatedFrom.value || undefined,
    createdTo: queryCreatedTo.value || undefined,
    q: queryKeyword.value || undefined,
  }))

  function notifyWorkordersUpdated() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(WORKORDERS_UPDATED_EVENT))
  }

  function handleWorkordersUpdated() {
    void refresh()
  }

  async function refresh() {
    const requestId = ++refreshRequestId
    loading.value = true
    error.value = ''
    try {
      const [workordersRes, statsRes, dashboardRes] = await Promise.allSettled([
        pipelineOpsService.fetchWorkorders(query.value),
        pipelineOpsService.fetchStats(summaryQuery.value),
        pipelineOpsService.fetchDashboard(summaryQuery.value),
      ])
      if (requestId !== refreshRequestId) return

      const failedParts: string[] = []

      if (workordersRes.status === 'fulfilled') {
        list.value = workordersRes.value.list
        total.value = workordersRes.value.pagination?.total || 0
        totalPages.value = workordersRes.value.pagination?.totalPages || 0
      } else {
        list.value = []
        total.value = 0
        totalPages.value = 0
        failedParts.push(getRequestErrorMessage(workordersRes.reason, '工单列表加载失败'))
      }

      if (statsRes.status === 'fulfilled') {
        stats.value = statsRes.value.stats
      } else {
        stats.value = {
          total: 0,
          draft: 0,
          todo: 0,
          assigned: 0,
          in_progress: 0,
          paused: 0,
          inProgress: 0,
          review: 0,
          completed: 0,
          closed: 0,
          cancelled: 0,
          rejected: 0,
        }
        failedParts.push(getRequestErrorMessage(statsRes.reason, '工单统计加载失败'))
      }

      if (dashboardRes.status === 'fulfilled') {
        dashboard.value = dashboardRes.value.dashboard
      } else {
        dashboard.value = null
        failedParts.push(getRequestErrorMessage(dashboardRes.reason, '工单看板加载失败'))
      }

      error.value = failedParts.join('；')

      if (detail.value && workordersRes.status === 'fulfilled') {
        const found = workordersRes.value.list.find(i => i.id === detail.value?.id)
        if (found) detail.value = found
      }
    } catch (err: any) {
      if (requestId !== refreshRequestId) return
      error.value = err?.data?.statusMessage || err?.message || '加载管网运维工单失败'
    } finally {
      if (requestId !== refreshRequestId) return
      loading.value = false
    }
  }

  async function loadDetail(id: string) {
    loading.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.fetchWorkorder(id)
      detail.value = res.workorder
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '加载工单详情失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createWorkorder(payload: Omit<PipelineOrderUpsertPayload, 'type'> & { type?: PipelineOrderType }) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.createWorkorder({
        ...payload,
        type: payload.type || typeFilter.value || 'inspection',
      })
      await refresh()
      detail.value = res.workorder
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '创建工单失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function autoCreate(payload: {
    trigger: 'telemetry_alert' | 'anomaly_alert' | 'kg_inference'
    reason: string
    base: Omit<PipelineOrderUpsertPayload, 'source' | 'autoTrigger'>
  }) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.autoCreate(payload)
      await refresh()
      detail.value = res.workorder
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '自动创建工单失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function transition(
    id: string,
    action: 'submit' | 'assign' | 'start' | 'pause' | 'resume' | 'to_review' | 'approve' | 'close' | 'cancel' | 'reject' | 'reopen',
    params?: { assignee?: string; reviewer?: string; comment?: string; resultSummary?: string; actor?: string }
  ) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.transition({
        id,
        action,
        assignee: params?.assignee,
        reviewer: params?.reviewer,
        comment: params?.comment,
        resultSummary: params?.resultSummary,
        actor: params?.actor || 'admin-ui',
      })
      detail.value = res.workorder
      await refresh()
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '工单状态更新失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function addExecutionLog(payload: {
    id: string
    content: string
    actor: string
    stage?: 'progress' | 'pause_or_exception' | 'acceptance' | 'notification'
    lng?: number
    lat?: number
    nodeId?: string
    photoUrls?: string[]
    voiceUrl?: string
    isMobileUpload?: boolean
  }) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.addExecutionLog({
        id: payload.id,
        stage: payload.stage || 'progress',
        content: payload.content,
        actor: payload.actor,
        location: (typeof payload.lng === 'number' && typeof payload.lat === 'number')
          ? { lng: payload.lng, lat: payload.lat }
          : null,
        nodeId: payload.nodeId,
        photoUrls: payload.photoUrls,
        voiceUrl: payload.voiceUrl,
        isMobileUpload: payload.isMobileUpload,
      })
      detail.value = res.workorder
      await refresh()
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '新增执行日志失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function adjustImpact(params: {
    id: string
    actor: string
    note: string
    impactedBuildings: ImpactedBuildingRef[]
    bypassRequirement: string
  }) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.adjustImpact(params)
      detail.value = res.workorder
      await refresh()
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '调整影响范围失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function pumpControl(params: {
    id: string
    actor: string
    buildingIds: string[]
    action: PumpAction
    durationMinutes?: number
  }) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.pumpControl(params)
      detail.value = res.workorder
      await refresh()
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '热水泵控制失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function addInspectionRecord(params: {
    id: string
    actor: string
    checkinNodeId: string
    judgement: 'normal' | 'abnormal'
    issueText?: string
    pressure?: number
    waterQuality?: number
    lng?: number
    lat?: number
    photoUrls?: string[]
  }) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.addInspectionRecord({
        id: params.id,
        actor: params.actor,
        checkinNodeId: params.checkinNodeId,
        judgement: params.judgement,
        issueText: params.issueText,
        pressure: params.pressure,
        waterQuality: params.waterQuality,
        location: (typeof params.lng === 'number' && typeof params.lat === 'number')
          ? { lng: params.lng, lat: params.lat }
          : null,
        photoUrls: params.photoUrls || [],
      })
      detail.value = res.workorder
      await refresh()
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '上传巡检记录失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  async function convertToMaintenance(id: string, actor: string, reason: string) {
    submitting.value = true
    error.value = ''
    try {
      const res = await pipelineOpsService.convertToMaintenance({
        id,
        actor,
        reason,
      })
      await refresh()
      detail.value = res.maintenanceWorkorder
      notifyWorkordersUpdated()
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || '巡检转维修失败'
      throw err
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener(WORKORDERS_UPDATED_EVENT, handleWorkordersUpdated)
    }
    void refresh()
  })

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(WORKORDERS_UPDATED_EVENT, handleWorkordersUpdated)
    }
  })

  watch(query, () => {
    void refresh()
  })

  return {
    loading,
    submitting,
    error,
    list,
    detail,
    stats,
    dashboard,
    page,
    limit,
    total,
    totalPages,
    queryStatus,
    queryArea,
    queryMedium,
    queryPriority,
    queryNodeId,
    queryBuildingId,
    queryAssignee,
    queryCreatedFrom,
    queryCreatedTo,
    queryKeyword,
    refresh,
    loadDetail,
    createWorkorder,
    autoCreate,
    transition,
    addExecutionLog,
    adjustImpact,
    pumpControl,
    addInspectionRecord,
    convertToMaintenance,
  }
}
