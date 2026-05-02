import type { ApplyProject } from '~/server/utils/fixation-apply-db'
import type { FixationProject } from '~/server/utils/fixation-projects-db'
import type { Project as AuditProject } from '~/server/utils/fixation-audit-db'
import type { Building, Room } from '~/server/utils/fixation-stock-db'

import type { FixationOperationLog } from '~/server/utils/fixation-logs-db'

export const fixationService = {
  async fetchApplyList() {
    return $fetch<{ list: ApplyProject[] }>('/api/fixation/apply')
  },

  async patchApplyProject(projectId: string, updates: Record<string, any>) {
    return $fetch<{ project: ApplyProject }>('/api/fixation/apply', {
      method: 'PATCH',
      body: { projectId, updates },
    })
  },

  async fetchProjects() {
    return $fetch<{ list: FixationProject[] }>('/api/fixation/projects')
  },

  async addProject(project: FixationProject) {
    return $fetch<FixationProject>('/api/fixation/projects', {
      method: 'POST',
      body: project,
    })
  },

  async fetchAuditProjects() {
    return $fetch<{ list: AuditProject[] }>('/api/fixation/audit')
  },

  async patchAudit(body: any) {
    return $fetch<{ project: AuditProject | null }>('/api/fixation/audit', {
      method: 'PATCH',
      body,
    })
  },

  async fetchStock() {
    return $fetch<{ buildings: Building[]; rooms: Room[] }>('/api/fixation/stock')
  },

  async addBuildings(newBuildings: Building[]) {
    return $fetch<{ addedBuildings: Building[] }>('/api/fixation/stock', {
      method: 'POST',
      body: { buildings: newBuildings },
    })
  },

  async addRooms(newRooms: Room[]) {
    return $fetch<{ addedRooms: Room[] }>('/api/fixation/stock', {
      method: 'POST',
      body: { rooms: newRooms },
    })
  },

  async syncRoomFunctions(projectId: string, plan: any[]) {
    return $fetch<{ updatedRooms: number; addedRooms: number }>('/api/fixation/stock/sync-room-functions', {
      method: 'POST',
      body: { projectId, plan },
    })
  },

  async updateRoom(id: string, updates: Partial<Room>) {
    return $fetch<{ room: Room }>('/api/fixation/stock/room', {
      method: 'PATCH',
      body: { id, updates },
    })
  },

  async fetchLogs() {
    return $fetch<{ list: FixationOperationLog[] }>('/api/fixation/logs')
  },
} as const
