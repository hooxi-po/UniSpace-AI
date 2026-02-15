import { listFixationProjects } from '~/server/utils/fixation-projects-db'

export default defineEventHandler(async () => {
  const list = await listFixationProjects()
  return { list }
})

