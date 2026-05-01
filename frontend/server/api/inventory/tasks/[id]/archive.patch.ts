import { ofetch } from 'ofetch'
import {
  assertProxyWriteCallerAuthorized,
  getBackendBaseUrl,
  getBackendWriteAuthHeader,
  toProxyError,
} from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    assertProxyWriteCallerAuthorized(event)
    const id = getRouterParam(event, 'id')

    return await ofetch(`${getBackendBaseUrl()}/api/v1/property/inventory/tasks/${id}/archive`, {
      method: 'PATCH',
      headers: { ...getBackendWriteAuthHeader() },
    })
  } catch (e) {
    throw toProxyError(event, e)
  }
})