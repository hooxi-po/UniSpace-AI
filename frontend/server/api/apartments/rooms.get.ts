import { getQuery }from 'h3'
import { ofetch }from 'ofetch'
import { getBackendBaseUrl, toProxyError }from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const backendBaseUrl = getBackendBaseUrl()

    const resp = await ofetch<{
      source: string
      rooms: Array<Record<string, any>>
    }>(`${backendBaseUrl}/api/v1/property/rooms`, {
      query: {
        type: query.type,
        buildingCode: query.buildingCode,
        status: query.status,
        limit: query.limit ?? 1000,
        offset: query.offset ?? 0,
      },
    })

    return {
      source: resp.source || 'postgres',
      rooms: (resp.rooms || []).map((r) => {
        const roomType = String(r.type || '')
        const normalizedType = roomType === 'TeacherApartment' || roomType === 'Student'
          ? roomType
          : roomType.toLowerCase().includes('student')
            ? 'Student'
            : 'TeacherApartment'

        return {
          id: String(r.id || ''),
          buildingCode: String(r.building_code || ''),
          buildingName: String(r.master_building_name || r.building_name || ''),
          roomNo: String(r.room_no || ''),
          floor: Number(r.floor || 0),
          area: Number(r.area || 0),
          type: normalizedType,
          status: String(r.status || '').toLowerCase() === 'occupied' ? 'Occupied' : 'Empty',
          department: String(r.department || ''),
          monthlyRent: normalizedType === 'TeacherApartment' ? 800 : 200,
          deposit: normalizedType === 'TeacherApartment' ? 1600 : 400,
          facilities: ['空调', '热水器', '床', '衣柜'],
          layout: normalizedType === 'TeacherApartment' ? '一室一厅' : '四人间',
        }
      }),
    }
  }catch (error) {
    throw toProxyError(event, error)
  }
})
