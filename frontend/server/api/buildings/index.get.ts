import { listBuildings, listRooms, type RoomType } from '~/server/utils/buildings-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeRooms = String(query.includeRooms || '').toLowerCase() === 'true'
  const rawType = typeof query.type === 'string' ? query.type : ''
  const type: RoomType | undefined = rawType && rawType.toLowerCase() !== 'all'
    ? rawType as RoomType
    : undefined

  const buildings = await listBuildings()

  if (!includeRooms) {
    return { source: 'mock-json', buildings }
  }

  const rooms = await listRooms({ type })

  return {
    source: 'mock-json',
    buildings,
    rooms,
  }
})
