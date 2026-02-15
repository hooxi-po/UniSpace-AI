import { listPersonBillsByYear } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const yearRaw = query.year as string

  const year = Number(yearRaw)
  if (!yearRaw || Number.isNaN(year)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid year parameter',
    })
  }

  const list = await listPersonBillsByYear(year)
  return { list }
})

