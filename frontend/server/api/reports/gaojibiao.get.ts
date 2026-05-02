import { listGaojibiaoRows } from '~/server/utils/reports-gaojibiao-db'

export default defineEventHandler(async () => {
  const list = await listGaojibiaoRows()
  return { list }
})

