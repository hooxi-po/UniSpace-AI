import { ofetch } from 'ofetch'
import { getBackendBaseUrl, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    return await ofetch(`${getBackendBaseUrl()}/api/v1/property/inventory/tasks/${id}`)
  } catch (e) {
    throw toProxyError(event, e)
  }
})