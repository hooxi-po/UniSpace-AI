import { fetchApartmentRoomsFromBackend } from '~/server/utils/apartment-rooms'
import { toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const resp = await fetchApartmentRoomsFromBackend({})
    const totalRooms = resp.rooms.length
    const occupiedRooms = resp.rooms.filter((r) => String(r.status || '').toLowerCase() === 'occupied').length
    const availableRooms = Math.max(0, totalRooms - occupiedRooms)
    const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0.0'

    return {
      source: resp.source || 'postgres',
      stats: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        pendingApplications: 0,
        occupancyRate,
        unpaidUtilities: 0,
      },
    }
  } catch (error) {
    throw toProxyError(event, error)
  }
})
