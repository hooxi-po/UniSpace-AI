import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type RentRemindLogItem = {
  id: string
  billId: string
  contractId?: string
  tenant: string
  spaceName: string
  period: string
  remindAt: string // yyyy-mm-dd
  channel: 'system'
}

export type RentRemindLogsDB = {
  logs: RentRemindLogItem[]
}

const DB_PATH = resolve(process.cwd(), 'frontend/server/data/rent-remind-logs.json')

export async function readRentRemindLogsDB(): Promise<RentRemindLogsDB> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as RentRemindLogsDB
    if (!parsed || !Array.isArray(parsed.logs)) return { logs: [] }
    return parsed
  } catch {
    return { logs: [] }
  }
}

export async function writeRentRemindLogsDB(db: RentRemindLogsDB) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

export async function appendRentRemindLog(item: Omit<RentRemindLogItem, 'id'>) {
  const db = await readRentRemindLogsDB()
  const log: RentRemindLogItem = {
    id: `remind_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ...item,
  }

  db.logs.unshift(log)
  await writeRentRemindLogsDB(db)
  return log
}
