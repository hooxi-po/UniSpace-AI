import { readBuildingsDB } from '~/server/utils/buildings-db'

export default defineEventHandler(async () => {
  const bDb = await readBuildingsDB()
  const apartmentRooms = bDb.rooms.filter(r => r.type === 'TeacherApartment' || r.type === 'Student')
  
  const totalRooms = apartmentRooms.length
  const occupiedRooms = apartmentRooms.filter(r => r.status === 'Occupied').length
  const availableRooms = totalRooms - occupiedRooms
  
  return {
    source: 'mock-derived',
    stats: {
      totalRooms,
      occupiedRooms,
      availableRooms,
      pendingApplications: 3, // 模拟固定值
      occupancyRate: totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0.0',
      unpaidUtilities: 1250 // 模拟固定值
    }
  }
})


