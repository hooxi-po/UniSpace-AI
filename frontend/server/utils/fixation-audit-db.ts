import { promises as fs } from 'node:fs'
import path from 'node:path'

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
}

type DbShape = { list: Project[] }

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'fixation-audit.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = {
      list: [
        // Mock 数据：来源于“新建工程项目”
        {
          id: 'PRJ-2025-001',
          name: '综合体育馆建设工程',
          contractor: '福建建工集团',
          contractAmount: 10000000,
          auditAmount: 9500000,
          auditReductionRate: 5.0,
          status: 'DisposalPending',
          completionDate: '2025-12-31',
          hasCadData: false,
          fundSource: 'Fiscal',
          location: '旗山校区东侧',
          plannedArea: 8500,
          floorCount: 6,
          roomCount: 120,
          plannedStartDate: '2025-01-01',
          plannedEndDate: '2025-12-31',
          actualStartDate: '2025-01-15',
          actualEndDate: undefined,
          projectManager: '张工',
          supervisor: '李监理',
          milestones: [
            {
              milestone: 'Approval',
              date: '2024-12-01',
              operator: '当前用户',
              notes: '项目立项',
            },
          ],
          attachments: [
            {
              id: 'ATT-001',
              name: '施工合同.pdf',
              type: 'contract',
              uploadDate: '2025-01-10',
              uploadedByDept: '二级学院',
              reviewStatus: 'Pending',
            },
            {
              id: 'ATT-002',
              name: '竣工图纸.pdf',
              type: 'drawing',
              uploadDate: '2025-01-12',
              uploadedByDept: '二级学院',
              reviewStatus: 'Approved',
              reviewedBy: '审核员A',
              reviewedAt: '2025-01-13',
            },
          ],
          splitItems: [
            {
              id: 'SPLIT-001',
              category: 'Building',
              name: '主体建筑',
              amount: 8000000,
              area: 8000,
              depreciationYears: 50,
              depreciationMethod: 'StraightLine',
            },
            {
              id: 'SPLIT-002',
              category: 'Equipment',
              name: '体育设备',
              amount: 2000000,
              quantity: 50,
              depreciationYears: 10,
              depreciationMethod: 'Accelerated',
            },
          ],
          roomFunctionPlan: [],
          isOverdue: false,
          isArchived: false,
          source: 'project',
        },
        // Mock 数据：来源于“存量房产导入”
        {
          id: 'STOCK-BLD-001',
          name: '理科实验楼A座',
          contractor: '未指定',
          contractAmount: 15000000,
          auditAmount: undefined,
          auditReductionRate: undefined,
          status: 'PendingReview',
          completionDate: '2024-06-30',
          hasCadData: true,
          fundSource: 'Fiscal',
          location: '旗山校区西侧',
          plannedArea: 12000,
          floorCount: 8,
          roomCount: 200,
          plannedStartDate: '',
          plannedEndDate: '',
          actualStartDate: '',
          actualEndDate: '',
          projectManager: '',
          supervisor: '',
          milestones: [],
          attachments: [
            {
              id: 'ATT-003',
              name: '验收报告.pdf',
              type: 'acceptance',
              uploadDate: '2024-07-01',
              uploadedByDept: '后勤处',
              reviewStatus: 'Approved',
              reviewedBy: '审核员B',
              reviewedAt: '2024-07-02',
            },
          ],
          splitItems: [
            {
              id: 'SPLIT-003',
              category: 'Building',
              name: '实验楼主体',
              amount: 12000000,
              area: 11500,
              depreciationYears: 50,
              depreciationMethod: 'StraightLine',
            },
            {
              id: 'SPLIT-004',
              category: 'Equipment',
              name: '实验设备',
              amount: 3000000,
              quantity: 100,
              depreciationYears: 8,
              depreciationMethod: 'Accelerated',
            },
          ],
          roomFunctionPlan: [],
          isOverdue: false,
          isArchived: false,
          source: 'stock',
        },
      ],
    }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readAuditDb(): Promise<DbShape> {
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

export async function writeAuditDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
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



