import { promises as fs } from 'node:fs'
import path from 'node:path'
import { readBuildingsDB } from './buildings-db'

export type AssetCategory = 'Building' | 'Land' | 'Structure' | 'Equipment' | 'Greening' | 'Other'
export type AssetStatus = 'DisposalPending' | 'PendingReview' | 'PendingArchive' | 'Archived'
export type ProjectMilestone = 'Approval'

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

export type RoomPlanItem = {
  id: string
  buildingName: string
  roomNo: string
  area: number
  mainCategory: string
  subCategory: string
}

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

export type Project = {
  id: string
  name: string
  contractor: string
  contractAmount: number
  auditAmount?: number
  auditReductionRate?: number
  status: AssetStatus
  completionDate: string
  hasCadData: boolean
  fundSource: 'Fiscal' | 'SelfRaised' | 'Mixed'
  location: string
  plannedArea?: number
  floorCount?: number
  roomCount?: number
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  projectManager: string
  supervisor: string
  milestones: { milestone: ProjectMilestone; date: string; operator: string; notes: string }[]
  attachments: Attachment[]
  splitItems: AssetSplitItem[]
  roomFunctionPlan: RoomPlanItem[]
  roomFunctionPlanConfirmed?: boolean
  roomFunctionPlanConfirmedAt?: string
  roomFunctionPlanConfirmedBy?: string
  isOverdue: boolean
  isArchived: boolean
  source?: 'project' | 'stock' // 数据来源：project=新建工程项目，stock=存量房产导入
  gaojibiaoData?: {
    assetCode?: string
    assetName?: string
    department?: string
    serviceLife?: number
    originalValue?: number
    residualRate?: number
  }
}

type DbShape = { list: Project[] }

const isFrontendCwd = path.basename(process.cwd()) === 'frontend'
const DB_FILE_CANDIDATES = isFrontendCwd
  ? [
      path.resolve(process.cwd(), 'server', 'data', 'fixation-audit.json'),
      path.resolve(process.cwd(), 'frontend', 'server', 'data', 'fixation-audit.json'),
    ]
  : [
      path.resolve(process.cwd(), 'frontend', 'server', 'data', 'fixation-audit.json'),
      path.resolve(process.cwd(), 'server', 'data', 'fixation-audit.json'),
    ]
let cachedDbFile: string | null = null

async function getDbFilePath() {
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
      await fs.access(path.dirname(candidate))
      cachedDbFile = candidate
      return candidate
    } catch {
      // continue
    }
  }

  cachedDbFile = DB_FILE_CANDIDATES[0]
  return cachedDbFile
}

async function ensureDbFile() {
  const dbFile = await getDbFilePath()
  await fs.mkdir(path.dirname(dbFile), { recursive: true })
  try {
    await fs.access(dbFile)
  } catch {
    const init: DbShape = { list: [] }
    await fs.writeFile(dbFile, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readAuditDb(): Promise<DbShape> {
  await ensureDbFile()
  const dbFile = await getDbFilePath()
  const raw = await fs.readFile(dbFile, 'utf-8')
  let db: DbShape = { list: [] }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).list)) {
      db = parsed as DbShape
    }
  } catch {}

  // 核心规则：以 buildings.json (真源) 强制同步到 fixation-audit.json
  try {
    const bDb = await readBuildingsDB()
    let changed = false

    // 1) 同步建筑物 -> 项目
    for (const b of bDb.buildings) {
      const code = String(b.code || '').trim()
      const m = code.match(/^BLD-(\d+)$/)
      if (!m) continue

      const stockId = `STOCK-BLD-${m[1]}`
      const existingIdx = db.list.findIndex(p => p.id === stockId)

      const contractAmount = Number(b.contractAmount || 0)
      const auditAmount = b.auditAmount !== undefined ? Number(b.auditAmount) : undefined
      const auditReductionRate = (auditAmount !== undefined && contractAmount > 0)
        ? Number((((contractAmount - auditAmount) / contractAmount) * 100).toFixed(2))
        : undefined

      const projectData: Project = {
        id: stockId,
        name: b.projectName || b.buildingName || '',
        contractor: b.contractor || '福建建工集团',
        contractAmount,
        auditAmount,
        auditReductionRate,
        status: b.status || 'DisposalPending',
        completionDate: b.actualEndDate || b.plannedEndDate || '',
        hasCadData: true,
        fundSource: (b.fundSource as any) || 'Fiscal',
        location: b.location || '',
        plannedArea: b.plannedArea,
        floorCount: b.floorCount,
        roomCount: b.roomCount,
        plannedStartDate: b.plannedStartDate || '',
        plannedEndDate: b.plannedEndDate || '',
        actualStartDate: b.actualStartDate,
        actualEndDate: b.actualEndDate,
        projectManager: b.projectManager || '',
        supervisor: b.supervisor || '',
        milestones: [],
        attachments: [],
        splitItems: [],
        roomFunctionPlan: [],
        isOverdue: false,
        isArchived: b.status === 'Archived',
        source: 'stock',
      }

      if (existingIdx === -1) {
        db.list.push(projectData)
        changed = true
      } else {
        // 保留业务字段
        const old = db.list[existingIdx]
        const mergedStatus = old.status || projectData.status
        const mergedProject: Project = {
          ...old,
          ...projectData,
          status: mergedStatus,
          isArchived: mergedStatus === 'Archived',
          milestones: old.milestones || [],
          attachments: old.attachments || [],
          splitItems: old.splitItems || [],
          roomFunctionPlan: old.roomFunctionPlan || [],
          roomFunctionPlanConfirmed: old.roomFunctionPlanConfirmed,
          gaojibiaoData: old.gaojibiaoData
        }
        if (JSON.stringify(mergedProject) !== JSON.stringify(old)) {
          db.list[existingIdx] = mergedProject
          changed = true
        }
      }
    }

    // 2) 同步房间 -> 房间功能计划 (roomFunctionPlan)
    for (const proj of db.list) {
      if (proj.source === 'stock') {
        const buildingNo = proj.id.replace('STOCK-BLD-', '')
        const cleanCode = `BLD-${buildingNo}`
        const bRooms = bDb.rooms.filter(r => r.buildingCode === cleanCode)

        // 如果没有计划列表，或者需要强制刷新 (演示需求)
        if (bRooms.length > 0 && (!proj.roomFunctionPlan || proj.roomFunctionPlan.length === 0)) {
          proj.roomFunctionPlan = bRooms.map(r => ({
            id: `PLAN-${r.id}`,
            buildingName: r.buildingName,
            roomNo: r.roomNo,
            area: r.area || 0,
            mainCategory: r.mainCategory || '',
            subCategory: r.subCategory || ''
          }))
          proj.roomCount = bRooms.length
          changed = true
        }
      }
    }

    // 3) 清理多余/错误的 ID (如旧的 STOCK-BLD-BLD-*)
    const bCodes = new Set(bDb.buildings.map(b => b.code))
    const validIds = new Set(bDb.buildings.map(b => `STOCK-BLD-${b.code.split('-')[1]}`))
    
    const initialLen = db.list.length
    db.list = db.list.filter(p => {
      if (p.id.startsWith('STOCK-BLD-')) {
        return validIds.has(p.id)
      }
      return true
    })
    if (db.list.length !== initialLen) changed = true

    if (changed) {
      await fs.writeFile(dbFile, JSON.stringify(db, null, 2), 'utf-8')
    }
  } catch (e) {
    console.error('Sync fixation audit from buildings failed:', e)
  }

  return db
}

export async function writeAuditDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(await getDbFilePath(), JSON.stringify(next, null, 2), 'utf-8')
}

export async function listProjects(): Promise<Project[]> {
  const db = await readAuditDb()
  return db.list
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const db = await readAuditDb()
  const idx = db.list.findIndex(p => p.id === id)
  if (idx === -1) return null
  db.list[idx] = { ...db.list[idx], ...updates }
  await writeAuditDb(db)
  return db.list[idx]
}

export async function addAttachment(projectId: string, attachment: Attachment): Promise<Project | null> {
  const db = await readAuditDb()
  const idx = db.list.findIndex(p => p.id === projectId)
  if (idx === -1) return null
  db.list[idx].attachments.push(attachment)
  await writeAuditDb(db)
  return db.list[idx]
}

export async function updateAttachment(projectId: string, attId: string, updates: Partial<Attachment>): Promise<Project | null> {
  const db = await readAuditDb()
  const p = db.list.find(p => p.id === projectId)
  if (!p) return null
  const idx = p.attachments.findIndex(a => a.id === attId)
  if (idx === -1) return null
  p.attachments[idx] = { ...p.attachments[idx], ...updates }
  await writeAuditDb(db)
  return p
}

export async function deleteAttachment(projectId: string, attId: string): Promise<Project | null> {
  const db = await readAuditDb()
  const p = db.list.find(p => p.id === projectId)
  if (!p) return null
  p.attachments = p.attachments.filter(a => a.id !== attId)
  await writeAuditDb(db)
  return p
}

export async function addSplitItem(projectId: string, item: AssetSplitItem): Promise<Project | null> {
  const db = await readAuditDb()
  const p = db.list.find(p => p.id === projectId)
  if (!p) return null
  p.splitItems.push(item)
  await writeAuditDb(db)
  return p
}

export async function deleteSplitItem(projectId: string, itemId: string): Promise<Project | null> {
  const db = await readAuditDb()
  const p = db.list.find(p => p.id === projectId)
  if (!p) return null
  p.splitItems = p.splitItems.filter(i => i.id !== itemId)
  await writeAuditDb(db)
  return p
}
