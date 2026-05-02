import { getQuery } from 'h3'
import { ofetch } from 'ofetch'
import { getBackendBaseUrl, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    return await ofetch(`${getBackendBaseUrl()}/api/v1/property/inventory/tasks`, {
      query: {
        year: q.year,
        status: q.status,
        keyword: q.keyword,
      },
    })
  } catch (e) {
    throw toProxyError(event, e)
  }
})