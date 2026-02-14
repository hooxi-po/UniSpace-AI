import type { Building, Room } from '~/server/utils/fixation-stock-db'
import { addBuildings, addRooms } from '~/server/utils/fixation-stock-db'
import { addFixationLog } from '~/server/utils/fixation-logs-db'

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

  if (addedBuildings.length > 0) {
    await addFixationLog({
      id: `LOG-STOCK-B-${Date.now()}`,
      at: new Date().toISOString(),
      operator: '当前用户',
      module: 'fixation',
      action: 'addBuildings',
      summary: `导入房产数据：共 ${addedBuildings.length} 栋建筑`,
      detail: { count: addedBuildings.length, buildings: addedBuildings.map(b => b.name) }
    })
  }

  if (addedRooms.length > 0) {
    await addFixationLog({
      id: `LOG-STOCK-R-${Date.now()}`,
      at: new Date().toISOString(),
      operator: '当前用户',
      module: 'fixation',
      action: 'addRooms',
      summary: `导入房间数据：共 ${addedRooms.length} 间房间`,
      detail: { count: addedRooms.length }
    })
  }

  return {
    addedBuildings,
    addedRooms,
  }
})

