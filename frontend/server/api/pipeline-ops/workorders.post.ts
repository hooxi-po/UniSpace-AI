import type { PipelineOrderUpsertPayload } from '~/types/pipeline-ops'
import { upsertWorkorder } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<PipelineOrderUpsertPayload>(event)
  const workorder = await upsertWorkorder(body)
  return { workorder }
})
