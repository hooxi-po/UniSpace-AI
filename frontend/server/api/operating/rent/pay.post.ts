import { readBody } from 'h3'
import { readOperatingDB, writeOperatingDB } from '~/server/utils/operating-db'

type Body = {
  billId: string
  amount: number
  method: string
  transactionNo: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  if (!body?.billId) throw createError({ statusCode: 400, statusMessage: 'billId_required' })
  if (typeof body?.amount !== 'number' || Number.isNaN(body.amount) || body.amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'amount_invalid' })
  }
  if (!body?.method) throw createError({ statusCode: 400, statusMessage: 'method_required' })
  if (!body?.transactionNo) throw createError({ statusCode: 400, statusMessage: 'transactionNo_required' })

  const db = await readOperatingDB()
  const idx = db.rentBills.findIndex((b) => b.id === body.billId)

  if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'bill_not_found' })

  const bill = db.rentBills[idx]
  const currentPaidAmount = bill.paidAmount || 0
  const remainingAmount = bill.totalAmount - currentPaidAmount

  if (remainingAmount <= 0) {
    throw createError({ statusCode: 409, statusMessage: 'bill_already_paid' })
  }
  if (body.amount > remainingAmount) {
    throw createError({ statusCode: 400, statusMessage: 'amount_exceeds_remaining' })
  }

  const newPaidAmount = (bill.paidAmount || 0) + body.amount
  const isFullyPaid = newPaidAmount >= bill.totalAmount
  const nextStatus = isFullyPaid ? 'Paid' : (bill.status === 'Overdue' ? 'Overdue' : 'PartialPaid')

  // 更新账单状态
  db.rentBills[idx] = {
    ...bill,
    paidAmount: newPaidAmount,
    status: nextStatus,
    paidDate: new Date().toISOString().slice(0, 10),
    paymentMethod: body.method,
    transactionNo: body.transactionNo,
  }

  // 联动：更新合同的累计收款和欠费
  const contractIdx = db.contracts.findIndex((c) => c.id === bill.contractId)
  if (contractIdx >= 0) {
    // 假设 ContractItem 也有这些统计字段
    const contract = db.contracts[contractIdx] as any
    contract.totalRentReceived = (contract.totalRentReceived || 0) + body.amount
    contract.outstandingRent = Math.max(0, (contract.outstandingRent || 0) - body.amount)
  }

  await writeOperatingDB(db)

  return {
    source: 'mock',
    bill: db.rentBills[idx],
  }
})







