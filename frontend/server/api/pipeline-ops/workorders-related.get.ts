import { getQuery } from 'h3'
import { listRelatedWorkorders } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parseCsv = (value: unknown) => String(value || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

  return await listRelatedWorkorders({
    segmentIds: parseCsv(query.segmentIds),
    nodeIds: parseCsv(query.nodeIds),
    buildingIds: parseCsv(query.buildingIds),
    limit: query.limit ? Number(query.limit) : undefined,
  })
})
