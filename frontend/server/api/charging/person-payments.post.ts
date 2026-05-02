import { addPersonPayment } from '~/server/utils/charging-db'
import type { PersonPayment } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    billId?: string
    personName?: string
    amount?: number
    paymentMethod?: PersonPayment['paymentMethod']
    paymentDate?: string
  }>(event)

  if (!body?.billId || !body?.personName || typeof body.amount !== 'number' || !body.paymentMethod) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: billId, personName, amount, paymentMethod',
    })
  }

  const payment: PersonPayment = {
    id: `PPAY-${Date.now()}`,
    billId: body.billId,
    personName: body.personName,
    amount: body.amount,
    paymentMethod: body.paymentMethod,
    paymentDate: body.paymentDate || new Date().toISOString().split('T')[0],
    status: 'Confirmed',
  }

  const saved = await addPersonPayment(payment)
  return { payment: saved }
})

