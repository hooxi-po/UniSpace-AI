import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { withFileLock, writeJsonAtomic } from './file-db'

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

const DB_PATH_CANDIDATES = [
  resolve(process.cwd(), 'server/data/operating.json'),
  resolve(process.cwd(), 'frontend/server/data/operating.json'),
]
let cachedDBPath: string | null = null

async function getDBPath() {
  if (cachedDBPath) return cachedDBPath

  for (const path of DB_PATH_CANDIDATES) {
    try {
      await access(path)
      cachedDBPath = path
      return path
    } catch {
      // continue
    }
  }

  cachedDBPath = DB_PATH_CANDIDATES[0]
  return cachedDBPath
}

export async function readOperatingDB(): Promise<OperatingDB> {
  const raw = await readFile(await getDBPath(), 'utf-8')
  return JSON.parse(raw) as OperatingDB
}

export async function writeOperatingDB(db: OperatingDB) {
  const dbPath = await getDBPath()
  await withFileLock(dbPath, async () => {
    await writeJsonAtomic(dbPath, db)
  })
}

export async function getSpaces() {
  const db = await readOperatingDB()
  return db.spaces
}

export async function writeSpaces(spaces: OperatingSpaceItem[]) {
  const dbPath = await getDBPath()
  await withFileLock(dbPath, async () => {
    const db = await readOperatingDB()
    db.spaces = spaces
    await writeJsonAtomic(dbPath, db)
  })
}
