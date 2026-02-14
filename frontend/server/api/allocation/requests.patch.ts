import { updateAllocationRequest, type AllocationRequest } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'

type Body = {
  id: string
  updates: Partial<AllocationRequest>
  logSummary?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.id) {
    throw createError({ statusCode: 400, statusMessage: 'id required' })
  }

  const updated = await updateAllocationRequest(body.id, body.updates)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  }

  // allocation 模块日志：不写入 fixation 操作记录
  if (body.logSummary) {
    await addAllocationLog({
      id: `LOG-ALLOC-${Date.now()}`,
      at: new Date().toISOString(),
      operator: '当前用户',
      module: 'allocation',
      action: 'approve',
      requestId: body.id,
      department: updated.department,
      summary: body.logSummary,
      detail: body.updates,
    })
  }

  return { request: updated }
})

