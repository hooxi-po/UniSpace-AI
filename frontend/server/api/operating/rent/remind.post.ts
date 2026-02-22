import { readBody } from 'h3'
import { readOperatingDB, writeOperatingDB } from '~/server/utils/operating-db'
import { appendRentRemindLog } from '~/server/utils/rent-remind-logs-db'

type Body = {
  billId: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.billId) throw createError({ statusCode: 400, statusMessage: 'billId_required' })

  const db = await readOperatingDB()
  const idx = db.rentBills.findIndex((b) => b.id === body.billId)

  if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'bill_not_found' })

  const bill = db.rentBills[idx]
  if (bill.status === 'Paid') throw createError({ statusCode: 400, statusMessage: 'bill_already_paid' })

  const today = new Date().toISOString().slice(0, 10)

  // 1. 更新账单本身的催缴次数和日期
  db.rentBills[idx] = {
    ...bill,
    reminderCount: (bill.reminderCount || 0) + 1,
    lastReminderDate: today,
  }

  // 2. 写入独立的催缴日志 JSON 文件（审计要求）
  await appendRentRemindLog({
    billId: bill.id,
    contractId: bill.contractId,
    tenant: bill.tenant,
    spaceName: bill.spaceName,
    period: bill.period,
    remindAt: today,
    channel: 'system',
  })

  await writeOperatingDB(db)

  return {
    source: 'mock',
    bill: db.rentBills[idx],
  }
})
