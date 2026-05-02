import { defineEventHandler, readBody } from 'h3'
import { readChargingDb, writeChargingDb } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = await readChargingDb()

  const feeId = body?.feeId as string | undefined
  const reminderType = (body?.reminderType as any) || 'System'

  let newReminder: any

  if (feeId) {
    const fee = db.fees.find(f => f.id === feeId)
    if (!fee) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Fee not found',
      })
    }

    newReminder = {
      id: `REM-${Date.now()}`,
      billId: (body?.billId as string | undefined) || `BILL-${fee.departmentName}-${fee.month}`,
      billNo: (body?.billNo as string | undefined) || `GF-${fee.month}-${fee.departmentName.slice(0, 4)}`,
      departmentName: (body?.departmentName as string | undefined) || fee.departmentName,
      reminderType,
      content:
        (body?.content as string | undefined) ||
        `您的${fee.year}年度公房使用费账单待处理，待缴费用${fee.remainingAmount.toLocaleString()}元，请及时确认并缴费。`,
      sentAt: new Date().toISOString(),
      sentBy: (body?.sentBy as string | undefined) || '系统',
      isRead: false,
    }

    const feeIdx = db.fees.findIndex(f => f.id === feeId)
    db.fees[feeIdx].hasReminder = true
    db.fees[feeIdx].reminderCount = (db.fees[feeIdx].reminderCount || 0) + 1
    db.fees[feeIdx].lastReminderAt = new Date().toISOString().split('T')[0]
  } else {
    const owner = String(body?.owner || body?.departmentName || '住户').trim()
    const roomNo = String(body?.roomNo || '').trim()
    const month = String(body?.month || '').trim() || new Date().toISOString().slice(0, 7)
    const amountDue = Number(body?.amountDue || 0)

    newReminder = {
      id: `REM-${Date.now()}`,
      billId: (body?.billId as string | undefined) || `UTIL-${month}-${roomNo || 'ROOM'}`,
      billNo: (body?.billNo as string | undefined) || `UTIL-${month}-${(roomNo || 'ROOM').replace(/\s+/g, '')}`,
      departmentName: owner,
      reminderType,
      content:
        (body?.content as string | undefined)
        || `您的${month}水电账单待处理，房间：${roomNo || '—'}，待缴费用${amountDue.toFixed(2)}元，请及时确认并缴费。`,
      sentAt: new Date().toISOString(),
      sentBy: (body?.sentBy as string | undefined) || '系统',
      isRead: false,
    }
  }

  if (!db.reminders) db.reminders = []
  db.reminders.unshift(newReminder as any)

  await writeChargingDb(db)
  return { reminder: newReminder }
})
