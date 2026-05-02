import { ofetch } from 'ofetch'
import { assertProxyWriteCallerAuthorized, getBackendBaseUrl, getBackendWriteAuthHeader, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    assertProxyWriteCallerAuthorized(event)
    const backendBaseUrl = getBackendBaseUrl()
    const id = getRouterParam(event, 'id')
    return await ofetch(`${backendBaseUrl}/api/v1/property/applications/${id}`, {
      method: 'DELETE',
      headers: { ...getBackendWriteAuthHeader() },
    })
  } catch (error) {
    throw toProxyError(event, error)
  }
})










