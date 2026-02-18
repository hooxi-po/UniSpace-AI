import { promises as fs } from 'node:fs'
import path from 'node:path'

export type AllocationStatus = 
  | 'Pending'       // 待审批
  | 'Approved'      // 已批准待配房
  | 'Rejected'      // 已驳回
  | 'Allocated'     // 已配房
  | 'Completed'     // 已完成

export type AdjustmentRequest = {
  id: string
  department: string
  applicant: string
  fromBuildingName: string
  fromRoomNo: string
  fromArea: number
  toBuildingName?: string
  toRoomNo?: string
  toArea?: number
  reason: string
  status: 'Pending' | 'Approved' | 'Allocated' | 'Completed' | 'Rejected'
  createdAt: string
  approvedAt?: string
  allocatedAt?: string
  completedAt?: string
}

export type TemporaryBorrow = {
  id: string
  buildingName: string
  roomNo: string
  ownerDept: string
  borrowerDept: string
  startDate: string
  endDate: string
  status: 'Active' | 'Expired' | 'Returned'
}

export type AllocationRequest = {
  id: string
  department: string
  applicant: string
  applicantId: string
  applicantPhone?: string
  area: number
  reason: string
  useType: 'Office' | 'Teaching' | 'Lab' | 'Student' | 'Meeting' | 'Storage' | 'Other'
  urgency: 'Normal' | 'Urgent'
  requestedDate: string
  status: AllocationStatus
  expectedDate?: string
  approvalRecords: ReadonlyArray<{
    id: string
    approverRole: string
    approverName: string
    action: 'Approve' | 'Reject' | 'Submit'
    comment?: string
    timestamp: string
  }>
  allocatedRooms?: ReadonlyArray<string> // 关联 fixation-stock 中的 room id
}

type DbShape = { 
  list: AllocationRequest[]
  adjustments: AdjustmentRequest[]
  borrows: TemporaryBorrow[]
}

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'allocation-requests.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = {
      list: [],
      adjustments: [
        {
          id: 'CHG-001',
          department: '计算机科学与技术学院',
          applicant: '张老师',
          fromBuildingName: '旗山校区-综合办公楼',
          fromRoomNo: '101',
          fromArea: 45.5,
          reason: '现办公室与实验室距离过远，申请调整至更靠近实验楼的办公室。',
          status: 'Pending',
          createdAt: '2026-02-10',
        }
      ],
      borrows: [
        {
          id: 'TB-001',
          buildingName: '旗山校区-实验教学楼A',
          roomNo: '301',
          ownerDept: '物理学院',
          borrowerDept: '机械工程学院',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          status: 'Active'
        }
      ]
    }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readAllocationDb(): Promise<DbShape> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    return {
      list: parsed.list || [],
      adjustments: parsed.adjustments || [],
      borrows: parsed.borrows || []
    }
  } catch {
    return { list: [], adjustments: [], borrows: [] }
  }
}

export async function writeAllocationDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listAllocationRequests(): Promise<AllocationRequest[]> {
  const db = await readAllocationDb()
  return db.list
}

export async function listAdjustmentRequests(): Promise<AdjustmentRequest[]> {
  const db = await readAllocationDb()
  return db.adjustments
}

export async function listTemporaryBorrows(): Promise<TemporaryBorrow[]> {
  const db = await readAllocationDb()
  return db.borrows
}

export async function addAllocationRequest(request: AllocationRequest): Promise<AllocationRequest> {
  const db = await readAllocationDb()
  db.list.unshift(request)
  await writeAllocationDb(db)
  return request
}

export async function addAdjustmentRequest(request: AdjustmentRequest): Promise<AdjustmentRequest> {
  const db = await readAllocationDb()
  db.adjustments.unshift(request)
  await writeAllocationDb(db)
  return request
}

export async function updateAllocationRequest(id: string, updates: Partial<AllocationRequest>): Promise<AllocationRequest | null> {
  const db = await readAllocationDb()
  const idx = db.list.findIndex(r => r.id === id)
  if (idx === -1) return null
  db.list[idx] = { ...db.list[idx], ...updates }
  await writeAllocationDb(db)
  return db.list[idx]
}

export async function updateAdjustmentRequest(id: string, updates: Partial<AdjustmentRequest>): Promise<AdjustmentRequest | null> {
  const db = await readAllocationDb()
  const idx = db.adjustments.findIndex(r => r.id === id)
  if (idx === -1) return null
  db.adjustments[idx] = { ...db.adjustments[idx], ...updates }
  await writeAllocationDb(db)
  return db.adjustments[idx]
}
