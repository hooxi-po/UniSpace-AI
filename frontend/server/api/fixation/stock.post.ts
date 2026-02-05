import type { Building, Room } from '~/server/utils/fixation-stock-db'
import { addBuildings, addRooms } from '~/server/utils/fixation-stock-db'

type Body = {
  buildings?: Building[]
  rooms?: Room[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  const buildings = Array.isArray(body.buildings) ? body.buildings : []
  const rooms = Array.isArray(body.rooms) ? body.rooms : []

  const [addedBuildings, addedRooms] = await Promise.all([
    buildings.length ? addBuildings(buildings) : Promise.resolve([]),
    rooms.length ? addRooms(rooms) : Promise.resolve([]),
  ])

  return {
    addedBuildings,
    addedRooms,
  }
})

