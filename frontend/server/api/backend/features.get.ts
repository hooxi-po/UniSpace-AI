import { getQuery } from 'h3'
import { ofetch } from 'ofetch'
import { getBackendBaseUrl, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event): Promise<unknown> => {
  try {
    const backendBaseUrl = getBackendBaseUrl()
    const query = getQuery(event)
    return await ofetch(`${backendBaseUrl}/api/v1/features`, { query })
  } catch (error) {
    throw toProxyError(event, error)
  }
})
