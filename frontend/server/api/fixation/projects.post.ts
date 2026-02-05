import type { Project } from '~/server/utils/fixation-projects-db'
import { addProject } from '~/server/utils/fixation-projects-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Project>(event)
  const created = await addProject(body)
  return created
})

