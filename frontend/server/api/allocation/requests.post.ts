import { addAllocationRequest, type AllocationRequest } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'
import { upsertPerson } from '~/server/utils/persons-db'

type Body = Partial<Omit<AllocationRequest, 'id' | 'requestedDate' | 'status'>>

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.department || !body?.reason || !body?.applicant) {
    throw createError({ statusCode: 400, statusMessage: 'department, applicant and reason required' })
  }

  const applicantId = body.applicantId || `P-${Date.now()}`

  // 申请人同步到人员表（演示环境：applicant 视为 personName）
  await upsertPerson({
    personId: applicantId,
    personName: body.applicant,
    departmentName: body.department,
    title: 'Other',
    status: 'Active',
  })

  const newRequest: AllocationRequest = {
    ...(body as any),
    applicantId,
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

