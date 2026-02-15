import { defineEventHandler } from 'h3'
import { readChargingDb } from '~/server/utils/charging-db'

export default defineEventHandler(async () => {
  const db = await readChargingDb()
  const list = db.reminders || []
  return { list }
})

