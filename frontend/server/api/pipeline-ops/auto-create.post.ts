import type { PipelineOrderUpsertPayload } from '~/types/pipeline-ops'
import { autoCreateWorkorder } from '~/server/utils/pipeline-ops-db'

type AutoCreatePayload = {
  trigger: 'telemetry_alert' | 'anomaly_alert' | 'kg_inference'
  reason: string
  base: Omit<PipelineOrderUpsertPayload, 'source' | 'autoTrigger'>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<AutoCreatePayload>(event)
  if (!body?.trigger || !body?.reason?.trim() || !body?.base) {
    throw createError({ statusCode: 400, statusMessage: 'trigger/reason/base required' })
  }
  const workorder = await autoCreateWorkorder(body)
  return { workorder }
})
