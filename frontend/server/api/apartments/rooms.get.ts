import { getQuery } from 'h3'
import { fetchApartmentRoomsFromBackend, paginateApartmentRooms } from '~/server/utils/apartment-rooms'
import { toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const resp = await fetchApartmentRoomsFromBackend({
      type: query.type,
      buildingCode: query.buildingCode,
      status: query.status,
    })
    const pagedRooms = paginateApartmentRooms(resp.rooms || [], query.limit, query.offset)

    return {
      source: resp.source || 'postgres',
      rooms: pagedRooms.reduce<Array<Record<string, any>>>((list, r) => {
        const normalizedType = r.type === 'TeacherApartment'
          ? 'TeacherApartment'
          : r.type === 'Student'
            ? 'Student'
            : null
        if (!normalizedType) return list

        const occupied = String(r.status || '').toLowerCase() === 'occupied'
        list.push({
          id: String(r.id || ''),
          buildingCode: String(r.building_code || ''),
          buildingName: String(r.master_building_name || r.building_name || ''),
          roomNo: String(r.room_no || ''),
          floor: Number(r.floor || 0),
          area: Number(r.area || 0),
          type: normalizedType,
          status: occupied ? 'Occupied' : 'Empty',
          statusCn: occupied ? '在住' : '空置',
          department: String(r.department || ''),
          monthlyRent: normalizedType === 'TeacherApartment' ? 800 : 200,
          deposit: normalizedType === 'TeacherApartment' ? 1600 : 400,
          facilities: ['空调', '热水器', '床', '衣柜'],
          layout: normalizedType === 'TeacherApartment' ? '一室一厅' : '四人间',
        })
        return list
      }, []),
    }
  } catch (error) {
    throw toProxyError(event, error)
  }
})