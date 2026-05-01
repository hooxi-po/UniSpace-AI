import { readBody } from 'h3'
import { analyzeImpactScope } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return await analyzeImpactScope(body || {})
})
