import { listProjects } from '~/server/utils/fixation-projects-db'

export default defineEventHandler(async () => {
  const list = await listProjects()
  return { list }
})


