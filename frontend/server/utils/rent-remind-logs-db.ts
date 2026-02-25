import { access, mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { withFileLock, writeJsonAtomic } from './file-db'

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

const isFrontendCwd = basename(process.cwd()) === 'frontend'
const DB_PATH_CANDIDATES = isFrontendCwd
  ? [
      resolve(process.cwd(), 'server/data/rent-remind-logs.json'),
      resolve(process.cwd(), 'frontend/server/data/rent-remind-logs.json'),
    ]
  : [
      resolve(process.cwd(), 'frontend/server/data/rent-remind-logs.json'),
      resolve(process.cwd(), 'server/data/rent-remind-logs.json'),
    ]
let cachedDbPath: string | null = null

async function getDbPath() {
  if (cachedDbPath) return cachedDbPath

  for (const candidate of DB_PATH_CANDIDATES) {
    try {
      await access(dirname(candidate))
      cachedDbPath = candidate
      return candidate
    } catch {
      // continue
    }
  }

  cachedDbPath = DB_PATH_CANDIDATES[0]
  return cachedDbPath
}

export async function readRentRemindLogsDB(): Promise<RentRemindLogsDB> {
  try {
    const raw = await readFile(await getDbPath(), 'utf-8')
    const parsed = JSON.parse(raw) as RentRemindLogsDB
    if (!parsed || !Array.isArray(parsed.logs)) return { logs: [] }
    return parsed
  } catch {
    return { logs: [] }
  }
}

export async function writeRentRemindLogsDB(db: RentRemindLogsDB) {
  const dbPath = await getDbPath()
  await withFileLock(dbPath, async () => {
    await mkdir(dirname(dbPath), { recursive: true })
    await writeJsonAtomic(dbPath, db)
  })
}

export async function appendRentRemindLog(item: Omit<RentRemindLogItem, 'id'>) {
  const log: RentRemindLogItem = {
    id: `remind_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ...item,
  }

  const dbPath = await getDbPath()
  await withFileLock(dbPath, async () => {
    const db = await readRentRemindLogsDB()
    db.logs.unshift(log)
    await writeJsonAtomic(dbPath, db)
  })
  return log
}
