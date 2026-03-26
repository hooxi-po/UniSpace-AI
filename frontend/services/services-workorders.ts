export type WorkOrderStatus = '待派单' | '已派单' | '处理中' | '待验收' | '已完成' | '已关闭'
export type WorkOrderPriority = '低' | '中' | '高' | '紧急'

export interface ServiceWorkOrder {
  id: number
  workorderNo: string
  roomId: string
  roomLabel: string
  assetName: string
  faultDesc: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  reporter: string
  reportPhone?: string
  teamName?: string
  assignee?: string
  planArrivalAt?: string
  finishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface WorkOrderLog {
  id: number
  workorderId: number
  action: string
  detail?: string
  operatorName?: string
  createdAt?: string
}

export const servicesWorkordersService = {
  async list(params?: {
    keyword?: string
    status?: WorkOrderStatus | 'all'
    priority?: WorkOrderPriority | 'all'
    limit?: number
    offset?: number
  }) {
    return await $fetch<{
      source: string
      items: ServiceWorkOrder[]
      limit: number
      offset: number
    }>('/api/services/workorders', { params })
  },

  async create(payload: {
    roomId: string
    roomLabel: string
    assetName: string
    faultDesc: string
    priority: WorkOrderPriority
    reporter: string
    reportPhone?: string
  }) {
    return await $fetch<{ ok: boolean; id?: number }>('/api/services/workorders', {
      method: 'POST',
      body: payload,
    })
  },

  async assign(id: number, payload: {
    teamName: string
    assignee: string
    planArrivalAt?: string
    operatorName?: string
  }) {
    return await $fetch<{ ok: boolean }>(`/api/services/workorders/${id}/assign`, {
      method: 'PATCH',
      body: payload,
    })
  },

  async updateStatus(id: number, payload: {
    status: WorkOrderStatus
    detail?: string
    operatorName?: string
  }) {
    return await $fetch<{ ok: boolean }>(`/api/services/workorders/${id}/status`, {
      method: 'PATCH',
      body: payload,
    })
  },

  async detail(id: number) {
    return await $fetch<{ item: ServiceWorkOrder; logs: WorkOrderLog[] }>(`/api/services/workorders/${id}`)
  },
}