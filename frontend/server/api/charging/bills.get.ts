import { defineEventHandler, getQuery } from 'h3'
import { readChargingDb } from '~/server/utils/charging-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const year = query.year ? Number(query.year) : undefined
  const month = query.month as string | undefined
  
  const db = await readChargingDb()
  let list = db.bills || []
  
  if (year) {
    list = list.filter(b => b.year === year)
  }
  if (month) {
    list = list.filter(b => b.month === month)
  }
  
  return { list }
})

