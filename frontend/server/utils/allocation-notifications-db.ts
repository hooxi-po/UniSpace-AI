import { promises as fs } from 'node:fs'
import path from 'node:path'

export type AllocationNotification = {
  id: string
  at: string
  from: string
  to: string
  toType: 'college' | 'person'
  content: string
  roomId: string
  roomInfo: string
  status: 'Unread' | 'Read'
}

type DbShape = { list: AllocationNotification[] }

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'allocation-notifications.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = { list: [] }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readAllocationNotificationsDb(): Promise<DbShape> {
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

export async function writeAllocationNotificationsDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function addAllocationNotification(notification: AllocationNotification): Promise<AllocationNotification> {
  const db = await readAllocationNotificationsDb()
  db.list.unshift(notification)
  await writeAllocationNotificationsDb(db)
  return notification
}

