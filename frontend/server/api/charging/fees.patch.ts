import { defineEventHandler, readBody } from 'h3'
import { readChargingDb, writeChargingDb } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const id = body?.id as string | undefined
  const updates = body?.updates as Record<string, any> | undefined

  if (!id || !updates) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing id or updates in request body',
    })
  }

  const db = await readChargingDb()
  const index = db.fees.findIndex(f => f.id === id)

  if (index === -1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Fee record not found',
    })
  }

  const nextFee = { ...db.fees[index], ...updates }
  db.fees[index] = nextFee

  // 同步更新 bills 状态（按 departmentName + year + month 关联）
  if (updates.status && Array.isArray(db.bills)) {
    const billIdx = db.bills.findIndex(b => b.departmentName === nextFee.departmentName && b.year === nextFee.year && b.month === nextFee.month)
    if (billIdx !== -1) {
      db.bills[billIdx] = { ...db.bills[billIdx], status: nextFee.status }
      if (nextFee.status === 'FinanceProcessing') {
        db.bills[billIdx].confirmedAt = nextFee.confirmedAt
      }
    }
  }

  await writeChargingDb(db)

  return { fee: db.fees[index] }
})
