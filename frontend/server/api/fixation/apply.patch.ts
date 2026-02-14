import { updateApplyProject } from '~/server/utils/fixation-apply-db'
import { addFixationLog } from '~/server/utils/fixation-logs-db'

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

  await addFixationLog({
    id: `LOG-APPLY-${Date.now()}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'fixation',
    action: 'updateProject',
    projectId: body.projectId,
    projectName: updated.name,
    summary: `更新转固申请项目：${Object.keys(body.updates).join(', ')}`,
    detail: body.updates
  })

  return { project: updated }
})






