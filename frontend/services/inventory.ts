export type InventoryTaskStatus = '未开始' | '进行中' | '待复核' | '已完成' | '逾期'
export type InventoryPhase = '准备阶段' | '现场盘点' | '差异复核' | '结果归档'

export type InventoryTask = {
  id: string
  year: number
  taskName: string
  building: string
  scope: string
  ownerDept: string
  leader: string
  dueDate: string
  status: InventoryTaskStatus
  phase: InventoryPhase
  progress: number
  checkedAssets: number
  totalAssets: number
  discrepancyCount: number
  lastUpdatedAt: string
  permissions?: {
    canStartReview: boolean
    canArchive: boolean
    reason?: string
  }
}

export type InventoryDiscrepancy = {
  id: string
  assetCode: string
  assetName: string
  location: string
  problemType: '缺失' | '位置异常' | '状态异常' | '账实不符'
  severity: '低' | '中' | '高'
  suggestion: string
  discoveredAt: string
  reviewer?: string
}

export type InventoryTaskDetail = {
  task: InventoryTask
  discrepancies: InventoryDiscrepancy[]
}

export const inventoryService = {
  async getTasks(params: { year?: number | 'all'; status?: InventoryTaskStatus | 'all'; keyword?: string }) {
    return await $fetch<{ source: string; items: InventoryTask[] }>('/api/inventory/tasks', { params })
  },

  async getTaskDetail(id: string) {
    return await $fetch<{ source: string; data: InventoryTaskDetail }>(`/api/inventory/tasks/${id}`)
  },

  async startReview(id: string) {
    return await $fetch<{ ok: boolean; data: InventoryTask }>(`/api/inventory/tasks/${id}/start-review`, { method: 'PATCH' })
  },

  async archiveTask(id: string) {
    return await $fetch<{ ok: boolean; data: InventoryTask }>(`/api/inventory/tasks/${id}/archive`, { method: 'PATCH' })
  },
}
