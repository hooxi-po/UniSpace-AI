import type {
  ConvertToMaintenancePayload,
  ImpactAdjustPayload,
  InspectionRecordPayload,
  PipelineExecutionLogPayload,
  PumpControlPayload,
} from '~/types/pipeline-ops'
import {
  addExecutionLog,
  addInspectionRecord,
  adjustImpactScope,
  controlHotWaterPumps,
  convertInspectionToMaintenance,
} from '~/server/utils/pipeline-ops-db'

type ActionPayload =
  | { action: 'add_log'; payload: PipelineExecutionLogPayload }
  | { action: 'adjust_impact'; payload: ImpactAdjustPayload }
  | { action: 'pump_control'; payload: PumpControlPayload }
  | { action: 'add_inspection_record'; payload: InspectionRecordPayload }
  | { action: 'convert_to_maintenance'; payload: ConvertToMaintenancePayload }

export default defineEventHandler(async (event) => {
  const body = await readBody<ActionPayload>(event)
  if (!body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'action required' })
  }

  if (body.action === 'add_log') {
    const workorder = await addExecutionLog(body.payload)
    return { workorder }
  }

  if (body.action === 'adjust_impact') {
    const workorder = await adjustImpactScope(body.payload)
    return { workorder }
  }

  if (body.action === 'pump_control') {
    const workorder = await controlHotWaterPumps(body.payload)
    return { workorder }
  }

  if (body.action === 'add_inspection_record') {
    const workorder = await addInspectionRecord(body.payload)
    return { workorder }
  }

  if (body.action === 'convert_to_maintenance') {
    const maintenanceWorkorder = await convertInspectionToMaintenance(body.payload)
    return { maintenanceWorkorder }
  }

  throw createError({ statusCode: 400, statusMessage: 'unsupported action' })
})
