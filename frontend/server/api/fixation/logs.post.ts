import { addFixationLog, type FixationOperationLog } from '~/server/utils/fixation-logs-db'

type Body = Omit<FixationOperationLog, 'id' | 'at' | 'module'> & {
  id?: string
  at?: string
  module?: 'fixation'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'action required' })
  }

  const log: FixationOperationLog = {
    id: body.id || `LOG-${Date.now()}`,
    at: body.at || new Date().toISOString(),
    operator: body.operator || '当前用户',
    module: 'fixation',
    action: body.action,
    projectId: body.projectId,
    projectName: body.projectName,
    summary: body.summary || '',
    detail: body.detail,
  }

  await addFixationLog(log)
  return { ok: true, log }
})

