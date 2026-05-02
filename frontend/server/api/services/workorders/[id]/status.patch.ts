import { readBody } from 'h3'
import { ofetch } from 'ofetch'
import { assertProxyWriteCallerAuthorized, getBackendBaseUrl, getBackendWriteAuthHeader, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    assertProxyWriteCallerAuthorized(event)
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    return await ofetch(`${getBackendBaseUrl()}/api/v1/property/service-workorders/${id}/status`, {
      method: 'PATCH',
      headers: { ...getBackendWriteAuthHeader() },
      body,
    })
  } catch (e) {
    throw toProxyError(event, e)
  }
})