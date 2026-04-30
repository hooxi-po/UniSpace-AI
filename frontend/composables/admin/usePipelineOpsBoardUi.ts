import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { pipelineOpsActionText, pipelineOpsStageLabel } from '~/components/admin/ops/pipeline-ops-view-constants'
import { usePipelineOpsBoard, type PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'
import type {
  ImpactedBuildingRef,
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
  PipelineWorkOrder,
  PumpAction,
} from '~/types/pipeline-ops'

export function usePipelineOpsBoardUi(mode: PipelineOpsBoardMode) {
  const route = useRoute()
  const router = useRouter()
  const board = usePipelineOpsBoard(mode)
  const {
    loading,
    submitting,
    error,
    detail,
    page,
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
    loadDetail,
    createWorkorder,
    autoCreate,
    transition,
    addExecutionLog,
    adjustImpact,
    pumpControl,
    addInspectionRecord,
    convertToMaintenance,
  } = board

  const formOpen = ref(false)
  const detailOpen = ref(false)
  const notice = reactive({
    text: '',
    type: 'info' as 'info' | 'success' | 'error',
  })
  let noticeTimer: ReturnType<typeof setTimeout> | null = null

  const actionDialog = reactive({
    open: false,
    action: '' as '' | 'assign' | 'reject',
    orderId: '',
    workorderTitle: '',
    title: '',
    confirmText: '确认',
    assignee: '',
    reviewer: '',
    comment: '流程不符合要求',
  })

  const form = reactive({
    title: '',
    description: '',
    type: (mode === 'linkage' ? 'inspection' : mode) as PipelineOrderType,
    pipelineMedium: 'water' as PipelineMedium,
    area: '',
    buildingId: '',
    buildingName: '',
    nodeIdsText: '',
    segmentIdsText: '',
    assignee: '',
    reviewer: '',
    priority: 'medium' as PipelinePriority,
    plannedDate: '',
    deadlineAt: '',
  })

  const autoForm = reactive({
    trigger: 'telemetry_alert' as 'telemetry_alert' | 'anomaly_alert' | 'kg_inference',
    reason: '',
  })

  const impactForm = reactive({
    json: '[]',
    bypass: '',
    note: '人工修订影响范围',
  })

  const logForm = reactive({
    actor: 'admin-ui',
    stage: 'progress' as 'progress' | 'pause_or_exception' | 'acceptance' | 'notification',
    content: '',
    nodeId: '',
    lng: undefined as number | undefined,
    lat: undefined as number | undefined,
    mobile: false,
  })

  const pumpForm = reactive({
    actor: 'admin-ui',
    action: 'close' as PumpAction,
    durationMinutes: 30,
    buildingIdsText: '',
  })

  const pumpUi = reactive({
    running: false,
    total: 0,
    completed: 0,
    progress: 0,
    countdown: 0,
  })
  let pumpTimer: ReturnType<typeof setInterval> | null = null

  const inspectionForm = reactive({
    actor: '巡检员',
    checkinNodeId: '',
    judgement: 'normal' as 'normal' | 'abnormal',
    pressure: undefined as number | undefined,
    waterQuality: undefined as number | undefined,
    issueText: '',
    lng: undefined as number | undefined,
    lat: undefined as number | undefined,
    photoUrlsText: '',
  })

  const feedbackText = computed(() => error.value || notice.text)
  const feedbackType = computed(() => (error.value ? 'error' : notice.type))
  const timelineEntries = computed(() => {
    if (!detail.value) return []
    return detail.value.executionLogs
      .slice()
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map(log => ({
        ...log,
        label: pipelineOpsStageLabel[log.stage] || log.stage,
      }))
  })

  function parseCsv(text: string) {
    return text.split(',').map(item => item.trim()).filter(Boolean)
  }

  function showNotice(type: 'info' | 'success' | 'error', text: string, timeoutMs = 3200) {
    notice.text = text
    notice.type = type
    if (noticeTimer) {
      clearTimeout(noticeTimer)
      noticeTimer = null
    }
    if (timeoutMs > 0) {
      noticeTimer = setTimeout(() => {
        notice.text = ''
        noticeTimer = null
      }, timeoutMs)
    }
  }

  function dismissFeedback() {
    notice.text = ''
    error.value = ''
    if (noticeTimer) {
      clearTimeout(noticeTimer)
      noticeTimer = null
    }
  }

  async function runWithFeedback(task: () => Promise<void>, successText?: string) {
    try {
      await task()
      if (successText) {
        showNotice('success', successText)
      }
    } catch {
      // error ref is already maintained by usePipelineOpsBoard
    }
  }

  function openActionDialog(item: PipelineWorkOrder, action: 'assign' | 'reject') {
    actionDialog.open = true
    actionDialog.action = action
    actionDialog.orderId = item.id
    actionDialog.workorderTitle = `${item.id} · ${item.title}`
    actionDialog.assignee = item.assignee || ''
    actionDialog.reviewer = item.reviewer || ''
    actionDialog.comment = '流程不符合要求'
    actionDialog.title = action === 'assign' ? '分配工单' : '驳回工单'
    actionDialog.confirmText = action === 'assign' ? '确认分配' : '确认驳回'
  }

  function closeActionDialog() {
    actionDialog.open = false
    actionDialog.action = ''
    actionDialog.orderId = ''
    actionDialog.workorderTitle = ''
    actionDialog.title = ''
    actionDialog.confirmText = '确认'
    actionDialog.assignee = ''
    actionDialog.reviewer = ''
    actionDialog.comment = '流程不符合要求'
  }

  function resetCreateForm() {
    form.title = ''
    form.description = ''
    form.pipelineMedium = 'water'
    form.area = ''
    form.buildingId = ''
    form.buildingName = ''
    form.nodeIdsText = ''
    form.segmentIdsText = ''
    form.assignee = ''
    form.reviewer = ''
    form.priority = 'medium'
    form.plannedDate = ''
    form.deadlineAt = ''
    form.type = (mode === 'linkage' ? 'inspection' : mode) as PipelineOrderType
  }

  function availableActions(status: PipelineOrderStatus) {
    if (status === 'draft') return ['submit', 'cancel', 'reject']
    if (status === 'todo') return ['assign', 'start', 'cancel', 'reject']
    if (status === 'assigned') return ['start', 'cancel', 'reject']
    if (status === 'in_progress') return ['pause', 'to_review', 'cancel', 'reject']
    if (status === 'paused') return ['resume', 'cancel', 'reject']
    if (status === 'review') return ['approve', 'reopen', 'cancel', 'reject']
    if (status === 'completed') return ['close', 'reopen']
    if (status === 'closed' || status === 'cancelled' || status === 'rejected') return ['reopen']
    return []
  }

  async function triggerAction(item: PipelineWorkOrder, action: string) {
    if (action === 'assign') {
      openActionDialog(item, 'assign')
      return
    }
    if (action === 'reject') {
      openActionDialog(item, 'reject')
      return
    }
    await runWithFeedback(
      () => transition(item.id, action as any, { actor: 'admin-ui' }),
      `${pipelineOpsActionText[action]}成功`,
    )
  }

  async function submitActionDialog() {
    if (!actionDialog.open || !actionDialog.orderId || !actionDialog.action) return
    const action = actionDialog.action
    if (action !== 'assign' && action !== 'reject') return

    if (action === 'assign' && !actionDialog.assignee.trim()) {
      showNotice('error', '分配工单必须填写执行人', 4200)
      return
    }
    if (action === 'reject' && !actionDialog.comment.trim()) {
      showNotice('error', '请输入驳回原因', 4200)
      return
    }

    await runWithFeedback(
      () => transition(actionDialog.orderId, action, {
        actor: 'admin-ui',
        assignee: action === 'assign' ? actionDialog.assignee.trim() : undefined,
        reviewer: action === 'assign' ? actionDialog.reviewer.trim() : undefined,
        comment: action === 'reject' ? actionDialog.comment.trim() : undefined,
      }),
      action === 'assign' ? '工单已分配' : '工单已驳回',
    )

    if (!error.value) {
      closeActionDialog()
    }
  }

  async function submitCreate() {
    if (!form.title.trim()) {
      showNotice('error', '请填写工单标题', 4200)
      return
    }
    await runWithFeedback(
      () => createWorkorder({
        title: form.title,
        description: form.description,
        type: form.type,
        pipelineMedium: form.pipelineMedium,
        area: form.area || '未分区',
        buildingId: form.buildingId,
        buildingName: form.buildingName,
        nodeIds: parseCsv(form.nodeIdsText),
        segmentIds: parseCsv(form.segmentIdsText),
        assignee: form.assignee,
        reviewer: form.reviewer,
        priority: form.priority,
        plannedDate: form.plannedDate,
        deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : '',
        createdBy: 'admin-ui',
      }),
      '草稿工单已创建',
    )
    if (!error.value) {
      resetCreateForm()
      formOpen.value = false
      detailOpen.value = true
    }
  }

  async function submitAutoCreate() {
    if (!form.title.trim()) {
      showNotice('error', '自动建单同样需要工单标题', 4200)
      return
    }
    if (!autoForm.reason.trim()) {
      showNotice('error', '请填写触发原因', 4200)
      return
    }
    await runWithFeedback(
      () => autoCreate({
        trigger: autoForm.trigger,
        reason: autoForm.reason,
        base: {
          title: form.title,
          description: form.description,
          type: form.type,
          pipelineMedium: form.pipelineMedium,
          area: form.area || '未分区',
          buildingId: form.buildingId,
          buildingName: form.buildingName,
          nodeIds: parseCsv(form.nodeIdsText),
          segmentIds: parseCsv(form.segmentIdsText),
          assignee: form.assignee,
          reviewer: form.reviewer,
          priority: form.priority,
          plannedDate: form.plannedDate,
          deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : '',
          createdBy: 'system',
        },
      }),
      '自动工单已创建',
    )
    if (!error.value) {
      detailOpen.value = true
    }
  }

  async function openDetail(id: string) {
    await loadDetail(id)
    detailOpen.value = true
  }

  async function closeDetail() {
    detailOpen.value = false
  }

  async function submitImpactAdjust() {
    if (!detail.value) return
    const detailItem = detail.value
    let impactedBuildings: ImpactedBuildingRef[] = []
    try {
      impactedBuildings = JSON.parse(impactForm.json)
    } catch {
      showNotice('error', '影响范围 JSON 格式错误', 4200)
      return
    }
    await runWithFeedback(
      () => adjustImpact({
        id: detailItem.id,
        actor: 'admin-ui',
        note: impactForm.note || '手动调整影响范围',
        impactedBuildings,
        bypassRequirement: impactForm.bypass,
      }),
      '影响范围已更新',
    )
  }

  async function submitLog() {
    if (!detail.value) return
    const detailItem = detail.value
    if (!logForm.content.trim()) {
      showNotice('error', '请输入日志内容', 4200)
      return
    }
    await runWithFeedback(
      () => addExecutionLog({
        id: detailItem.id,
        actor: logForm.actor || 'admin-ui',
        stage: logForm.stage,
        content: logForm.content,
        nodeId: logForm.nodeId,
        lng: logForm.lng,
        lat: logForm.lat,
        isMobileUpload: logForm.mobile,
      }),
      '执行日志已写入',
    )
    if (!error.value) {
      logForm.content = ''
    }
  }

  async function submitPumpControl() {
    if (!detail.value) return
    const detailItem = detail.value
    let buildingIds = parseCsv(pumpForm.buildingIdsText)
    if (!buildingIds.length) {
      buildingIds = detailItem.impactScope.impactedBuildings.map(item => item.buildingId)
    }
    if (!buildingIds.length) {
      showNotice('error', '没有可控制的楼宇', 4200)
      return
    }
    await runWithFeedback(
      async () => {
        await pumpControl({
          id: detailItem.id,
          actor: pumpForm.actor || 'admin-ui',
          action: pumpForm.action,
          durationMinutes: pumpForm.action === 'set_duration' ? pumpForm.durationMinutes : undefined,
          buildingIds,
        })
        startPumpUi(buildingIds.length, pumpForm.action === 'set_duration' ? Math.max(1, pumpForm.durationMinutes) : 1)
      },
      '热水泵控制指令已下发',
    )
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pipeline:pump-control-refreshed', {
        detail: { workorderId: detailItem.id, buildingIds },
      }))
    }
  }

  async function submitInspectionRecord() {
    if (!detail.value) return
    const detailItem = detail.value
    if (!inspectionForm.checkinNodeId.trim()) {
      showNotice('error', '请输入巡检签到节点ID', 4200)
      return
    }
    if (typeof inspectionForm.pressure !== 'number') {
      showNotice('error', '水压为必填项', 4200)
      return
    }
    if (typeof inspectionForm.waterQuality !== 'number') {
      showNotice('error', '水质为必填项', 4200)
      return
    }
    if (typeof inspectionForm.lng !== 'number' || typeof inspectionForm.lat !== 'number') {
      showNotice('error', '位置坐标为必填项', 4200)
      return
    }
    const photoUrls = parseCsv(inspectionForm.photoUrlsText)
    if (!photoUrls.length) {
      showNotice('error', '现场照片为必填项', 4200)
      return
    }

    await runWithFeedback(
      () => addInspectionRecord({
        id: detailItem.id,
        actor: inspectionForm.actor || '巡检员',
        checkinNodeId: inspectionForm.checkinNodeId,
        judgement: inspectionForm.judgement,
        issueText: inspectionForm.issueText,
        pressure: inspectionForm.pressure,
        waterQuality: inspectionForm.waterQuality,
        lng: inspectionForm.lng,
        lat: inspectionForm.lat,
        photoUrls,
      }),
      '巡检记录已上传',
    )
    if (!error.value) {
      inspectionForm.issueText = ''
      inspectionForm.photoUrlsText = ''
    }
  }

  async function convertInspection() {
    if (!detail.value) return
    const detailItem = detail.value
    const reason = inspectionForm.issueText || '巡检发现异常，转维修工单'
    await runWithFeedback(
      () => convertToMaintenance(detailItem.id, inspectionForm.actor || '巡检员', reason),
      '已转为维修工单',
    )
  }

  function locateOnMap(item: PipelineWorkOrder) {
    if (typeof window === 'undefined') return
    const focusRooms = item.impactScope.impactedBuildings
      .flatMap(building => building.rooms.map(room => room.roomId).filter(Boolean))
      .slice(0, 8)
    openMapWithTargets({
      workorderId: item.id,
      focusBuilding: item.buildingId || item.impactScope.impactedBuildings[0]?.buildingId || '',
      focusNode: item.nodeIds[0] || '',
      focusSegment: item.segmentIds[0] || '',
      focusRooms,
      fallbackFocusId: item.id,
    })
  }

  function locateBuildingOnMap(buildingId: string) {
    if (!detail.value) return
    if (!buildingId) {
      locateOnMap(detail.value)
      return
    }
    const detailItem = detail.value
    const impactedBuilding = detailItem.impactScope.impactedBuildings.find(item => item.buildingId === buildingId)
    const focusRooms = impactedBuilding?.rooms
      .map(room => room.roomId)
      .filter(Boolean)
      .slice(0, 8) || []
    openMapWithTargets({
      workorderId: detailItem.id,
      focusBuilding: buildingId,
      focusNode: detailItem.nodeIds[0] || '',
      focusSegment: detailItem.segmentIds[0] || '',
      focusRooms,
      fallbackFocusId: detailItem.id,
    })
  }

  function openMapWithTargets({
    workorderId,
    focusBuilding = '',
    focusNode = '',
    focusSegment = '',
    focusRooms = [],
    fallbackFocusId,
  }: {
    workorderId: string
    focusBuilding?: string
    focusNode?: string
    focusSegment?: string
    focusRooms?: string[]
    fallbackFocusId: string
  }) {
    if (typeof window === 'undefined') return
    const focusId = focusBuilding || focusNode || focusSegment || fallbackFocusId
    const query = new URLSearchParams({
      focusId,
      fromWorkorder: workorderId,
      focusBuilding,
      focusNode,
      focusSegment,
      focusRooms: focusRooms.join(','),
    })
    window.open(`/?${query.toString()}`, '_blank')
  }

  function startPumpUi(total: number, durationMinutes: number) {
    if (pumpTimer) {
      clearInterval(pumpTimer)
      pumpTimer = null
    }
    const totalSeconds = Math.max(5, Math.min(600, durationMinutes * 60))
    pumpUi.running = true
    pumpUi.total = total
    pumpUi.completed = 0
    pumpUi.progress = 0
    pumpUi.countdown = totalSeconds

    pumpTimer = setInterval(() => {
      if (pumpUi.countdown <= 1) {
        pumpUi.countdown = 0
        pumpUi.progress = 100
        pumpUi.completed = total
        pumpUi.running = false
        if (pumpTimer) {
          clearInterval(pumpTimer)
          pumpTimer = null
        }
        return
      }
      pumpUi.countdown -= 1
      const ratio = (totalSeconds - pumpUi.countdown) / totalSeconds
      pumpUi.progress = Number((ratio * 100).toFixed(1))
      pumpUi.completed = Math.min(total, Math.floor(total * ratio))
    }, 1000)
  }

  function formatTime(input?: string | number) {
    if (!input) return '-'
    const date = new Date(input)
    if (Number.isNaN(date.getTime())) return String(input)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  watch(detail, (value) => {
    if (!value) return
    impactForm.json = JSON.stringify(value.impactScope.impactedBuildings, null, 2)
    impactForm.bypass = value.impactScope.bypassRequirement || ''
    const defaultBuildingIds = value.impactScope.impactedBuildings.map(item => item.buildingId)
    pumpForm.buildingIdsText = defaultBuildingIds.join(',')
  }, { immediate: true })

  watch([
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
  ], () => {
    page.value = 1
  })

  watch(
    () => route.query.workorderId,
    async (workorderId) => {
      const normalizedId = typeof workorderId === 'string' ? workorderId.trim() : ''
      if (!normalizedId) {
        detailOpen.value = false
        return
      }
      if (detail.value?.id === normalizedId) {
        detailOpen.value = true
        return
      }
      try {
        await loadDetail(normalizedId)
        detailOpen.value = true
      } catch {
        // ignore invalid route workorder id
      }
    },
    { immediate: true },
  )

  watch(
    [detailOpen, () => detail.value?.id || ''],
    async ([open, detailId]) => {
      if (mode !== 'linkage') return
      const routeWorkorderId = typeof route.query.workorderId === 'string' ? route.query.workorderId.trim() : ''
      if (!open || !detailId) {
        if (!routeWorkorderId) return
        const { workorderId: _ignored, ...restQuery } = route.query
        await router.replace({ query: restQuery })
        return
      }
      if (routeWorkorderId === detailId) return
      await router.replace({
        query: {
          ...route.query,
          workorderId: detailId,
        },
      })
    },
  )

  onBeforeUnmount(() => {
    if (pumpTimer) {
      clearInterval(pumpTimer)
      pumpTimer = null
    }
    if (noticeTimer) {
      clearTimeout(noticeTimer)
      noticeTimer = null
    }
  })

  return {
    ...board,
    formOpen,
    detailOpen,
    actionDialog,
    form,
    autoForm,
    impactForm,
    logForm,
    pumpForm,
    pumpUi,
    inspectionForm,
    feedbackText,
    feedbackType,
    timelineEntries,
    dismissFeedback,
    closeActionDialog,
    availableActions,
    triggerAction,
    submitActionDialog,
    submitCreate,
    submitAutoCreate,
    openDetail,
    closeDetail,
    submitImpactAdjust,
    submitLog,
    submitPumpControl,
    submitInspectionRecord,
    convertInspection,
    locateOnMap,
    locateBuildingOnMap,
    formatTime,
    showNotice,
  }
}
