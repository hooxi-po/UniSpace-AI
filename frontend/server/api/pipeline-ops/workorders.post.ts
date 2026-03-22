import type { PipelineOrderUpsertPayload } from '~/types/pipeline-ops'
import { assertProxyWriteCallerAuthorized } from '~/server/utils/backend-proxy'
import { upsertWorkorder } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  assertProxyWriteCallerAuthorized(event)

  const body = await readBody<PipelineOrderUpsertPayload>(event)
  const workorder = await upsertWorkorder(body)
  return { workorder }
})
