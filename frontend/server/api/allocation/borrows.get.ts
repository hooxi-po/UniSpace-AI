import { listTemporaryBorrows } from '~/server/utils/allocation-db'

export default defineEventHandler(async () => {
  const list = await listTemporaryBorrows()
  return { list }
})

