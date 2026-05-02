import { listPersonUsagesByMonth } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const month = query.month as string
  
  if (!month) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing month parameter (YYYY-MM)',
    })
  }

  const list = await listPersonUsagesByMonth(month)
  return { list }
})

