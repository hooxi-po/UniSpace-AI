import { listProjects } from '~/server/utils/fixation-audit-db'

export default defineEventHandler(async () => {
  const list = await listProjects()
  return { list }
})


