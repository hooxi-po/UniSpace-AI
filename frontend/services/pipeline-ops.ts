import { fetchWithProxyWriteAuth } from './proxy-write-auth'
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

async function readError(res: Response) {
  try {
    const json = await res.json()
    if (json && typeof json.error === 'string') return json.error
    if (json && typeof json.statusMessage === 'string') return json.statusMessage
    if (json && typeof json.message === 'string') return json.message
  } catch {
    // noop
  }
  return `HTTP ${res.status}`
}

async function requestJson<T>(url: string, init?: RequestInit, useWriteAuth = false) {
  const res = useWriteAuth
    ? await fetchWithProxyWriteAuth(url, init)
    : await fetch(url, init)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  return (await res.json()) as T
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
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/workorders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      true,
    )
  },

  async autoCreate(payload: {
    trigger: 'telemetry_alert' | 'anomaly_alert' | 'kg_inference'
    reason: string
    base: Omit<PipelineOrderUpsertPayload, 'source' | 'autoTrigger'>
  }) {
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/auto-create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      true,
    )
  },

  async transition(payload: PipelineOrderTransitionPayload) {
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/workorders',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      true,
    )
  },

  async addExecutionLog(payload: PipelineExecutionLogPayload) {
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_log', payload }),
      },
      true,
    )
  },

  async adjustImpact(payload: ImpactAdjustPayload) {
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust_impact', payload }),
      },
      true,
    )
  },

  async pumpControl(payload: PumpControlPayload) {
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pump_control', payload }),
      },
      true,
    )
  },

  async addInspectionRecord(payload: InspectionRecordPayload) {
    return requestJson<{ workorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_inspection_record', payload }),
      },
      true,
    )
  },

  async convertToMaintenance(payload: ConvertToMaintenancePayload) {
    return requestJson<{ maintenanceWorkorder: PipelineWorkOrder }>(
      '/api/pipeline-ops/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert_to_maintenance', payload }),
      },
      true,
    )
  },
} as const
