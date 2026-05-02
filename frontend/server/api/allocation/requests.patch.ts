import { updateAllocationRequest, type AllocationRequest } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'
import { addRoomAllocation } from '~/server/utils/room-allocations-db'
import { upsertPerson } from '~/server/utils/persons-db'

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

  // 2A 挂钩：如果状态变为 Allocated 且分配了房间，则写入占用关系表
  if (body.updates.status === 'Allocated' && updated.allocatedRooms && updated.allocatedRooms.length > 0) {
    const today = new Date().toISOString().split('T')[0]
    for (const roomId of updated.allocatedRooms) {
      await addRoomAllocation({
        allocationId: `ALC-${Date.now()}-${Math.random().toString(36).slice(-4)}`,
        roomId,
        personId: updated.applicantId,
        startDate: today
      })
    }
  }

  // 确保人员信息在表中（同步更新）
  if (updated.applicant && updated.applicantId) {
    await upsertPerson({
      personId: updated.applicantId,
      personName: updated.applicant,
      departmentName: updated.department,
      title: 'Other', // 默认职称，可在人员管理中修改
      status: 'Active'
    })
  }

  // allocation 模块日志
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

