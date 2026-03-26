import { getQuery } from 'h3'
import { ofetch } from 'ofetch'
import { getBackendBaseUrl, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    return await ofetch(`${getBackendBaseUrl()}/api/v1/property/service-workorders`, {
      query: {
        keyword: q.keyword,
        status: q.status,
        priority: q.priority,
        limit: q.limit,
        offset: q.offset,
      },
    })
  } catch (e) {
    throw toProxyError(event, e)
  }
})