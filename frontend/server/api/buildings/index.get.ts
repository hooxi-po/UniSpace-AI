import { getQuery }from 'h3'
import { ofetch }from 'ofetch'
import { getBackendBaseUrl, toProxyError }from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const includeRooms = String(query.includeRooms || '').toLowerCase() === 'true'
    const backendBaseUrl = getBackendBaseUrl()

    const buildingsResp = await ofetch<{
      source: string
      buildings: Array<Record<string, any>>
    }>(`${backendBaseUrl}/api/v1/property/buildings`)

    const buildings = (buildingsResp.buildings || []).map((b) => ({
      code: String(b.code || ''),
      projectName: String(b.project_name || ''),
      buildingName: String(b.building_name || ''),
      contractor: b.contractor ?? null,
      supervisor: b.supervisor ?? null,
      contractAmount: b.contract_amount ?? null,
      auditAmount: b.audit_amount ?? null,
      fundSource: b.fund_source ?? null,
      location: b.location ?? null,
      plannedArea: b.planned_area ?? null,
      floorCount: b.floor_count ?? null,
      roomCount: b.room_count ?? null,
      projectManager: b.project_manager ?? null,
      plannedStartDate: b.planned_start_date ?? null,
      plannedEndDate: b.planned_end_date ?? null,
      actualStartDate: b.actual_start_date ?? null,
      actualEndDate: b.actual_end_date ?? null,
      status: b.status ?? null,
    }))

    if (!includeRooms) {
      return {
        source: buildingsResp.source || 'postgres',
        buildings,
      }
    }

    const roomsResp = await ofetch<{
      rooms: Array<Record<string, any>>
    }>(`${backendBaseUrl}/api/v1/property/rooms`, {
      query: {
        type: query.type,
        status: query.status,
        limit: query.limit ?? 1000,
        offset: query.offset ?? 0,
      },
    })

    const rooms = (roomsResp.rooms || []).map((r) => ({
      id: String(r.id || ''),
      buildingCode: String(r.building_code || ''),
      buildingName: String(r.master_building_name || r.building_name || ''),
      roomNo: String(r.room_no || ''),
      floor: Number(r.floor || 0),
      area: Number(r.area || 0),
      type: String(r.type || ''),
      status: String(r.status || ''),
      department: String(r.department || ''),
      mainCategory: String(r.main_category || ''),
      subCategory: String(r.sub_category || ''),
    }))

    return {
      source: buildingsResp.source || 'postgres',
      buildings,
      rooms,
    }
  }catch (error) {
    throw toProxyError(event, error)
  }
})
