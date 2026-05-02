import { generatePersonBillsByMonth } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ month?: string }>(event)
  const month = body?.month

  if (!month) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing month in body (YYYY-MM)',
    })
  }

  const list = await generatePersonBillsByMonth(month)
  return { list }
})

