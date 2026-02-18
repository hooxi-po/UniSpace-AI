import { listPersons } from '~/server/utils/persons-db'

export default defineEventHandler(async () => {
  const list = await listPersons()
  return { list }
})

