export interface ApartmentRoom {
  id: string
  buildingName: string
  buildingCode?: string
  roomNo: string
  floor: number
  area: number
  type: 'TeacherApartment' | 'Student'
  status: 'Empty' | 'Occupied'
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

export interface ApartmentsOverviewResp {
  source: string
  stats: ApartmentStats
}

export const apartmentsService = {
  async getRooms(params?: { type?: string }) {
    return await $fetch<ApartmentsRoomsResp>('/api/apartments/rooms', { params })
  },
  async getOverview() {
    return await $fetch<ApartmentsOverviewResp>('/api/apartments/overview')
  }
}


