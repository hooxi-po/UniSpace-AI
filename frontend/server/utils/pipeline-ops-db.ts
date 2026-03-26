import { ofetch } from 'ofetch'
import { createError } from 'h3'
import { getBackendBaseUrl, getBackendWriteAuthHeader } from './backend-proxy'
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

export type PipelineOrderListResult = {
  list: PipelineWorkOrder[]
  pagination?: {
    page: number
    limit: number
    offset: number
    total: number
    totalPages: number
  }
}

function toBackendError(error: unknown) {
  const statusCode = Number((error as any)?.statusCode || (error as any)?.response?.status || 502)
  const statusMessage = String(
    (error as any)?.data?.error
      || (error as any)?.data?.message
      || (error as any)?.statusMessage
      || 'pipeline_ops_backend_error'
  )
  return createError({ statusCode, statusMessage })
}

async function pipelineOpsFetch<T>(path: string, options?: {
  method?: 'GET' | 'POST' | 'PATCH'
  query?: Record<string, unknown>
  body?: unknown
  write?: boolean
}) {
  const backendBaseUrl = getBackendBaseUrl()
  try {
    return await ofetch<T>(`${backendBaseUrl}/api/v1/pipeline-ops${path}`, {
      method: options?.method || 'GET',
      query: options?.query,
      body: options?.body as any,
      headers: {
        ...(options?.write ? getBackendWriteAuthHeader() : {}),
      },
    })
  } catch (error) {
    throw toBackendError(error)
  }
}

export async function listWorkorders(query: PipelineOrderListQuery = {}): Promise<PipelineOrderListResult> {
  return await pipelineOpsFetch<PipelineOrderListResult>('/workorders', {
    method: 'GET',
    query,
  })
}

export async function getWorkorderById(id: string) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/workorder', {
    method: 'GET',
    query: { id },
  })
  return res.workorder
}

export async function getWorkorderStats() {
  const res = await pipelineOpsFetch<{ stats: Record<string, number> }>('/stats', {
    method: 'GET',
  })
  return res.stats
}

export async function getWorkorderStatsFiltered(query: PipelineOrderListQuery = {}) {
  const res = await pipelineOpsFetch<{ stats: Record<string, number> }>('/stats', {
    method: 'GET',
    query,
  })
  return res.stats
}

export async function getDashboard(): Promise<PipelineOpsDashboard> {
  const res = await pipelineOpsFetch<{ dashboard: PipelineOpsDashboard }>('/dashboard', {
    method: 'GET',
  })
  return res.dashboard
}

export async function getDashboardFiltered(query: PipelineOrderListQuery = {}): Promise<PipelineOpsDashboard> {
  const res = await pipelineOpsFetch<{ dashboard: PipelineOpsDashboard }>('/dashboard', {
    method: 'GET',
    query,
  })
  return res.dashboard
}

export async function upsertWorkorder(payload: PipelineOrderUpsertPayload) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/workorders', {
    method: 'POST',
    write: true,
    body: payload,
  })
  return res.workorder
}

export async function autoCreateWorkorder(payload: {
  trigger: 'telemetry_alert' | 'anomaly_alert' | 'kg_inference'
  reason: string
  base: Omit<PipelineOrderUpsertPayload, 'source' | 'autoTrigger'>
}) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/auto-create', {
    method: 'POST',
    write: true,
    body: payload,
  })
  return res.workorder
}

export async function transitionWorkorder(payload: PipelineOrderTransitionPayload) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/workorders', {
    method: 'PATCH',
    write: true,
    body: payload,
  })
  return res.workorder
}

export async function addExecutionLog(payload: PipelineExecutionLogPayload) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/action', {
    method: 'POST',
    write: true,
    body: { action: 'add_log', payload },
  })
  return res.workorder
}

export async function adjustImpactScope(payload: ImpactAdjustPayload) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/action', {
    method: 'POST',
    write: true,
    body: { action: 'adjust_impact', payload },
  })
  return res.workorder
}

export async function controlHotWaterPumps(payload: PumpControlPayload) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/action', {
    method: 'POST',
    write: true,
    body: { action: 'pump_control', payload },
  })
  return res.workorder
}

export async function addInspectionRecord(payload: InspectionRecordPayload) {
  const res = await pipelineOpsFetch<{ workorder: PipelineWorkOrder }>('/action', {
    method: 'POST',
    write: true,
    body: { action: 'add_inspection_record', payload },
  })
  return res.workorder
}

export async function convertInspectionToMaintenance(payload: ConvertToMaintenancePayload) {
  const res = await pipelineOpsFetch<{ maintenanceWorkorder: PipelineWorkOrder }>('/action', {
    method: 'POST',
    write: true,
    body: { action: 'convert_to_maintenance', payload },
  })
  return res.maintenanceWorkorder
}
