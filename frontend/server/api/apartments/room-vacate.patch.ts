import { readBody } from 'h3'
import { ofetch } from 'ofetch'
import { assertProxyWriteCallerAuthorized, getBackendBaseUrl, getBackendWriteAuthHeader, toProxyError } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    assertProxyWriteCallerAuthorized(event)
    const backendBaseUrl = getBackendBaseUrl()
    const body = await readBody<{ roomId?: string }>(event)
    const roomId = String(body?.roomId || '').trim()
    if (!roomId) throw new Error('room_id_required')

    return await ofetch(`${backendBaseUrl}/api/v1/property/rooms/${roomId}/vacate`, {
      method: 'PATCH',
      headers: { ...getBackendWriteAuthHeader() },
    })
  } catch (error) {
    throw toProxyError(event, error)
  }
})






