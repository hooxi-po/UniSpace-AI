import { defineEventHandler, readBody } from 'h3'
import { readChargingDb, writeChargingDb } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const billId = body?.billId as string | undefined
  const billNo = body?.billNo as string | undefined
  const departmentName = body?.departmentName as string | undefined
  const amount = body?.amount as number | undefined
  const paymentMethod = body?.paymentMethod as string | undefined

  if (!billId || !billNo || !departmentName || typeof amount !== 'number' || !paymentMethod) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: billId, billNo, departmentName, amount, paymentMethod',
    })
  }

  const db = await readChargingDb()

  const paymentDate = (body?.paymentDate as string | undefined) || new Date().toISOString().split('T')[0]
  const now = Date.now()

  const newPayment = {
    id: `PAY-${now}`,
    billId,
    billNo,
    departmentName,
    amount,
    paymentMethod,
    paymentDate,
    transactionNo: (body?.transactionNo as string | undefined) || `TXN-${now}`,
    operator: (body?.operator as string | undefined) || '财务处',
    status: 'Confirmed' as const,
    confirmedBy: (body?.confirmedBy as string | undefined) || '财务处',
    confirmedAt: new Date().toISOString().split('T')[0],
    voucherUrl: body?.voucherUrl as string | undefined,
  }

  if (!db.payments) db.payments = []
  db.payments.unshift(newPayment as any)

  // 联动更新费用记录（如果传了 feeId）
  const feeId = body?.feeId as string | undefined
  if (feeId) {
    const feeIdx = db.fees.findIndex(f => f.id === feeId)
    if (feeIdx !== -1) {
      const fee = db.fees[feeIdx]
      const paidAmount = (fee.paidAmount || 0) + amount
      const remainingAmount = Math.max(0, fee.totalCost - paidAmount)
      const nextFee = {
        ...fee,
        paidAmount,
        remainingAmount,
        isPaid: remainingAmount === 0,
        status: remainingAmount === 0 ? 'Completed' : fee.status,
        paidAt: remainingAmount === 0 ? paymentDate : fee.paidAt,
      }
      db.fees[feeIdx] = nextFee

      // 同步更新 bills 状态（按 departmentName + year + month 关联）
      if (Array.isArray(db.bills)) {
        const billIdx = db.bills.findIndex(b => b.departmentName === nextFee.departmentName && b.year === nextFee.year && b.month === nextFee.month)
        if (billIdx !== -1 && remainingAmount === 0) {
          db.bills[billIdx] = {
            ...db.bills[billIdx],
            status: 'Completed',
          }
        }
      }
    }
  }

  await writeChargingDb(db)
  return { payment: newPayment }
})
