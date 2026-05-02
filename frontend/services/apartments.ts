import { fetchWithProxyWriteAuth } from './proxy-write-auth'

export interface ApartmentRoom {
  id: string
  buildingName: string
  buildingCode?: string
  roomNo: string
  floor: number
  area: number
  type: 'TeacherApartment' | 'Student'
  status: 'Empty' | 'Occupied'
  statusCn?: '空置' | '在住'
  department: string
  monthlyRent: number
  deposit: number
  facilities: string[]
  layout: string
}

export interface ApartmentStats {
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  pendingApplications: number
  occupancyRate: string
  unpaidUtilities: number
}

export interface ApartmentsRoomsResp {
  source: string
  rooms: ApartmentRoom[]
}

export type DormType = '学生宿舍' | '教师宿舍'
export type DormStatus = '空置' | '在住' | '维修中' | '预留'
export type ApplicationStatus = '待处理' | '已分配'

export interface DormOverviewRoom {
  id: string
  type: DormType
  building: string
  buildingCode: string
  roomNo: string
  floor: number
  area: number
  status: DormStatus
  beds: number
  occupiedBeds: number
}

export interface ApartmentsOverviewResp {
  source: string
  stats: ApartmentStats
  rooms: DormOverviewRoom[]
}

export interface ApartmentApplicationItem {
  id: number
  applicantName: string
  applicantNo?: string
  applicantPhone?: string
  applicantType: DormType
  department?: string
  preferredBuildingCode?: string
  note?: string
  status: ApplicationStatus
  assignedRoomId?: string
  assignedAt?: string
  createdAt?: string
  updatedAt?: string
  assignedRoom?: {
    id: string
    buildingCode?: string
    buildingName?: string
    roomNo?: string
    floor?: number
  }
}

export interface ApartmentApplicationsResp {
  source: string
  items: ApartmentApplicationItem[]
  limit: number
  offset: number
}

export interface ApartmentApplicationPayload {
  applicantName: string
  applicantNo?: string
  applicantPhone?: string
  applicantType: DormType
  department?: string
  preferredBuildingCode?: string
  note?: string
}

async function readError(res: Response) {
  try {
    const json = await res.json()
    if (json && typeof json.error === 'string') {
      return json.error
    }
    if (json && typeof json.statusMessage === 'string') {
      return json.statusMessage
    }
  } catch {
    // noop
  }
  return `HTTP ${res.status}`
}

async function requestJson(url: string, init?: RequestInit, useWriteAuth = false) {
  const res = useWriteAuth
    ? await fetchWithProxyWriteAuth(url, init)
    : await fetch(url, init)

  if (!res.ok) {
    throw new Error(await readError(res))
  }

  try {
    return await res.json()
  } catch {
    return { ok: true }
  }
}

export const apartmentsService = {
  async getRooms(params?: { type?: string; status?: string; buildingCode?: string }) {
    return await $fetch<ApartmentsRoomsResp>('/api/apartments/rooms', { params })
  },

  async getOverview() {
    return await $fetch<ApartmentsOverviewResp>('/api/apartments/overview')
  },

  async listApplications(params?: { keyword?: string; status?: string; limit?: number; offset?: number }) {
    return await $fetch<ApartmentApplicationsResp>('/api/apartments/applications', { params })
  },

  async createApplication(payload: ApartmentApplicationPayload) {
    return await $fetch<{ ok: boolean; id?: number }>('/api/apartments/applications', {
      method: 'POST',
      body: payload,
    })
  },

  async updateApplication(id: number, payload: ApartmentApplicationPayload) {
    return await $fetch<{ ok: boolean }>(`/api/apartments/applications/${id}`, {
      method: 'PUT',
      body: payload,
    })
  },

  async deleteApplication(id: number) {
    return await $fetch<{ ok: boolean }>(`/api/apartments/applications/${id}`, {
      method: 'DELETE',
    })
  },

  async assignApplication(id: number, roomId: string) {
    return await $fetch<{ ok: boolean; assignedRoomId?: string; assignedAt?: string }>(`/api/apartments/applications/${id}/assign`, {
      method: 'PATCH',
      body: { roomId },
    })
  },
  async vacateRoom(roomId: string) {
    return await requestJson('/api/apartments/room-vacate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    }, true) as { ok: boolean; id?: string; status?: string }
  },

  async reassignRoom(payload: { roomId: string; tenantType: DormType; department?: string }) {
    return await requestJson('/api/apartments/room-reassign', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, true) as { ok: boolean; id?: string; status?: string }
  },

  async sendRoomNotice(payload: {
    roomId: string
    roomNo: string
    buildingName: string
    action: '腾退通知' | '再分配通知'
    oldTenant?: string
    remark?: string
  }) {
    return await requestJson('/api/allocation/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'ROOM',
        targetId: payload.roomId,
        targetName: `${payload.buildingName} ${payload.roomNo}`,
        level: 'INFO',
        channel: 'SYSTEM',
        content: `${payload.action}：${payload.buildingName}${payload.roomNo}${payload.oldTenant ? `，原住户：${payload.oldTenant}` : ''}${payload.remark ? `，备注：${payload.remark}` : ''}`,
      }),
    }, true)
  },
}

