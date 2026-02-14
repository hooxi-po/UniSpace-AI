import { listAdjustmentRequests } from '~/server/utils/allocation-db'

export default defineEventHandler(async () => {
  const list = await listAdjustmentRequests()
  return { list }
})

