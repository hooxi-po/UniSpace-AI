import type { FixationProject } from '~/server/utils/fixation-projects-db'
import { addProject } from '~/server/utils/fixation-projects-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<FixationProject>(event)
  const created = await addProject(body)
  return created
})
