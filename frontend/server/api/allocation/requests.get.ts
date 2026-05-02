import { listAllocationRequests } from '~/server/utils/allocation-db'

export default defineEventHandler(async () => {
  const list = await listAllocationRequests()
  return { list }
})

