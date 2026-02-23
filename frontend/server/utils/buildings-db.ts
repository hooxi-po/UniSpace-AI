import { promises as fs } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

export type FundSource = 'Fiscal' | 'SelfRaised' | 'Mixed'
export type AssetStatus = 'DisposalPending' | 'PendingReview' | 'PendingArchive' | 'Archived'

export type BuildingRow = {
  code: string
  projectName: string
  contractor?: string
  supervisor?: string
  contractAmount?: number
  auditAmount?: number
  fundSource?: FundSource
  location?: string
  plannedArea?: number
  floorCount?: number
  roomCount?: number
  buildingName?: string
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  projectManager?: string
  status?: AssetStatus
}

export type RoomType = 'Admin' | 'Teaching' | 'Lab' | 'Student' | 'TeacherApartment' | 'Commercial' | 'Logistics'
export type RoomStatus = 'Empty' | 'Occupied'

export type RoomRow = {
  id: string
  buildingCode?: string
  buildingName: string
  roomNo: string
  floor?: number
  area?: number
  type?: RoomType
  status?: RoomStatus
  department?: string
  mainCategory?: string
  subCategory?: string
}

type DbShape = {
  buildings: BuildingRow[]
  rooms: RoomRow[]
}

const isFrontendCwd = basename(process.cwd()) === 'frontend'
const DB_FILE_CANDIDATES = isFrontendCwd
  ? [
      resolve(process.cwd(), 'server/data/buildings.json'),
      resolve(process.cwd(), 'frontend/server/data/buildings.json'),
    ]
  : [
      resolve(process.cwd(), 'frontend/server/data/buildings.json'),
      resolve(process.cwd(), 'server/data/buildings.json'),
    ]
let cachedDbFile: string | null = null

async function getBuildingsDbPath() {
  if (cachedDbFile) return cachedDbFile

  for (const candidate of DB_FILE_CANDIDATES) {
    try {
      await fs.access(candidate)
      cachedDbFile = candidate
      return candidate
    } catch {
      // continue
    }
  }

  for (const candidate of DB_FILE_CANDIDATES) {
    try {
      await fs.access(dirname(candidate))
      cachedDbFile = candidate
      return candidate
    } catch {
      // continue
    }
  }

  cachedDbFile = DB_FILE_CANDIDATES[0]
  return cachedDbFile
}

export async function readBuildingsDB(): Promise<DbShape> {
  const raw = await fs.readFile(await getBuildingsDbPath(), 'utf-8')
  const parsed = JSON.parse(raw) as DbShape
  return {
    buildings: Array.isArray(parsed.buildings) ? parsed.buildings : [],
    rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
  }
}

export async function writeBuildingsDB(next: DbShape) {
  const dbFile = await getBuildingsDbPath()
  await fs.mkdir(dirname(dbFile), { recursive: true })
  await fs.writeFile(dbFile, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listBuildings() {
  const db = await readBuildingsDB()
  return db.buildings
}

export async function listRooms(params?: { buildingCode?: string; buildingName?: string; type?: RoomType }) {
  const db = await readBuildingsDB()
  return db.rooms
    .filter(r => (params?.buildingCode ? r.buildingCode === params.buildingCode : true))
    .filter(r => (params?.buildingName ? r.buildingName === params.buildingName : true))
    .filter(r => (params?.type ? r.type === params.type : true))
}

export async function getNextBuildingCode(): Promise<string> {
  const db = await readBuildingsDB()
  let max = 0
  for (const b of db.buildings) {
    const m = String(b.code || '').match(/^BLD-(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n)) max = Math.max(max, n)
    }
  }
  const next = max + 1
  return `BLD-${String(next).padStart(3, '0')}`
}

export async function upsertBuilding(row: BuildingRow) {
  const nextRow: BuildingRow = {
    ...row,
    code: String(row.code).trim(),
    projectName: String(row.projectName || '').trim(),
    buildingName: row.buildingName ? String(row.buildingName).trim() : undefined,
  }

  if (!nextRow.code) throw new Error('building.code required')
  if (!nextRow.projectName) throw new Error('building.projectName required')

  const db = await readBuildingsDB()
  const idx = db.buildings.findIndex(b => b.code === nextRow.code)
  if (idx === -1) db.buildings.unshift(nextRow)
  else db.buildings[idx] = { ...db.buildings[idx], ...nextRow }

  await writeBuildingsDB(db)
  return nextRow
}

export async function upsertRooms(newRooms: RoomRow[]) {
  const rooms = Array.isArray(newRooms) ? newRooms : []
  const db = await readBuildingsDB()

  const idxById = new Map<string, number>()
  db.rooms.forEach((r, idx) => idxById.set(r.id, idx))

  for (const r of rooms) {
    if (!r || !r.id) continue
    const next: RoomRow = {
      ...r,
      id: String(r.id).trim(),
      buildingCode: r.buildingCode ? String(r.buildingCode).trim() : undefined,
      buildingName: String(r.buildingName || '').trim(),
      roomNo: String(r.roomNo || '').trim(),
    }
    if (!next.buildingName || !next.roomNo) continue

    const hit = idxById.get(next.id)
    if (hit === undefined) {
      db.rooms.unshift(next)
      idxById.set(next.id, 0)
    } else {
      db.rooms[hit] = { ...db.rooms[hit], ...next }
    }
  }

  await writeBuildingsDB(db)
  return rooms
}

export function genRoomsForBuilding(building: Required<Pick<BuildingRow, 'code' | 'projectName' | 'floorCount'>> & { roomCount?: number }) {
  const floorCount = Number(building.floorCount || 0)
  const roomsPerFloor = 20

  const rooms: RoomRow[] = []
  for (let floor = 1; floor <= floorCount; floor++) {
    for (let i = 1; i <= roomsPerFloor; i++) {
      const roomNo = `${floor}${String(i).padStart(2, '0')}`
      rooms.push({
        id: `RM-${building.code}-${roomNo}`,
        buildingCode: building.code,
        buildingName: building.projectName,
        roomNo,
        floor,
        area: 40 + ((i % 5) * 5),
        type: inferRoomType(building.projectName, roomNo),
        status: 'Empty',
        department: inferDepartment(building.projectName),
      })
    }
  }
  return rooms
}

export function inferRoomType(buildingName: string, roomNo: string): RoomType {
  if (buildingName.includes('实验')) return 'Lab'
  if (buildingName.includes('宿舍')) {
    // 假设每层最后 5 个房间作为教师周转公寓
    const roomIdx = Number(roomNo.slice(-2))
    return roomIdx > 15 ? 'TeacherApartment' : 'Student'
  }
  if (buildingName.includes('创新') || buildingName.includes('创业')) return 'Commercial'
  if (buildingName.includes('博学')) return 'Teaching'
  return 'Admin'
}

export function inferDepartment(buildingName: string): string {
  if (buildingName.includes('实验')) return '科研院'
  if (buildingName.includes('宿舍')) return '学生工作处'
  if (buildingName.includes('创新') || buildingName.includes('创业')) return '资产经营公司'
  if (buildingName.includes('博学')) return '教务处'
  return '后勤处'
}
