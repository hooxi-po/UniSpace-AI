import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type SpaceStatus = '公开招租' | '招租结束' | '已出租' | '维修中'
export type ContractStatus = 'Active' | 'Expiring' | 'Expired' | 'Terminated'
export type BillStatus = 'Unpaid' | 'PartialPaid' | 'Paid' | 'Overdue'

export interface OperatingBidItem {
  id: string
  spaceId: string
  company: string
  contactPerson: string
  contactPhone?: string
  amount: number
  bidDate: string
  status: 'Valid' | 'Winner'
}

export interface OperatingSpaceItem {
  id: string
  name: string
  area: number
  status: SpaceStatus
  monthlyRent?: number
  bids?: OperatingBidItem[]
}

export interface OperatingContractItem {
  id: string
  contractNo: string
  spaceId: string
  spaceName: string
  tenant: string
  rentPerMonth: number
  startDate: string
  endDate: string
  status: ContractStatus
}

export interface OperatingRentBill {
  id: string
  contractId: string
  spaceName: string
  tenant: string
  period: string
  rentAmount: number
  lateFee: number
  totalAmount: number
  status: BillStatus
  paidAmount: number
  reminderCount: number
  lastReminderDate?: string
  paidDate?: string
  paymentMethod?: string
  transactionNo?: string
}

export interface OperatingDB {
  spaces: OperatingSpaceItem[]
  contracts: OperatingContractItem[]
  rentBills: OperatingRentBill[]
}

const DB_PATH = resolve(process.cwd(), 'frontend/server/data/operating.json')

export async function readOperatingDB(): Promise<OperatingDB> {
  const raw = await readFile(DB_PATH, 'utf-8')
  return JSON.parse(raw) as OperatingDB
}

export async function writeOperatingDB(db: OperatingDB) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

export async function getSpaces() {
  const db = await readOperatingDB()
  return db.spaces
}

export async function writeSpaces(spaces: OperatingSpaceItem[]) {
  const db = await readOperatingDB()
  db.spaces = spaces
  await writeOperatingDB(db)
}
