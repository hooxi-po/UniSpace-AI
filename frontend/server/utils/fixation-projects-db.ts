import { promises as fs } from 'node:fs'
import path from 'node:path'

type FundSource = 'Fiscal' | 'SelfRaised' | 'Mixed'
type AssetStatus = 'DisposalPending'
type ProjectMilestone = 'Approval'

type Attachment = {
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
  reviewStatus: 'Pending'
}

type RoomPlanItem = {
  id: string
  buildingName: string
  roomNo: string
  area: number
  mainCategory: string
  subCategory: string
}

type AssetCategory = 'Building' | 'Land' | 'Structure' | 'Equipment' | 'Greening' | 'Other'

type AssetSplitItem = {
  id: string
  category: AssetCategory
  name: string
  amount: number
  area?: number
  quantity?: number
  depreciationYears: number
  depreciationMethod: 'StraightLine' | 'Accelerated'
}

export type FixationProject = {
  id: string
  name: string
  contractor: string
  contractAmount: number
  auditAmount?: number
  auditReductionRate?: number
  status: AssetStatus
  completionDate: string
  hasCadData: boolean
  fundSource: FundSource
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
  isOverdue: boolean
  isArchived: boolean
}

type DbShape = { list: FixationProject[] }

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'fixation-projects.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = { list: [] }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readProjectsDb(): Promise<DbShape> {
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

export async function writeProjectsDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listFixationProjects(): Promise<FixationProject[]> {
  const db = await readProjectsDb()
  return db.list
}

export async function addProject(project: FixationProject): Promise<FixationProject> {
  const db = await readProjectsDb()
  db.list.unshift(project)
  await writeProjectsDb(db)
  return project
}
