import { getQuery } from 'h3'
import { readOperatingDB, writeOperatingDB } from '~/server/utils/operating-db'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const id = String(q.id || '')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'id_required' })

  const db = await readOperatingDB()
  const idx = db.contracts.findIndex((c) => c.id === id)

  if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'contract_not_found' })

  const contract = db.contracts[idx]

  // 校验：若有关联未缴账单，不允许删除（业务约束）
  const hasUnpaid = db.rentBills.some((b) => b.contractId === id && b.status !== 'Paid')
  if (hasUnpaid) {
    throw createError({ statusCode: 409, statusMessage: 'contract_has_unpaid_bills' })
  }

  // 执行删除
  db.contracts.splice(idx, 1)

  // 联动：如果房源没有其他合同了，恢复为公开招租
  const hasOther = db.contracts.some((c) => c.spaceId === contract.spaceId)
  if (!hasOther) {
    const spaceIdx = db.spaces.findIndex((s) => s.id === contract.spaceId)
    if (spaceIdx >= 0) {
      db.spaces[spaceIdx].status = '公开招租'
    }
  }

  await writeOperatingDB(db)

  return { source: 'mock', id }
})

