import { listFixationBuildings, listFixationRooms } from '~/server/utils/fixation-stock-db'

export default defineEventHandler(async () => {
  const [buildings, rooms] = await Promise.all([listFixationBuildings(), listFixationRooms()])
  return { buildings, rooms }
})
