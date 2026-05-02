import { upsertGaojibiaoRow } from '~/server/utils/reports-gaojibiao-db'

type Body = {
  projectId: string
  projectName: string
  assetCode?: string
  assetName?: string
  department?: string
  serviceLife?: number
  originalValue?: number
  residualRate?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.projectId || !body?.projectName) {
    throw createError({ statusCode: 400, statusMessage: 'projectId and projectName required' })
  }

  const row = await upsertGaojibiaoRow({
    projectId: body.projectId,
    projectName: body.projectName,
    assetCode: body.assetCode,
    assetName: body.assetName,
    department: body.department,
    serviceLife: body.serviceLife,
    originalValue: body.originalValue,
    residualRate: body.residualRate,
  })

  return { row }
})

