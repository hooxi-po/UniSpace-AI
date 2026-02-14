import { addAllocationRequest, type AllocationRequest } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'

type Body = Omit<AllocationRequest, 'id' | 'requestedDate' | 'status'>

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.department || !body?.reason) {
    throw createError({ statusCode: 400, statusMessage: 'department and reason required' })
  }

  const newRequest: AllocationRequest = {
    ...body,
    id: `REQ-${Date.now().toString().slice(-6)}`,
    requestedDate: new Date().toISOString().split('T')[0],
    status: 'Pending',
    approvalRecords: body.approvalRecords || []
  }

  const added = await addAllocationRequest(newRequest)

  await addAllocationLog({
    id: `LOG-ALLOC-NEW-${Date.now()}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'allocation',
    action: 'createRequest',
    requestId: added.id,
    department: added.department,
    summary: `提交了新的用房申请，申请面积：${added.area}m²`,
    detail: added,
  })

  return { request: added }
})

