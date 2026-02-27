import { ofetch }from 'ofetch'
import { getBackendBaseUrl, toProxyError }from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const backendBaseUrl = getBackendBaseUrl()
    const resp = await ofetch<{
      source: string
      stats: {
        totalRooms: number
        occupiedRooms: number
        availableRooms: number
        pendingApplications: number
        occupancyRate: string
        unpaidUtilities: number
      }
    }>(`${backendBaseUrl}/api/v1/property/overview`)

    return {
      source: resp.source || 'postgres',
      stats: resp.stats,
    }
  }catch (error) {
    throw toProxyError(event, error)
  }
})
