import { getDashboard } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async () => {
  const dashboard = await getDashboard()
  return { dashboard }
})
