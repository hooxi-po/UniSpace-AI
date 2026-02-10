import { promises as fs } from 'node:fs'
import path from 'node:path'

export type GaojibiaoRow = {
  projectId: string
  projectName: string
  assetCode?: string
  assetName?: string
  department?: string
  serviceLife?: number
  originalValue?: number
  residualRate?: number
  updatedAt: string
}

type DbShape = { list: GaojibiaoRow[] }

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'reports-gaojibiao.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = { list: [] }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readGaojibiaoDb(): Promise<DbShape> {
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

export async function writeGaojibiaoDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listGaojibiaoRows(): Promise<GaojibiaoRow[]> {
  const db = await readGaojibiaoDb()
  return db.list
}

export async function upsertGaojibiaoRow(row: Omit<GaojibiaoRow, 'updatedAt'> & { updatedAt?: string }): Promise<GaojibiaoRow> {
  const db = await readGaojibiaoDb()
  const nextRow: GaojibiaoRow = {
    ...row,
    updatedAt: row.updatedAt || new Date().toISOString(),
  }

  const idx = db.list.findIndex(r => r.projectId === nextRow.projectId)
  if (idx === -1) db.list.push(nextRow)
  else db.list[idx] = { ...db.list[idx], ...nextRow }

  await writeGaojibiaoDb(db)
  return nextRow
}

