import type {
  ConvertToMaintenancePayload,
  ImpactAdjustPayload,
  InspectionRecordPayload,
  PipelineExecutionLogPayload,
  PipelineOpsDashboard,
  PipelineOrderListQuery,
  PipelineOrderTransitionPayload,
  PipelineOrderUpsertPayload,
  PipelineWorkOrder,
  PumpControlPayload,
} from '~/types/pipeline-ops'

export type PipelineOpsStats = {
  total: number
  draft: number
  todo: number
  assigned: number
  in_progress: number
  paused: number
  inProgress: number
  review: number
  completed: number
  closed: number
  cancelled: number
  rejected: number
}

export const pipelineOpsService = {
  async fetchWorkorders(query: PipelineOrderListQuery = {}) {
    return $fetch<{
      list: PipelineWorkOrder[]
      pagination?: { page: number; limit: number; offset: number; total: number; totalPages: number }
    }>('/api/pipeline-ops/workorders', { query })
  },

  async fetchWorkorder(id: string) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/workorder', {
      query: { id },
    })
  },

  async fetchStats() {
    return $fetch<{ stats: PipelineOpsStats }>('/api/pipeline-ops/stats')
  },

  async fetchDashboard() {
    return $fetch<{ dashboard: PipelineOpsDashboard }>('/api/pipeline-ops/dashboard')
  },

  async createWorkorder(payload: PipelineOrderUpsertPayload) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/workorders', {
      method: 'POST',
      body: payload,
    })
  },

  async autoCreate(payload: {
    trigger: 'telemetry_alert' | 'anomaly_alert' | 'kg_inference'
    reason: string
    base: Omit<PipelineOrderUpsertPayload, 'source' | 'autoTrigger'>
  }) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/auto-create', {
      method: 'POST',
      body: payload,
    })
  },

  async transition(payload: PipelineOrderTransitionPayload) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/workorders', {
      method: 'PATCH',
      body: payload,
    })
  },

  async addExecutionLog(payload: PipelineExecutionLogPayload) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/action', {
      method: 'POST',
      body: { action: 'add_log', payload },
    })
  },

  async adjustImpact(payload: ImpactAdjustPayload) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/action', {
      method: 'POST',
      body: { action: 'adjust_impact', payload },
    })
  },

  async pumpControl(payload: PumpControlPayload) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/action', {
      method: 'POST',
      body: { action: 'pump_control', payload },
    })
  },

  async addInspectionRecord(payload: InspectionRecordPayload) {
    return $fetch<{ workorder: PipelineWorkOrder }>('/api/pipeline-ops/action', {
      method: 'POST',
      body: { action: 'add_inspection_record', payload },
    })
  },

  async convertToMaintenance(payload: ConvertToMaintenancePayload) {
    return $fetch<{ maintenanceWorkorder: PipelineWorkOrder }>('/api/pipeline-ops/action', {
      method: 'POST',
      body: { action: 'convert_to_maintenance', payload },
    })
  },
} as const
