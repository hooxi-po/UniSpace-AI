import { getQuery } from 'h3'
import { listPipelineAssets } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return await listPipelineAssets({
    assetType: String(query.assetType || ''),
    q: String(query.q || ''),
    pipelineMedium: String(query.pipelineMedium || ''),
    limit: query.limit ? Number(query.limit) : undefined,
  })
})
