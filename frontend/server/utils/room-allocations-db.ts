import { promises as fs } from 'node:fs'
import path from 'node:path'

export type RoomAllocation = {
  allocationId: string
  roomId: string
  personId: string
  startDate: string
  endDate?: string
  shareArea?: number
}

type DbShape = {
  allocations: RoomAllocation[]
}

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'room-allocations.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = {
      allocations: [],
    }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readRoomAllocationsDb(): Promise<DbShape> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    return {
      allocations: Array.isArray(parsed?.allocations) ? parsed.allocations : [],
    }
  } catch {
    return { allocations: [] }
  }
}

export async function writeRoomAllocationsDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listRoomAllocations(): Promise<RoomAllocation[]> {
  const db = await readRoomAllocationsDb()
  return db.allocations
}

export async function addRoomAllocation(allocation: RoomAllocation): Promise<RoomAllocation> {
  const db = await readRoomAllocationsDb()
  db.allocations.unshift(allocation)
  await writeRoomAllocationsDb(db)
  return allocation
}

export async function endRoomAllocation(allocationId: string, endDate: string): Promise<RoomAllocation | null> {
  const db = await readRoomAllocationsDb()
  const idx = db.allocations.findIndex(a => a.allocationId === allocationId)
  if (idx === -1) return null
  db.allocations[idx] = { ...db.allocations[idx], endDate }
  await writeRoomAllocationsDb(db)
  return db.allocations[idx]
}

