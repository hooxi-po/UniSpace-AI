import { fetchApartmentRoomsFromBackend } from '~/server/utils/apartment-rooms'
import { toProxyError } from '~/server/utils/backend-proxy'

type DemoStatus = '空置' | '在住' | '维修中' | '预留'

function pickDemoStatus(index: number, total: number): DemoStatus {
  // 45% 在住，30% 空置，15% 维修中，10% 预留
  const ratio = (index + 1) / Math.max(total, 1)
  if (ratio <= 0.45) return '在住'
  if (ratio <= 0.75) return '空置'
  if (ratio <= 0.90) return '维修中'
  return '预留'
}

export default defineEventHandler(async () => {
  try {
    const resp = await fetchApartmentRoomsFromBackend({})
    const rawRooms = resp.rooms || []

    // 先归一化
    const normalized = rawRooms.reduce<Array<Record<string, any>>>((list, r) => {
      const type = r.type === 'TeacherApartment'
        ? '教师宿舍'
        : r.type === 'Student'
          ? '学生宿舍'
          : null
      if (!type) return list

      list.push({
        id: String(r.id || ''),
        type,
        building: String(r.master_building_name || r.building_name || ''),
        buildingCode: String(r.building_code || ''),
        roomNo: String(r.room_no || ''),
        floor: Number(r.floor || 0),
        area: Number(r.area || 0),
        dbOccupied: String(r.status || '').toLowerCase() === 'occupied',
      })
      return list
    }, [])

    // 只对“学生宿舍”做演示混合状态
    const studentRooms = normalized.filter(r => r.type === '学生宿舍')
    const teacherRooms = normalized.filter(r => r.type === '教师宿舍')

    studentRooms.forEach((room, idx) => {
      room.status = pickDemoStatus(idx, studentRooms.length)
    })

    // 教师宿舍保留真实 DB 的 occupied/empty（也可按需改）
    teacherRooms.forEach((room) => {
      room.status = room.dbOccupied ? '在住' : '空置'
    })

    const rooms = [...studentRooms, ...teacherRooms].map((room) => {
      const beds = room.type === '教师宿舍' ? 2 : 4
      let occupiedBeds = 0
      if (room.status === '在住') occupiedBeds = beds
      else if (room.status === '预留') occupiedBeds = Math.ceil(beds * 0.5) // 预留按半占用演示
      // 空置/维修中按 0

      return {
        id: room.id,
        type: room.type,
        building: room.building,
        buildingCode: room.buildingCode,
        roomNo: room.roomNo,
        floor: room.floor,
        area: room.area,
        status: room.status,
        beds,
        occupiedBeds,
      }
    })

    const totalRooms = rooms.length
    const occupiedRooms = rooms.filter(r => r.status === '在住').length
    const availableRooms = rooms.filter(r => r.status === '空置').length
    const occupancyRate = totalRooms ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0.0'

    return {
      source: `${resp.source || 'postgres'}+demo-status`,
      stats: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        pendingApplications: 0,
        occupancyRate,
        unpaidUtilities: 0,
      },
      rooms,
    }
  } catch (error) {
    throw toProxyError(undefined as any, error)
  }
})