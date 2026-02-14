import type { AllocationRequest } from '~/server/utils/allocation-db'
import type { AllocationOperationLog } from '~/server/utils/allocation-logs-db'

export const allocationService = {
  async fetchRequests() {
    return $fetch<{ list: AllocationRequest[] }>('/api/allocation/requests')
  },

  async createRequest(body: any) {
    return $fetch<{ request: AllocationRequest }>('/api/allocation/requests', {
      method: 'POST',
      body,
    })
  },

  async patchRequest(id: string, updates: Partial<AllocationRequest>, logSummary?: string) {
    return $fetch<{ request: AllocationRequest }>('/api/allocation/requests', {
      method: 'PATCH',
      body: { id, updates, logSummary },
    })
  },

  async fetchLogs() {
    return $fetch<{ list: AllocationOperationLog[] }>('/api/allocation/logs')
  },

  async createNotification(body: any) {
    return $fetch<{ notification: any }>('/api/allocation/notifications', {
      method: 'POST',
      body,
    })
  },
} as const
