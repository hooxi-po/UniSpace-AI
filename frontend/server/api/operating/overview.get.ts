import { listRooms } from '~/server/utils/buildings-db'
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

function ensureRentBillDefaults(b: any) {
  return {
    reminderCount: 0,
    paidAmount: 0,
    lateFee: 0,
    ...b,
  }
}

export default defineEventHandler(async () => {
  // 优先读取持久化 DB，避免“派生数据”覆盖用户新增/编辑内容
  try {
    const db = await readOperatingDB()
    if (Array.isArray(db.spaces) && Array.isArray(db.contracts) && Array.isArray(db.rentBills)) {
      let changed = false
      const rentBills = db.rentBills.map((b: any) => {
        const next = ensureRentBillDefaults(b)
        if (next.reminderCount !== b.reminderCount) changed = true
        if (next.paidAmount !== b.paidAmount) changed = true
        if (next.lateFee !== b.lateFee) changed = true
        return next
      })

      if (changed) {
        db.rentBills = rentBills
        await writeOperatingDB(db)
      }

      return {
        source: 'mock',
        spaces: db.spaces,
        contracts: db.contracts,
        rentBills: rentBills,
      }
    }
  } catch {
    // ignore and fallback to derived
  }

  // fallback：首次启动/无 DB 时派生数据，并写入 operating.json
  const allRooms = await listRooms({ buildingCode: 'BLD-004', type: 'Commercial' })

  const spaces = allRooms.map((r: any) => {
    const roomNo = String(r.roomNo || '')
    const floorNumStr = roomNo.length === 3 ? roomNo.slice(0, 1) : roomNo.slice(0, 2)
    const floor = FLOOR_MAP[floorNumStr] || '一'

    return {
      id: r.id,
      name: `${r.buildingName}${r.roomNo}`,
      buildingName: r.buildingName,
      roomNumber: r.roomNo,
      floor,
      purpose: '办公室',
      area: Number(r.area || 0),
      status: '公开招租',
      monthlyRent: Number(r.area || 0) * 80,
      bids: [],
      description: '',
    }
  })

  const rentedCount = 60
  const rentedRooms = allRooms.slice(0, rentedCount)
  const currentMonth = new Date().toISOString().slice(0, 7)

  const contracts = rentedRooms.map((r: any, i: number) => ({
    id: `CT-OPT-${r.id}`,
    contractNo: `HT-2024-${String(i + 1).padStart(3, '0')}`,
    spaceId: r.id,
    spaceName: `${r.buildingName} ${r.roomNo}`,
    tenant: `入驻企业_${String(i + 1).padStart(2, '0')}有限公司`,
    rentPerMonth: Number(r.area || 0) * 80,
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    status: 'Active',
  }))

  contracts.forEach((c: any) => {
    const space = spaces.find((s: any) => s.id === c.spaceId)
    if (space) space.status = '已出租'
  })

  const rentBills = contracts.map((c: any, i: number) => {
    const isPaid = i % 3 !== 0
    return ensureRentBillDefaults({
      id: `RB-OPT-${c.id}-${currentMonth}`,
      contractId: c.id,
      spaceName: c.spaceName,
      tenant: c.tenant,
      period: currentMonth,
      rentAmount: c.rentPerMonth,
      lateFee: isPaid ? 0 : 200,
      totalAmount: c.rentPerMonth + (isPaid ? 0 : 200),
      status: isPaid ? 'Paid' : 'Overdue',
      paidAmount: isPaid ? c.rentPerMonth : 0,
      reminderCount: 0,
    })
  })

  await writeOperatingDB({ spaces, contracts, rentBills } as any)

  return {
    source: 'mock-derived',
    spaces,
    contracts,
    rentBills,
  }
})
