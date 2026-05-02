import { ofetch } from 'ofetch'
import { getBackendBaseUrl } from '~/server/utils/backend-proxy'

type ApartmentRoomType = 'TeacherApartment' | 'Student'

const APARTMENT_ROOM_TYPES: ApartmentRoomType[] = ['TeacherApartment', 'Student']
const DEFAULT_PAGE_LIMIT = 1000
const MAX_PAGE_LIMIT = 2000

function toSafeLimit(limit: unknown, fallback = DEFAULT_PAGE_LIMIT) {
  const parsed = Number.parseInt(String(limit ?? ''), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(1, Math.min(parsed, MAX_PAGE_LIMIT))
}

function toSafeOffset(offset: unknown) {
  const parsed = Number.parseInt(String(offset ?? ''), 10)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

export function normalizeApartmentRoomType(typeValue: unknown): ApartmentRoomType | null {
  const raw = String(typeValue ?? '').trim()
  if (!raw) return null
  if (raw === 'TeacherApartment' || raw === 'Student') return raw

  const lowered = raw.toLowerCase()
  if (lowered.includes('teacher') && lowered.includes('apartment')) return 'TeacherApartment'
  if (lowered.includes('student')) return 'Student'
  return null
}

function resolveRequestedApartmentTypes(typeQuery: unknown): ApartmentRoomType[] {
  const query = String(typeQuery ?? '').trim()
  if (!query || query.toLowerCase() === 'all') return APARTMENT_ROOM_TYPES

  const normalized = normalizeApartmentRoomType(query)
  return normalized ? [normalized] : []
}

function compareRooms(a: Record<string, any>, b: Record<string, any>) {
  const buildingA = String(a.building_code || '')
  const buildingB = String(b.building_code || '')
  if (buildingA !== buildingB) return buildingA.localeCompare(buildingB, 'zh-CN')

  const floorA = Number(a.floor || 0)
  const floorB = Number(b.floor || 0)
  if (floorA !== floorB) return floorA - floorB

  return String(a.room_no || '').localeCompare(String(b.room_no || ''), 'zh-CN')
}

async function listRoomsByType(params: {
  backendBaseUrl: string
  type: ApartmentRoomType
  buildingCode?: unknown
  status?: unknown
  pageLimit?: number
}) {
  const pageLimit = params.pageLimit ?? DEFAULT_PAGE_LIMIT
  let offset = 0
  const rows: Array<Record<string, any>> = []
  let source = 'postgres'

  while (true) {
    const resp = await ofetch<{
      source?: string
      rooms?: Array<Record<string, any>>
    }>(`${params.backendBaseUrl}/api/v1/property/rooms`, {
      query: {
        type: params.type,
        buildingCode: params.buildingCode,
        status: params.status,
        limit: pageLimit,
        offset,
      },
    })

    source = resp.source || source
    const batch = resp.rooms || []
    if (batch.length === 0) break

    rows.push(...batch)
    if (batch.length < pageLimit) break
    offset += pageLimit
  }

  return { source, rows }
}

export async function fetchApartmentRoomsFromBackend(query: {
  type?: unknown
  buildingCode?: unknown
  status?: unknown
}) {
  const backendBaseUrl = getBackendBaseUrl()
  const types = resolveRequestedApartmentTypes(query.type)
  if (types.length === 0) {
    return {
      source: 'postgres',
      rooms: [] as Array<Record<string, any>>,
    }
  }

  const pageLimit = DEFAULT_PAGE_LIMIT
  const merged: Array<Record<string, any>> = []
  let source = 'postgres'

  for (const type of types) {
    const resp = await listRoomsByType({
      backendBaseUrl,
      type,
      buildingCode: query.buildingCode,
      status: query.status,
      pageLimit,
    })

    source = resp.source || source
    for (const row of resp.rows) {
      const normalizedType = normalizeApartmentRoomType(row.type)
      if (!normalizedType) continue
      merged.push({
        ...row,
        type: normalizedType,
      })
    }
  }

  const deduped = new Map<string, Record<string, any>>()
  for (const row of merged) {
    const id = String(row.id || '')
    const key = id || `${String(row.building_code || '')}:${String(row.room_no || '')}:${String(row.type || '')}`
    if (!deduped.has(key)) deduped.set(key, row)
  }

  return {
    source,
    rooms: Array.from(deduped.values()).sort(compareRooms),
  }
}

export function paginateApartmentRooms<T>(rooms: T[], limitQuery: unknown, offsetQuery: unknown) {
  const limit = toSafeLimit(limitQuery, DEFAULT_PAGE_LIMIT)
  const offset = toSafeOffset(offsetQuery)
  return rooms.slice(offset, offset + limit)
}
