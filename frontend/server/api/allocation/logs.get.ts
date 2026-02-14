import { listAllocationLogs } from '~/server/utils/allocation-logs-db'

export default defineEventHandler(async () => {
  const list = await listAllocationLogs()
  return { list }
})

