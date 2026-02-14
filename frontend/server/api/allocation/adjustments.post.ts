import { addAdjustmentRequest, type AdjustmentRequest } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Omit<AdjustmentRequest, 'id' | 'createdAt' | 'status'>>(event)
  
  const newRequest: AdjustmentRequest = {
    ...body,
    id: `ADJ-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString().split('T')[0],
    status: 'Pending'
  }

  const added = await addAdjustmentRequest(newRequest)

  await addAllocationLog({
    id: `LOG-ADJ-NEW-${Date.now()}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'allocation',
    action: 'createRequest',
    requestId: added.id,
    department: added.department,
    summary: `提交了新的用房调整申请：${added.fromBuildingName}${added.fromRoomNo}`,
    detail: added
  })

  return { request: added }
})

