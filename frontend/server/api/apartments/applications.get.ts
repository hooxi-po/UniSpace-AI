import { getQuery } from 'h3'
import { ofetch } from 'ofetch'
import { getBackendBaseUrl } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  try {
    const backendBaseUrl = getBackendBaseUrl()
    return await ofetch(`${backendBaseUrl}/api/v1/property/applications`, {
      query: {
        keyword: query.keyword,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      },
    })
  } catch (error) {
    console.warn('[apartments/applications.get] backend unavailable, fallback empty list', error)
    return {
      source: 'fallback',
      items: [],
      limit: Number(query.limit || 500),
      offset: Number(query.offset || 0),
    }
  }
})