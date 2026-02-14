import { promises as fs } from 'node:fs'
import path from 'node:path'

export type FixationLogAction =
  | 'updateProject'
  | 'addAttachment'
  | 'updateAttachment'
  | 'deleteAttachment'
  | 'addSplitItem'
  | 'deleteSplitItem'
  | 'syncRoomFunctions'
  | 'addBuildings'
  | 'addRooms'

export type FixationOperationLog = {
  id: string
  at: string
  operator: string
  module: 'fixation'
  action: FixationLogAction
  projectId?: string
  projectName?: string
  summary: string
  detail?: Record<string, any>
}

type DbShape = { list: FixationOperationLog[] }

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'fixation-logs.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = { list: [] }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readFixationLogsDb(): Promise<DbShape> {
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

export async function writeFixationLogsDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listFixationLogs(): Promise<FixationOperationLog[]> {
  const db = await readFixationLogsDb()
  return db.list
}

export async function addFixationLog(log: FixationOperationLog): Promise<FixationOperationLog> {
  const db = await readFixationLogsDb()
  db.list.unshift(log)
  await writeFixationLogsDb(db)
  return log
}

