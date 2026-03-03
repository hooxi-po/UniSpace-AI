import type { PipelineOrderTransitionPayload } from '~/types/pipeline-ops'
import { transitionWorkorder } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<PipelineOrderTransitionPayload>(event)
  const workorder = await transitionWorkorder(body)
  return { workorder }
})
