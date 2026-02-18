import { upsertPerson } from '~/server/utils/persons-db'
import type { Person } from '~/server/utils/persons-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Person>(event)
  if (!body?.personId) {
    throw createError({ statusCode: 400, statusMessage: 'personId required' })
  }
  const updated = await upsertPerson(body)
  return { person: updated }
})

