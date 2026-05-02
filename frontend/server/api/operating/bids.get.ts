import { getQuery } from 'h3'
import { getSpaces, writeSpaces } from '../../utils/operating-db'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const spaceId = String(q.spaceId ?? '')

  if (!spaceId) {
    throw createError({ statusCode: 400, statusMessage: 'spaceId_required' })
  }

  const spaces = await getSpaces()
  const idx = spaces.findIndex(s => s.id === spaceId)
  if (idx < 0) {
    throw createError({ statusCode: 404, statusMessage: 'space_not_found' })
  }

  // 兼容旧数据：确保 bids 字段存在
  const bids = Array.isArray((spaces[idx] as any).bids) ? (spaces[idx] as any).bids : []
  if (!Array.isArray((spaces[idx] as any).bids)) {
    ;(spaces[idx] as any).bids = bids
    await writeSpaces(spaces)
  }

  return {
    source: 'mock',
    spaceId,
    bids,
  }
})

