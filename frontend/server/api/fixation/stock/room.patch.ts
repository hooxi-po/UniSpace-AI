import type { Room } from '~/server/utils/fixation-stock-db'
import { updateRoom } from '~/server/utils/fixation-stock-db'
import { addFixationLog } from '~/server/utils/fixation-logs-db'

type Body = {
  id?: string
  updates?: Partial<Room>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.id) {
    throw createError({ statusCode: 400, statusMessage: 'id required' })
  }

  const next = await updateRoom(body.id, body.updates || {})
  if (!next) {
    throw createError({ statusCode: 404, statusMessage: 'Room not found' })
  }

  await addFixationLog({
    id: `LOG-STOCK-ROOM-${Date.now()}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'fixation',
    action: 'updateProject',
    projectId: next.id,
    projectName: `${next.buildingName}${next.roomNo}`,
    summary: `更新房间台账：${next.buildingName} ${next.roomNo}`,
    detail: body.updates || {},
  })

  return { room: next }
})

