export type PipelineOrderType = 'inspection' | 'maintenance' | 'retrofit' | 'retire'
export type PipelineOrderStatus =
  | 'draft'
  | 'todo'
  | 'assigned'
  | 'in_progress'
  | 'paused'
  | 'review'
  | 'completed'
  | 'closed'
  | 'cancelled'
  | 'rejected'
export type PipelineMedium = 'water' | 'drainage' | 'sewage' | 'mixed'
export type PipelinePriority = 'low' | 'medium' | 'high' | 'urgent'
export type PipelineOrderSource = 'manual' | 'telemetry_alert' | 'anomaly_alert' | 'kg_inference' | 'inspection_transfer'

export type ImpactedRoomRef = {
  buildingId: string
  buildingName: string
  floorNo: number | null
  roomNo: string
  roomId: string
  equipmentIds: string[]
}

export type ImpactedBuildingRef = {
  buildingId: string
  buildingName: string
  floors: number[]
  rooms: ImpactedRoomRef[]
}

export type ImpactAdjustmentLog = {
  id: string
  adjustedAt: string
  adjustedBy: string
  note: string
}

export type ImpactScope = {
  impactedBuildings: ImpactedBuildingRef[]
  bypassRequirement: string
  manualAdjusted: boolean
  adjustmentLogs: ImpactAdjustmentLog[]
}

export type PumpAction = 'open' | 'close' | 'set_duration'
export type PumpControlResult = 'success' | 'failed'

export type PumpControlRecord = {
  id: string
  buildingId: string
  buildingName: string
  pumpId: string
  action: PumpAction
  durationMinutes: number | null
  result: PumpControlResult
  beforeStatus?: string
  afterStatus?: string
  countdownSeconds?: number
  batchTotal?: number
  batchIndex?: number
  progressPercent?: number
  executedAt: string
  executedBy: string
  message: string
}

export type ExecutionLogStage =
  | 'created'
  | 'status_change'
  | 'start_execute'
  | 'progress'
  | 'pause_or_exception'
  | 'acceptance'
  | 'completed'
  | 'closed'
  | 'impact_adjust'
  | 'pump_control'
  | 'notification'
  | 'system_linkage'

export type PipelineExecutionLog = {
  id: string
  stage: ExecutionLogStage
  content: string
  actor: string
  createdAt: string
  location?: { lng: number; lat: number } | null
  photoUrls?: string[]
  voiceUrl?: string
  nodeId?: string
  isMobileUpload?: boolean
}

export type InspectionRecord = {
  id: string
  createdAt: string
  checkinNodeId: string
  photoUrls: string[]
  location: { lng: number; lat: number } | null
  pressure: number | null
  waterQuality: number | null
  issueText: string
  judgement: 'normal' | 'abnormal'
}

export type InspectionPayload = {
  routeNodeIds: string[]
  scanCheckinNodeIds: string[]
  records: InspectionRecord[]
}

export type MaintenancePayload = {
  materials: Array<{ name: string; quantity: number; unit: string }>
  steps: string[]
  faultCause: string
  healthBefore: string
  healthAfter: string
  acceptancePhotos: string[]
  buildingRecoveryConfirmed: boolean
  cost: { laborCost: number; materialCost: number; durationHours: number; totalCost: number }
}

export type RetrofitPayload = {
  planAttachments: string[]
  impactAssessment: string
  oldTopologyPath: string[]
  newTopologyPath: string[]
  ledgerSync: {
    diameter?: string
    material?: string
    depth?: number
    syncedAt?: string
  }
  temporaryWaterCutNoticeSent: boolean
}

export type RetirePayload = {
  retireReason: string
  retireScope: string
  alternativePlan: string
  archivePhotos: string[]
  dismantleRecord: string
  assetWriteOffCode: string
}

export type PipelineWorkOrder = {
  id: string
  title: string
  description: string
  type: PipelineOrderType
  source: PipelineOrderSource
  status: PipelineOrderStatus
  pipelineMedium: PipelineMedium
  priority: PipelinePriority
  area: string
  topologyChain: string[]
  nodeIds: string[]
  segmentIds: string[]
  buildingId?: string
  buildingName?: string
  roomIds: string[]
  equipmentIds: string[]
  assignee?: string
  reviewer?: string
  plannedDate?: string
  deadlineAt?: string
  startedAt?: string
  reviewedAt?: string
  finishedAt?: string
  closedAt?: string
  resultSummary?: string
  linkedWorkorderIds: string[]
  impactScope: ImpactScope
  pumpControls: PumpControlRecord[]
  executionLogs: PipelineExecutionLog[]
  inspection?: InspectionPayload
  maintenance?: MaintenancePayload
  retrofit?: RetrofitPayload
  retire?: RetirePayload
  notifications: Array<{ id: string; channel: 'system' | 'wechat'; target: string; sentAt: string; message: string }>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type PipelineOrderListSort = 'updated_at_desc' | 'created_at_asc'

export type PipelineOrderListQuery = {
  type?: PipelineOrderType
  status?: PipelineOrderStatus
  area?: string
  pipelineMedium?: PipelineMedium
  priority?: PipelinePriority
  nodeId?: string
  segmentId?: string
  buildingId?: string
  assignee?: string
  createdFrom?: string
  createdTo?: string
  q?: string
  sortBy?: PipelineOrderListSort
  page?: number
  limit?: number
}

export type PipelineOrderUpsertPayload = {
  id?: string
  title: string
  description?: string
  type: PipelineOrderType
  source?: PipelineOrderSource
  pipelineMedium: PipelineMedium
  area: string
  topologyChain?: string[]
  buildingId?: string
  buildingName?: string
  roomIds?: string[]
  equipmentIds?: string[]
  nodeIds?: string[]
  segmentIds?: string[]
  assignee?: string
  reviewer?: string
  priority?: PipelinePriority
  plannedDate?: string
  deadlineAt?: string
  resultSummary?: string
  linkedWorkorderIds?: string[]
  createdBy?: string
  inspection?: Partial<InspectionPayload>
  maintenance?: Partial<MaintenancePayload>
  retrofit?: Partial<RetrofitPayload>
  retire?: Partial<RetirePayload>
  autoTrigger?: {
    source: PipelineOrderSource
    reason: string
    severity?: PipelinePriority
  }
}

export type PipelineOrderTransitionPayload = {
  id: string
  action:
    | 'submit'
    | 'assign'
    | 'start'
    | 'pause'
    | 'resume'
    | 'to_review'
    | 'approve'
    | 'close'
    | 'cancel'
    | 'reject'
    | 'reopen'
  assignee?: string
  reviewer?: string
  actor?: string
  resultSummary?: string
  comment?: string
}

export type ImpactAdjustPayload = {
  id: string
  actor: string
  note: string
  impactedBuildings: ImpactedBuildingRef[]
  bypassRequirement: string
}

export type PumpControlPayload = {
  id: string
  actor: string
  buildingIds: string[]
  action: PumpAction
  durationMinutes?: number
}

export type PipelineExecutionLogPayload = {
  id: string
  stage: ExecutionLogStage
  content: string
  actor: string
  location?: { lng: number; lat: number } | null
  photoUrls?: string[]
  voiceUrl?: string
  nodeId?: string
  isMobileUpload?: boolean
}

export type InspectionRecordPayload = {
  id: string
  checkinNodeId: string
  photoUrls?: string[]
  location?: { lng: number; lat: number } | null
  pressure?: number
  waterQuality?: number
  issueText?: string
  judgement: 'normal' | 'abnormal'
  actor: string
}

export type ConvertToMaintenancePayload = {
  id: string
  actor: string
  reason: string
}

export type PipelineOpsDashboard = {
  totalsByType: Record<PipelineOrderType, number>
  totalsByStatus: Record<PipelineOrderStatus, number>
  affectedBuildingsTop10: Array<{ buildingName: string; count: number; avgImpactHours: number }>
  inProgressHeatmap?: Array<{
    id: string
    title: string
    buildingId: string
    buildingName: string
    lng: number
    lat: number
    count: number
    clusterKey: string
  }>
  efficiency: {
    averageHandleHours: number
    repeatedOrderRate: number
    totalCost: number
  }
  trendByDay: Array<{ date: string; created: number; completed: number }>
}
