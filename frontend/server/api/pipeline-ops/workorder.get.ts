import { getWorkorderById } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const id = String(query.id || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id required' })
  }
  const workorder = await getWorkorderById(id)
  if (!workorder) {
    throw createError({ statusCode: 404, statusMessage: 'workorder not found' })
  }
  return { workorder }
})
