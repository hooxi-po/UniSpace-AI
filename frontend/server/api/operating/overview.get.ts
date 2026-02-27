import { ofetch } from 'ofetch'
import { getBackendBaseUrl, toProxyError } from '~/server/utils/backend-proxy'
import { readOperatingDB, writeOperatingDB } from '~/server/utils/operating-db'

const FLOOR_MAP: Record<string, string> = {
  '1': '一',
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
  '10': '十',
  '11': '十一',
  '12': '十二',
  '13': '十三',
  '14': '十四',
  '15': '十五',
}

const PURPOSES = ['商铺', '办公室', '培训中心', '实验场地'] as const

function toFloorLabel(roomNo: string) {
  const normalized = String(roomNo || '').trim()
  if (!normalized) return '一'
  const floorNumStr = normalized.length === 3 ? normalized.slice(0, 1) : normalized.slice(0, 2)
  return FLOOR_MAP[floorNumStr] || '一'
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toPeriod(date: Date) {
  return date.toISOString().slice(0, 7)
}

function shiftMonth(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1)
}

function buildDemoDataset(rooms: Array<Record<string, any>>) {
  const sortedRooms = [...rooms]
    .sort((a, b) => {
      const fa = Number(a.floor || 0)
      const fb = Number(b.floor || 0)
      if (fa !== fb) return fa - fb
      return String(a.room_no || '').localeCompare(String(b.room_no || ''), 'zh-CN')
    })
    .slice(0, 120)

  const spaces = sortedRooms.map((r, i) => {
    const area = Number(r.area || 0)
    const status = i < 60
      ? '已出租'
      : i < 100
        ? '公开招租'
        : i < 110
          ? '维修中'
          : '招租结束'

    const purpose = PURPOSES[i % PURPOSES.length]
    const monthlyRent = Math.round(area * (purpose === '商铺' ? 120 : purpose === '办公室' ? 90 : purpose === '培训中心' ? 75 : 65))

    const space = {
      id: String(r.id || ''),
      name: `${String(r.master_building_name || r.building_name || '')}${String(r.room_no || '')}`,
      buildingName: String(r.master_building_name || r.building_name || ''),
      roomNumber: String(r.room_no || ''),
      floor: toFloorLabel(String(r.room_no || '')),
      purpose,
      area,
      status,
      monthlyRent,
      bids: [] as any[],
      description: `${String(r.master_building_name || r.building_name || '')}${String(r.room_no || '')}· ${purpose}`,
    }

    if (status === '公开招租') {
      const bidCount = i % 4
      if (bidCount > 0) {
        const winnerAmount = monthlyRent + 500 + (i % 6) * 200
        const bids = [] as any[]
        for (let j = 0; j < bidCount; j += 1) {
          bids.push({
            id: `BID-${space.id}-${j + 1}`,
            spaceId: space.id,
            company: `投标企业${String(i + j + 1).padStart(3, '0')}`,
            contactPerson: `联系人${String((i + j) % 30 + 1).padStart(2, '0')}`,
            contactPhone: `1380000${String(1000 + i * 3 + j).slice(-4)}`,
            amount: winnerAmount - j * 300,
            bidDate: toDateStr(new Date(Date.now() - (j + 1) * 86400000)),
            status: j === 0 ? 'Winner' : 'Valid',
          })
        }
        space.bids = bids
      }
    }

    return space
  })

  const rentedSpaces = spaces.filter((s) => s.status === '已出租')
  const contracts = rentedSpaces.map((s, i) => {
    const start = new Date(2024, i % 12, 1)
    const end = new Date(2025 + (i % 2), (i + 6) % 12, 28)
    return {
      id: `CT-OPT-${s.id}`,
      contractNo: `HT-CXCY-${String(i + 1).padStart(3, '0')}`,
      spaceId: s.id,
      spaceName: s.name,
      tenant: `入驻企业_${String(i + 1).padStart(3, '0')}有限公司`,
      rentPerMonth: s.monthlyRent,
      startDate: toDateStr(start),
      endDate: toDateStr(end),
      status: i < 40 ? 'Active' : 'Expiring',
      totalRentReceived: 0,
      outstandingRent: 0,
    }
  })

  const now = new Date()
  const currentPeriod = toPeriod(now)
  const prevPeriod = toPeriod(shiftMonth(now, -1))

  const rentBills: any[] = []

  contracts.forEach((c, i) => {
    const base = c.rentPerMonth
    const currentStatusCycle = i % 4

    let currentStatus: 'Paid' | 'PartialPaid' | 'Unpaid' | 'Overdue' = 'Paid'
    if (currentStatusCycle === 1) currentStatus = 'PartialPaid'
    else if (currentStatusCycle === 2) currentStatus = 'Unpaid'
    else if (currentStatusCycle === 3) currentStatus = 'Overdue'

    const currentLateFee = currentStatus === 'Overdue' ? 300 : 0
    const currentTotal = base + currentLateFee
    const currentPaidAmount = currentStatus === 'Paid'
      ? currentTotal
      : currentStatus === 'PartialPaid'
        ? Math.round(currentTotal * 0.45)
        : 0

    const currentBill = {
      id: `RB-OPT-${c.id}-${currentPeriod}`,
      contractId: c.id,
      spaceName: c.spaceName,
      tenant: c.tenant,
      period: currentPeriod,
      rentAmount: base,
      lateFee: currentLateFee,
      totalAmount: currentTotal,
      status: currentStatus,
      paidAmount: currentPaidAmount,
      reminderCount: currentStatus === 'Overdue' ? 2 : currentStatus === 'Unpaid' ? 1 : 0,
      lastReminderDate: currentStatus === 'Overdue' || currentStatus === 'Unpaid' ? toDateStr(new Date()) : undefined,
      paidDate: currentStatus === 'Paid' || currentStatus === 'PartialPaid' ? toDateStr(new Date()) : undefined,
      paymentMethod: currentStatus === 'Paid' || currentStatus === 'PartialPaid' ? (i % 2 === 0 ? '对公转账' : '线上支付') : undefined,
      transactionNo: currentStatus === 'Paid' || currentStatus === 'PartialPaid' ? `TRX-${Date.now()}-${i}` : undefined,
    }

    const prevBill = {
      id: `RB-OPT-${c.id}-${prevPeriod}`,
      contractId: c.id,
      spaceName: c.spaceName,
      tenant: c.tenant,
      period: prevPeriod,
      rentAmount: base,
      lateFee: 0,
      totalAmount: base,
      status: 'Paid',
      paidAmount: base,
      reminderCount: 0,
      paidDate: toDateStr(shiftMonth(new Date(), -1)),
      paymentMethod: i % 2 === 0 ? '对公转账' : '线上支付',
      transactionNo: `TRX-PREV-${i}`,
    }

    rentBills.push(currentBill, prevBill)

    const contractTotal = currentBill.totalAmount + prevBill.totalAmount
    const contractPaid = currentBill.paidAmount + prevBill.paidAmount
    c.totalRentReceived = contractPaid
    c.outstandingRent = Math.max(0, contractTotal - contractPaid)
  })

  return { spaces, contracts, rentBills }
}

function normalizePersistedOperatingData(db: any) {
  if (!db || typeof db !== 'object') return null

  const spaces = Array.isArray(db.spaces) ? db.spaces : []
  const contracts = Array.isArray(db.contracts) ? db.contracts : []
  const rentBills = Array.isArray(db.rentBills) ? db.rentBills : []

  // Only initialize demo data when storage is effectively empty.
  const hasPersistedData = spaces.length > 0 || contracts.length > 0 || rentBills.length > 0
  if (!hasPersistedData) return null

  return { spaces, contracts, rentBills }
}

export default defineEventHandler(async (event) => {
  try {
    let db: any = null
    try {
      db = await readOperatingDB()
    } catch {
      db = null
    }

    const existingData = normalizePersistedOperatingData(db)
    if (existingData) {
      return {
        source: 'backend-demo',
        spaces: existingData.spaces,
        contracts: existingData.contracts,
        rentBills: existingData.rentBills,
      }
    }

    const backendBaseUrl = getBackendBaseUrl()
    const roomsResp = await ofetch<{ source: string; rooms: Array<Record<string, any>> }>(
      `${backendBaseUrl}/api/v1/property/rooms`,
      {
        query: {
          limit: 5000,
          offset: 0,
        },
      }
    )

    const innovationRooms = (roomsResp.rooms || []).filter((r) => {
      const name = String(r.master_building_name || r.building_name || '')
      return name.includes('创新创业中心')
    })

    const initialized = buildDemoDataset(innovationRooms)
    try {
      await writeOperatingDB(initialized as any)
    } catch {
      // ignore persistence failures in dev mode
    }
    db = initialized

    return {
      source: 'backend-demo',
      spaces: Array.isArray(db?.spaces) ? db.spaces : [],
      contracts: Array.isArray(db?.contracts) ? db.contracts : [],
      rentBills: Array.isArray(db?.rentBills) ? db.rentBills : [],
    }
  } catch (error) {
    throw toProxyError(event, error)
  }
})
