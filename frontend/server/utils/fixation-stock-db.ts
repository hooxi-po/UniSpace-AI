import { promises as fs } from 'node:fs'
import path from 'node:path'

export type FundSource = 'Fiscal' | 'SelfRaised' | 'Mixed'
export type AssetStatus = 'DisposalPending'

export type Attachment = {
  id: string
  name: string
  type:
    | 'approval'
    | 'bidding'
    | 'contract'
    | 'change'
    | 'drawing'
    | 'acceptance'
    | 'audit'
    | 'other'
  uploadDate: string
  uploadedByDept: string
  reviewStatus: 'Pending' | 'Approved' | 'Rejected'
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export type AssetCategory = 'Building' | 'Land' | 'Structure' | 'Equipment' | 'Greening' | 'Other'

export type AssetSplitItem = {
  id: string
  category: AssetCategory
  name: string
  amount: number
  area?: number
  quantity?: number
  depreciationYears: number
  depreciationMethod: 'StraightLine' | 'Accelerated'
  assetCardNo?: string
}

export type RoomPlanItem = {
  id: string
  buildingName: string
  roomNo: string
  area: number
  mainCategory: string
  subCategory: string
}

export type Building = {
  id: string
  code: string // 楼宇编码
  name: string // 楼宇名称

  // 与 FixNewProject.Project 保持一致（除房间划分/资产划分/附件外）
  contractor: string
  contractAmount: number
  auditAmount?: number
  auditReductionRate?: number
  status: AssetStatus
  completionDate: string
  hasCadData: boolean
  fundSource: FundSource
  location: string
  plannedArea?: number // 由房间汇总实时算出，此处不维护
  floorCount?: number
  roomCount?: number // 由房间汇总实时算出，此处不维护
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  projectManager: string
  supervisor: string
  milestones: { milestone: string; date: string; operator: string; notes: string }[]
  // 以下字段在存量导入时不维护，由转固申请模块维护
  attachments: Attachment[]
  splitItems: AssetSplitItem[]
  roomFunctionPlan: RoomPlanItem[]
  isOverdue: boolean
  isArchived: boolean
}

export type Room = {
  id: string
  buildingName: string // 楼宇名称
  buildingCode?: string // 楼宇编码（可选）
  roomNo: string // 房间号
  floor: number // 楼层
  area: number // 面积（㎡）
  type: 'Admin' | 'Teaching' | 'Lab' | 'Student' | 'Commercial' | 'Logistics' // 房间类型
  status: 'Empty' | 'Occupied' // 状态
  department: string // 使用部门
  sourceProjectId?: string // 来源工程项目ID（可选）
  functionMain?: string // 主功能（与工程项目 roomFunctionPlan 兼容）
  functionSub?: string // 子功能（与工程项目 roomFunctionPlan 兼容）
}

type DbShape = {
  buildings: Building[]
  rooms: Room[]
}

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'fixation-stock.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = { buildings: [], rooms: [] }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readStockDb(): Promise<DbShape> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.buildings) || !Array.isArray(parsed.rooms)) {
      return { buildings: [], rooms: [] }
    }

    // 兼容旧数据：把旧字段迁移到新字段
    const buildings = (parsed.buildings as any[]).map((b: any) => {
      if (typeof b !== 'object' || b === null) return b
      const migrated: Building = {
        id: b.id || `BLD-${b.code}`,
        code: b.code,
        name: b.name,

        // 兼容旧字段：value -> contractAmount, hasCad -> hasCadData
        contractor: b.contractor || '未指定',
        contractAmount: b.contractAmount ?? b.value ?? 0,
        auditAmount: b.auditAmount !== undefined ? Number(b.auditAmount) : undefined,
        auditReductionRate: b.auditReductionRate !== undefined ? Number(b.auditReductionRate) : undefined,
        status: b.status || 'DisposalPending',
        completionDate: b.completionDate || new Date().toISOString().split('T')[0],
        hasCadData: b.hasCadData ?? b.hasCad ?? false,
        fundSource: (b.fundSource || 'Fiscal') as any,
        location: b.location || '-',
        plannedArea: b.plannedArea ?? undefined,
        floorCount: b.floorCount !== undefined ? Number(b.floorCount) : undefined,
        roomCount: b.roomCount ?? undefined,
        plannedStartDate: b.plannedStartDate || '',
        plannedEndDate: b.plannedEndDate || '',
        actualStartDate: b.actualStartDate || undefined,
        actualEndDate: b.actualEndDate || undefined,
        projectManager: b.projectManager || '',
        supervisor: b.supervisor || '',
        milestones: Array.isArray(b.milestones) ? b.milestones : [
          {
            milestone: 'Approval',
            date: new Date().toISOString().split('T')[0],
            operator: '当前用户',
            notes: '存量楼宇导入（兼容迁移）',
          },
        ],
        attachments: Array.isArray(b.attachments) ? b.attachments : [],
        splitItems: Array.isArray(b.splitItems) ? b.splitItems : [],
        roomFunctionPlan: Array.isArray(b.roomFunctionPlan) ? b.roomFunctionPlan : [],
        isOverdue: b.isOverdue ?? false,
        isArchived: b.isArchived ?? false,
      }
      return migrated
    })

    return { buildings, rooms: parsed.rooms }
  } catch {
    return { buildings: [], rooms: [] }
  }
}

export async function writeStockDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listBuildings(): Promise<Building[]> {
  const db = await readStockDb()
  return db.buildings
}

export async function listRooms(): Promise<Room[]> {
  const db = await readStockDb()
  return db.rooms
}

export async function addBuildings(buildings: Building[]): Promise<Building[]> {
  const db = await readStockDb()
  const existingCodes = new Set(db.buildings.map(b => b.code))
  const toAdd = buildings.filter(b => b.code && !existingCodes.has(b.code))
  db.buildings.unshift(...toAdd)
  await writeStockDb(db)
  return toAdd
}

export async function addRooms(rooms: Room[]): Promise<Room[]> {
  const db = await readStockDb()
  const existingKeySet = new Set(db.rooms.map(r => `${r.buildingName}::${r.roomNo}`))
  const toAdd = rooms.filter(r => r.buildingName && r.roomNo && !existingKeySet.has(`${r.buildingName}::${r.roomNo}`))
  db.rooms.unshift(...toAdd)
  await writeStockDb(db)
  return toAdd
}
