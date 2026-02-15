import { listFixationProjects as listNewProjects, readProjectsDb, writeProjectsDb } from '~/server/utils/fixation-projects-db'
import type {
  AssetSplitItem,
  Attachment,
  Project as NewProject,
} from '~/server/utils/fixation-audit-db'
import {
  readStockDb,
  writeStockDb,
  type Building,
  type Room,
} from '~/server/utils/fixation-stock-db'

export type ApplyStatus = 'DisposalPending' | 'PendingReview' | 'PendingArchive' | 'Archived'

export type ApplyProject = {
  id: string
  source: 'project' | 'stock'
  sourceRefId: string

  name: string
  contractor: string
  contractAmount: number
  auditAmount?: number
  auditReductionRate?: number
  status: ApplyStatus
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

  attachments: Attachment[]
  splitItems: AssetSplitItem[]

  roomFunctionPlan: any[]
  isOverdue: boolean
  isArchived: boolean

  stockMeta?: {
    buildingCode: string
    roomsCount: number
    roomsTotalArea: number
    buildingValue: number
  }
}

function todayYMD() {
  return new Date().toISOString().split('T')[0]
}

function computeReduction(contractAmount: number, auditAmount?: number) {
  if (auditAmount === undefined || !contractAmount) return undefined
  const rate = ((contractAmount - auditAmount) / contractAmount) * 100
  if (!Number.isFinite(rate)) return undefined
  return Number(rate.toFixed(2))
}

function ensureStockBuildingExt(b: any) {
  if (!Array.isArray(b.attachments)) b.attachments = []
  if (!Array.isArray(b.splitItems)) b.splitItems = []
  if (!b.status) b.status = 'DisposalPending'
}

export async function listApplyProjects(): Promise<ApplyProject[]> {
  const [newProjects, stockDb] = await Promise.all([listNewProjects(), readStockDb()])
  const stockBuildings = stockDb.buildings
  const stockRooms = stockDb.rooms

  const byBuildingCode = new Map<string, Room[]>()
  for (const r of stockRooms) {
    const code = String(r.buildingCode || '').trim()
    if (!code) continue
    if (!byBuildingCode.has(code)) byBuildingCode.set(code, [])
    byBuildingCode.get(code)!.push(r)
  }

  const fromProjects: ApplyProject[] = (newProjects as any[]).map((p: NewProject) => {
    const auditReductionRate = computeReduction(p.contractAmount, p.auditAmount)
    return {
      ...p,
      auditReductionRate,
      source: 'project',
      sourceRefId: p.id,
    } satisfies ApplyProject
  })

  const fromStock: ApplyProject[] = stockBuildings.map((b: any) => {
    ensureStockBuildingExt(b)
    const rooms = byBuildingCode.get(String(b.code)) || []
    const roomsTotalArea = rooms.reduce((acc, r) => acc + (Number(r.area) || 0), 0)

    const plannedArea = roomsTotalArea > 0 ? Number(roomsTotalArea.toFixed(2)) : undefined

    return {
      id: `STOCK-${b.code}`,
      source: 'stock',
      sourceRefId: String(b.code),
      name: b.name,
      contractor: '未指定',
      contractAmount: Number(b.contractAmount ?? 0),
      auditAmount: b.auditAmount !== undefined ? Number(b.auditAmount) : undefined,
      auditReductionRate: b.auditReductionRate !== undefined ? Number(b.auditReductionRate) : undefined,
      status: (b.status || 'DisposalPending') as ApplyStatus,
      completionDate: b.completionDate || todayYMD(),
      hasCadData: !!b.hasCadData,
      fundSource: 'Fiscal',
      location: b.location || '-',
      plannedArea,
      floorCount: Number.isFinite(Number(b.floorCount)) ? Number(b.floorCount) : undefined,
      roomCount: rooms.length,
      plannedStartDate: '',
      plannedEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      projectManager: '',
      supervisor: '',
      milestones: [],
      attachments: b.attachments as Attachment[],
      splitItems: b.splitItems as AssetSplitItem[],
      roomFunctionPlan: [],
      isOverdue: false,
      isArchived: false,
      stockMeta: {
        buildingCode: String(b.code),
        roomsCount: rooms.length,
        roomsTotalArea,
        buildingValue: Number(b.value || 0),
      },
    }
  })

  return [...fromProjects, ...fromStock]
}

export async function updateApplyProject(projectId: string, updates: Partial<ApplyProject>): Promise<ApplyProject | null> {
  if (projectId.startsWith('STOCK-')) {
    const code = projectId.replace(/^STOCK-/, '')
    const db = await readStockDb()
    const b: any = db.buildings.find(x => String(x.code) === String(code))
    if (!b) return null
    ensureStockBuildingExt(b)

    if (updates.status) b.status = updates.status
    if (Array.isArray((updates as any).attachments)) b.attachments = (updates as any).attachments
    if (Array.isArray((updates as any).splitItems)) b.splitItems = (updates as any).splitItems

    await writeStockDb(db)
    const list = await listApplyProjects()
    return list.find(p => p.id === projectId) || null
  }

  const db = await readProjectsDb()
  const idx = db.list.findIndex(p => p.id === projectId)
  if (idx === -1) return null

  const cur: any = db.list[idx]
  if (updates.status) cur.status = updates.status
  if (Array.isArray((updates as any).attachments)) cur.attachments = (updates as any).attachments
  if (Array.isArray((updates as any).splitItems)) cur.splitItems = (updates as any).splitItems

  db.list[idx] = cur
  await writeProjectsDb(db)

  const list = await listApplyProjects()
  return list.find(p => p.id === projectId) || null
}
