import { promises as fs } from 'node:fs'
import path from 'node:path'
import { readAllocationDb, writeAllocationDb, type TemporaryBorrow } from '~/server/utils/allocation-db'
import { addAllocationLog } from '~/server/utils/allocation-logs-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Omit<TemporaryBorrow, 'id' | 'status'>>(event)
  
  const db = await readAllocationDb()
  
  const newBorrow: TemporaryBorrow = {
    ...body,
    id: `TB-${Date.now().toString().slice(-6)}`,
    status: 'Active'
  }

  db.borrows.unshift(newBorrow)
  await writeAllocationDb(db)

  await addAllocationLog({
    id: `LOG-TB-NEW-${Date.now()}`,
    at: new Date().toISOString(),
    operator: '当前用户',
    module: 'allocation',
    action: 'createRequest', // Reuse existing action or define new one
    requestId: newBorrow.id,
    department: newBorrow.borrowerDept,
    summary: `管理员录入了新的临时借用记录：${newBorrow.buildingName}${newBorrow.roomNo}`,
    detail: newBorrow
  })

  return { borrow: newBorrow }
})

