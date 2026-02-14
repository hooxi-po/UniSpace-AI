import { listFixationLogs } from '~/server/utils/fixation-logs-db'

export default defineEventHandler(async () => {
  const list = await listFixationLogs()
  return { list }
})

