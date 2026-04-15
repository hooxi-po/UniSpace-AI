import { readBody } from 'h3'
import { ofetch } from 'ofetch'
import { assertProxyWriteCallerAuthorized, getBackendBaseUrl, getBackendWriteAuthHeader, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    assertProxyWriteCallerAuthorized(event)
    const backendBaseUrl = getBackendBaseUrl()
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    return await ofetch(`${backendBaseUrl}/api/v1/property/applications/${id}`, {
      method: 'PUT',
      headers: { ...getBackendWriteAuthHeader() },
      body,
    })
  } catch (error) {
    throw toProxyError(event, error)
  }
})










