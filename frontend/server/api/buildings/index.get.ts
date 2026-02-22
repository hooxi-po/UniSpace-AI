import { listBuildings, listRooms } from '~/server/utils/buildings-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeRooms = String(query.includeRooms || '').toLowerCase() === 'true'
  const type = query.type as any

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
