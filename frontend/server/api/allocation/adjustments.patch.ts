import { updateAdjustmentRequest } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'

type Body = {
  id: string
  updates: any
  logSummary?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.id) {
    throw createError({ statusCode: 400, statusMessage: 'id required' })
  }

  const updated = await updateAdjustmentRequest(body.id, body.updates)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Adjustment request not found' })
  }

  if (body.logSummary) {
    await addAllocationLog({
      id: `LOG-ADJ-UPDATE-${Date.now()}`,
      at: new Date().toISOString(),
      operator: '当前用户',
      module: 'allocation',
      action: 'approve',
      requestId: updated.id,
      department: updated.department,
      summary: body.logSummary,
      detail: body.updates,
    })
  }

  return { request: updated }
})

