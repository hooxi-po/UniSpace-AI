import { readBody } from 'h3'
import { readOperatingDB, writeOperatingDB } from '~/server/utils/operating-db'

type Body = {
  id?: string
  contractNo: string
  spaceId: string
  tenant: string
  rentPerMonth: number
  startDate: string
  endDate: string
  status: 'Active' | 'Expiring'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.contractNo?.trim()) throw createError({ statusCode: 400, statusMessage: 'contractNo_required' })
  if (!body?.spaceId) throw createError({ statusCode: 400, statusMessage: 'spaceId_required' })
  if (!body?.tenant?.trim()) throw createError({ statusCode: 400, statusMessage: 'tenant_required' })
  if (typeof body.rentPerMonth !== 'number' || Number.isNaN(body.rentPerMonth) || body.rentPerMonth <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'rentPerMonth_invalid' })
  }
  if (!body.startDate) throw createError({ statusCode: 400, statusMessage: 'startDate_required' })
  if (!body.endDate) throw createError({ statusCode: 400, statusMessage: 'endDate_required' })

  const db = await readOperatingDB()

  const space = db.spaces.find((s) => s.id === body.spaceId)
  if (!space) throw createError({ statusCode: 404, statusMessage: 'space_not_found' })

  const isEdit = Boolean(body.id)

  // 合同编号唯一性校验（编辑时排除自身）
  const conflict = db.contracts.find((c) => c.contractNo === body.contractNo.trim() && c.id !== (body.id || ''))
  if (conflict) throw createError({ statusCode: 409, statusMessage: 'contractNo_conflict' })

  if (isEdit) {
    const idx = db.contracts.findIndex((c) => c.id === body.id)
    if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'contract_not_found' })

    db.contracts[idx] = {
      ...db.contracts[idx],
      contractNo: body.contractNo.trim(),
      spaceId: body.spaceId,
      spaceName: space.name,
      tenant: body.tenant.trim(),
      rentPerMonth: body.rentPerMonth,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
    }
  } else {
    db.contracts.unshift({
      id: `CT-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      contractNo: body.contractNo.trim(),
      spaceId: body.spaceId,
      spaceName: space.name,
      tenant: body.tenant.trim(),
      rentPerMonth: body.rentPerMonth,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
    })

    // 新增合同后，房源状态联动为已出租
    const spaceIdx = db.spaces.findIndex((s) => s.id === body.spaceId)
    if (spaceIdx >= 0) {
      db.spaces[spaceIdx] = { ...db.spaces[spaceIdx], status: '已出租', monthlyRent: body.rentPerMonth }
    }
  }

  await writeOperatingDB(db)

  const contract = (body.id ? db.contracts.find((c) => c.id === body.id) : db.contracts[0])!

  return {
    source: 'mock',
    contract,
  }
})

