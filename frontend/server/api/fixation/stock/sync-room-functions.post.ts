import type { RoomPlanItem } from '~/server/utils/fixation-audit-db'
import { readStockDb, writeStockDb } from '~/server/utils/fixation-stock-db'
import { addFixationLog } from '~/server/utils/fixation-logs-db'

type Body = {
  projectId?: string
  plan?: RoomPlanItem[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const plan = Array.isArray(body.plan) ? body.plan : []

  const db = await readStockDb()

  const planIndex = new Map<string, RoomPlanItem>()
  for (const p of plan) {
    const key = `${p.buildingName}::${p.roomNo}`
    planIndex.set(key, p)
  }

  const seenKeys = new Set<string>()
  let updatedCount = 0

  // 1) 更新已有房间
  db.rooms = db.rooms.map((r) => {
    const key = `${r.buildingName}::${r.roomNo}`
    const hit = planIndex.get(key)
    if (!hit) return r
    seenKeys.add(key)
    updatedCount++
    return {
      ...r,
      area: hit.area || r.area,
      functionMain: hit.mainCategory || undefined,
      functionSub: hit.subCategory || undefined,
      sourceProjectId: body.projectId || r.sourceProjectId,
    }
  })

  // 2) 如果计划中有房间在台账里不存在，则新增
  let addedCount = 0
  for (const p of plan) {
    const key = `${p.buildingName}::${p.roomNo}`
    if (!seenKeys.has(key)) {
      // 尝试从 roomNo 解析 floor
      let floor = 1
      const m = p.roomNo.match(/^(\d+)[-－]/)
      if (m) floor = parseInt(m[1])

      db.rooms.unshift({
        id: `RM-SYNC-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        buildingName: p.buildingName,
        roomNo: p.roomNo,
        floor: floor,
        area: p.area || 0,
        type: 'Admin', // 默认类型
        status: 'Empty',
        department: '',
        sourceProjectId: body.projectId,
        functionMain: p.mainCategory || undefined,
        functionSub: p.subCategory || undefined,
      })
      addedCount++
    }
  }

  await writeStockDb(db)

  await addFixationLog({
    id: `LOG-STOCK-SYNC-${Date.now()}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'fixation',
    action: 'syncRoomFunctions',
    projectId: body.projectId,
    summary: `同步房间功能：更新 ${updatedCount}，新增 ${addedCount}`,
    detail: { projectId: body.projectId, planCount: plan.length, updatedRooms: updatedCount, addedRooms: addedCount }
  })

  return { updatedRooms: updatedCount, addedRooms: addedCount }
})


