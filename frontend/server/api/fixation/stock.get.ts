import { listBuildings, listRooms } from '~/server/utils/fixation-stock-db'

export default defineEventHandler(async () => {
  const [buildings, rooms] = await Promise.all([listBuildings(), listRooms()])
  return { buildings, rooms }
})

