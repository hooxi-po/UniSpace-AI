import { getWorkorderStats } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async () => {
  const stats = await getWorkorderStats()
  return { stats }
})
