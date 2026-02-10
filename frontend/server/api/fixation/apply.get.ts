import { listApplyProjects } from '~/server/utils/fixation-apply-db'

export default defineEventHandler(async () => {
  const list = await listApplyProjects()
  return { list }
})







