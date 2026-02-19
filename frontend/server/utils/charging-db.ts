import { promises as fs } from 'node:fs'
import path from 'node:path'

import { listPersons, type PersonTitle } from './persons-db'
import { listRoomAllocations } from './room-allocations-db'
import { listRooms } from './fixation-stock-db'

export type FeeStatus = 
  | 'Verifying' 
  | 'BillGenerated' 
  | 'PendingConfirm' 
  | 'Disputed' 
  | 'FinanceProcessing' 
  | 'Completed'

export type PersonUsage = {
  id: string
  personId: string
  personName: string
  departmentName: string
  title: PersonTitle
  actualArea: number
  basePrice: number
}

export type PersonFeeBill = {
  id: string
  personId: string
  personName: string
  departmentName: string
  year: number
  month: string
  quotaArea: number
  actualArea: number
  excessArea: number
  basePrice: number
  tierMultiplier: number
  baseCost: number
  tierCost: number
  amount: number
  status: FeeStatus
  generatedAt: string
  paidAt?: string
}

export type PersonPayment = {
  id: string
  billId: string
  personName: string
  amount: number
  paymentMethod: 'Alipay' | 'WeChat' | 'Card' | 'SalaryDeduction'
  paymentDate: string
  status: 'Confirmed'
}

export type ExtendedDepartmentFee = {
  id: string
  departmentName: string
  year: number
  month: string
  quotaArea: number
  actualArea: number
  excessArea: number
  excessPercent: number
  basePrice: number
  tierMultiplier: number
  baseCost: number
  tierCost: number
  totalCost: number
  excessCost: number
  paidAmount: number
  remainingAmount: number
  status: FeeStatus
  isPaid: boolean
  hasReminder: boolean
  reminderCount: number
  isBlacklisted: boolean
  lastReminderAt?: string
  confirmedAt?: string
  paidAt?: string
}

export type FeeBill = {
  id: string
  billNo: string
  year: number
  month: string
  departmentId: string
  departmentName: string
  quotaArea: number
  actualArea: number
  excessArea: number
  basePrice: number
  tierMultiplier: number
  calculatedAmount: number
  status: FeeStatus
  generatedAt: string
  operator: string
  confirmedAt?: string
  items: { code: string; name: string; amount: number; unit: string }[]
}

export type PaymentRecord = {
  id: string
  billId: string
  billNo: string
  departmentName: string
  amount: number
  paymentMethod: 'BankTransfer' | 'FinanceDeduction' | 'Other'
  paymentDate: string
  transactionNo?: string
  operator: string
  status: 'Pending' | 'Confirmed' | 'Rejected'
  confirmedBy?: string
  confirmedAt?: string
  voucherUrl?: string
}

export type ReminderRecord = {
  id: string
  billId: string
  billNo: string
  departmentName: string
  reminderType: 'System' | 'OA' | 'SMS' | 'Email'
  content: string
  sentAt: string
  sentBy: string
  isRead: boolean
  readAt?: string
}

export type DbShape = {
  fees: ExtendedDepartmentFee[]
  bills: FeeBill[]
  payments: PaymentRecord[]
  reminders: ReminderRecord[]
  personUsages: PersonUsage[]
  personBills: PersonFeeBill[]
  personPayments: PersonPayment[]
}

// --- 规则引擎配置 (Rule Engine Config) ---
const QUOTA_RULES: Record<PersonTitle, number> = {
  Assistant: 12,
  Lecturer: 18,
  AssociateProfessor: 25,
  Professor: 30,
  Other: 12
}

const BASE_PRICE = 120 // 元/m²/年

function getTierMultiplier(excessPercent: number): number {
  if (excessPercent <= 0) return 1.0
  if (excessPercent <= 10) return 1.0
  if (excessPercent <= 30) return 1.5
  if (excessPercent <= 50) return 2.0
  return 3.0 // 熔断费率
}

// --- 核心业务逻辑 (Business Logic) ---

/**
 * 核心逻辑：获取指定月份的个人用房明细汇总 (PersonUsage)
 * 口径：month 内有交集即计入
 */
export async function listPersonUsagesByMonth(month: string): Promise<PersonUsage[]> {
  const persons = await listPersons()
  const allocations = await listRoomAllocations()
  const rooms = await listRooms()

  const [yearNum, monthNum] = month.split('-').map(Number)
  const monthStart = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0]
  const monthEnd = new Date(yearNum, monthNum, 0).toISOString().split('T')[0]

  // 1. 过滤出当月有效的占用关系
  const activeAllocations = allocations.filter(a => {
    const isStarted = a.startDate <= monthEnd
    const isNotEnded = !a.endDate || a.endDate >= monthStart
    return isStarted && isNotEnded
  })

  // 2. 按房间分组计算分摊
  const roomGroups: Record<string, typeof activeAllocations> = {}
  activeAllocations.forEach(a => {
    if (!roomGroups[a.roomId]) roomGroups[a.roomId] = []
    roomGroups[a.roomId].push(a)
  })

  // 3. 计算每个人在该月的实际总面积
  const personAreaMap: Record<string, number> = {}
  
  for (const roomId in roomGroups) {
    const roomAllocations = roomGroups[roomId]
    const roomInfo = rooms.find(r => r.id === roomId)
    if (!roomInfo) continue

    const totalArea = roomInfo.area
    
    // 如果有 shareArea 则用 shareArea，否则平均分摊
    const totalSpecificShare = roomAllocations.reduce((acc, a) => acc + (a.shareArea || 0), 0)
    const pendingPersons = roomAllocations.filter(a => !a.shareArea)
    const remainingArea = Math.max(0, totalArea - totalSpecificShare)
    const averageShare = pendingPersons.length > 0 ? remainingArea / pendingPersons.length : 0

    roomAllocations.forEach(a => {
      const share = a.shareArea || averageShare
      personAreaMap[a.personId] = (personAreaMap[a.personId] || 0) + share
    })
  }

  // 4. 映射为 PersonUsage 对象
  return persons.map(p => {
    const actualArea = Math.round((personAreaMap[p.personId] || 0) * 100) / 100
    return {
      id: `PU-${p.personId}-${month}`,
      personId: p.personId,
      personName: p.personName,
      departmentName: p.departmentName,
      title: p.title,
      actualArea,
      basePrice: BASE_PRICE
    }
  })
}

/**
 * 核心逻辑：按月生成个人账单
 */
export async function generatePersonBillsByMonth(month: string): Promise<PersonFeeBill[]> {
  const usages = await listPersonUsagesByMonth(month)
  const [yearNum] = month.split('-').map(Number)
  const now = new Date().toISOString()

  const newBills: PersonFeeBill[] = usages.map(u => {
    const quotaArea = QUOTA_RULES[u.title] || 12
    const excessArea = Math.max(0, u.actualArea - quotaArea)
    const excessPercent = quotaArea > 0 ? (excessArea / quotaArea) * 100 : 0
    const tierMultiplier = getTierMultiplier(excessPercent)

    const baseCost = Math.round(excessArea * u.basePrice / 12) // 按月计费：(超额 * 年单价) / 12
    const tierCost = Math.round(baseCost * (tierMultiplier - 1))
    const totalAmount = baseCost + tierCost

    return {
      id: `PBILL-${u.personId}-${month}`,
      personId: u.personId,
      personName: u.personName,
      departmentName: u.departmentName,
      year: yearNum,
      month,
      quotaArea,
      actualArea: u.actualArea,
      excessArea: Math.round(excessArea * 100) / 100,
      basePrice: u.basePrice,
      tierMultiplier,
      baseCost,
      tierCost,
      amount: totalAmount,
      status: 'BillGenerated' as FeeStatus,
      generatedAt: now
    }
  }).filter(b => b.amount > 0) // 只对有费用的生成账单

  // 写入数据库（覆盖同月）
  const db = await readChargingDb()
  db.personBills = [
    ...db.personBills.filter((b: PersonFeeBill) => b.month !== month),
    ...newBills
  ]
  await writeChargingDb(db)

  return newBills
}

export async function listPersonBillsByYear(year: number): Promise<PersonFeeBill[]> {
  const db = await readChargingDb()
  return db.personBills.filter((b: PersonFeeBill) => b.year === year)
}

export async function addPersonPayment(payment: PersonPayment): Promise<PersonPayment> {
  const db = await readChargingDb()
  
  // 1. 记录缴费
  db.personPayments.unshift(payment)
  
  // 2. 更新账单状态
  const billIdx = db.personBills.findIndex((b: PersonFeeBill) => b.id === payment.billId)
  if (billIdx !== -1) {
    db.personBills[billIdx].status = 'Completed'
    db.personBills[billIdx].paidAt = payment.paymentDate
  }
  
  await writeChargingDb(db)
  return payment
}

// --- 现有的数据库 IO 逻辑 (Existing DB IO Logic) ---

const DB_FILE = path.resolve(process.cwd(), 'server', 'data', 'charging.json')

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    const init: DbShape = {
      fees: [
        {
          id: 'FEE-DEPT-001',
          departmentName: '机械工程学院',
          year: 2025,
          month: '2025-01',
          quotaArea: 1200,
          actualArea: 1450,
          excessArea: 250,
          excessPercent: 20.8,
          basePrice: 120,
          tierMultiplier: 1.5,
          baseCost: 30000,
          tierCost: 15000,
          totalCost: 45000,
          excessCost: 45000,
          paidAmount: 0,
          remainingAmount: 45000,
          status: 'PendingConfirm',
          isPaid: false,
          hasReminder: false,
          reminderCount: 0,
          isBlacklisted: false
        },
        {
          id: 'FEE-DEPT-002',
          departmentName: '计算机学院',
          year: 2025,
          month: '2025-01',
          quotaArea: 1500,
          actualArea: 1600,
          excessArea: 100,
          excessPercent: 6.7,
          basePrice: 120,
          tierMultiplier: 1.0,
          baseCost: 12000,
          tierCost: 0,
          totalCost: 12000,
          excessCost: 12000,
          paidAmount: 12000,
          remainingAmount: 0,
          status: 'Completed',
          isPaid: true,
          hasReminder: false,
          reminderCount: 0,
          isBlacklisted: false,
          paidAt: '2025-02-01'
        }
      ],
      bills: [],
      payments: [],
      reminders: [],
      personUsages: [],
      personBills: [],
      personPayments: []
    }
    await fs.writeFile(DB_FILE, JSON.stringify(init, null, 2), 'utf-8')
  }
}

export async function readChargingDb(): Promise<DbShape> {
  await ensureDbFile()
  const raw = await fs.readFile(DB_FILE, 'utf-8')
  try {
    return JSON.parse(raw) as DbShape
  } catch {
    return { 
      fees: [], 
      bills: [], 
      payments: [], 
      reminders: [],
      personUsages: [],
      personBills: [],
      personPayments: []
    }
  }
}

export async function writeChargingDb(next: DbShape) {
  await ensureDbFile()
  await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2), 'utf-8')
}

export async function listDepartmentFees(): Promise<ExtendedDepartmentFee[]> {
  const db = await readChargingDb()
  return db.fees
}

export async function updateDepartmentFee(id: string, updates: Partial<ExtendedDepartmentFee>): Promise<ExtendedDepartmentFee | null> {
  const db = await readChargingDb()
  const idx = db.fees.findIndex((f: ExtendedDepartmentFee) => f.id === id)
  if (idx === -1) return null
  db.fees[idx] = { ...db.fees[idx], ...updates }
  await writeChargingDb(db)
  return db.fees[idx]
}

export async function addReminder(reminder: ReminderRecord): Promise<ReminderRecord> {
  const db = await readChargingDb()
  db.reminders.unshift(reminder)
  await writeChargingDb(db)
  return reminder
}

export async function listReminders(): Promise<ReminderRecord[]> {
  const db = await readChargingDb()
  return db.reminders
}
