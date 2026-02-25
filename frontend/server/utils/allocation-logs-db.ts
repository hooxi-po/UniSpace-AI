import { promises as fs } from 'node:fs'
import path from 'node:path'
import { withFileLock, writeJsonAtomic } from './file-db'

export type AllocationLogAction =
  | 'createRequest'
  | 'approve'
  | 'reject'
  | 'allocateRooms'

export type AllocationOperationLog = {
  id: string
  at: string
  operator: string
  module: 'allocation'
  action: AllocationLogAction
  requestId?: string
  department?: string
  summary: string
  detail?: Record<string, any>
}

type DbShape = { list: AllocationOperationLog[] }

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'allocation-logs.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = { list: [] }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readAllocationLogsDb(): Promise<DbShape> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).list)) {
      return { list: [] }
    }
    return parsed as DbShape
  } catch {
    return { list: [] }
  }
}

export async function writeAllocationLogsDb(next: DbShape) {
  await ensureDbFile()
  await withFileLock(DB_FILE, async () => {
    await writeJsonAtomic(DB_FILE, next)
  })
}

export async function listAllocationLogs(): Promise<AllocationOperationLog[]> {
  const db = await readAllocationLogsDb()
  return db.list
}

export async function addAllocationLog(log: AllocationOperationLog): Promise<AllocationOperationLog> {
  await withFileLock(DB_FILE, async () => {
    const db = await readAllocationLogsDb()
    db.list.unshift(log)
    await writeJsonAtomic(DB_FILE, db)
  })
  return log
}
