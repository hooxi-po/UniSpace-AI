import { listDepartmentFees } from '~/server/utils/charging-db'

export default defineEventHandler(async () => {
  const list = await listDepartmentFees()
  return { list }
})

