import type { PipelineOrderTransitionPayload } from '~/types/pipeline-ops'
import { assertProxyWriteCallerAuthorized } from '~/server/utils/backend-proxy'
import { transitionWorkorder } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  assertProxyWriteCallerAuthorized(event)

  const body = await readBody<PipelineOrderTransitionPayload>(event)
  const workorder = await transitionWorkorder(body)
  return { workorder }
})
