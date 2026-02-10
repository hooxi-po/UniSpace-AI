import { updateApplyProject } from '~/server/utils/fixation-apply-db'

type Body = {
  projectId: string
  updates: Record<string, any>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.projectId) {
    throw createError({ statusCode: 400, statusMessage: 'projectId required' })
  }
  const updated = await updateApplyProject(body.projectId, body.updates)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }
  return { project: updated }
})






