import { getQuery } from 'h3'
import { ofetch } from 'ofetch'
import { assertProxyWriteCallerAuthorized, getBackendBaseUrl, getBackendWriteAuthHeader, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event): Promise<unknown> => {
  try {
    assertProxyWriteCallerAuthorized(event)
    const backendBaseUrl = getBackendBaseUrl()
    const query = getQuery(event)
    return await ofetch(`${backendBaseUrl}/api/v1/features`, {
      method: 'DELETE',
      headers: {
        ...getBackendWriteAuthHeader(),
      },
      query,
    })
  } catch (error) {
    throw toProxyError(event, error)
  }
})
