import { readBody } from 'h3'
import { quickReportWorkorder } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    featureId?: string
    lng: number
    lat: number
    faultType: 'leak' | 'burst' | 'blockage' | 'other'
    severity: 'low' | 'medium' | 'high'
    note?: string
    reportedBy?: string
  }>(event)

  const workorder = await quickReportWorkorder(body)
  return { workorder }
})
