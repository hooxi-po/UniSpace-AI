import type {
  PipelineMedium,
  PipelineOrderListQuery,
  PipelineOrderStatus,
  PipelineOrderType,
} from '~/types/pipeline-ops'
import { listWorkorders } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = query.page ? Number(query.page) : undefined
  const limit = query.limit ? Number(query.limit) : undefined
  const params: PipelineOrderListQuery = {
    type: query.type ? String(query.type) as PipelineOrderType : undefined,
    status: query.status ? String(query.status) as PipelineOrderStatus : undefined,
    area: query.area ? String(query.area) : undefined,
    pipelineMedium: query.pipelineMedium ? String(query.pipelineMedium) as PipelineMedium : undefined,
    nodeId: query.nodeId ? String(query.nodeId) : undefined,
    segmentId: query.segmentId ? String(query.segmentId) : undefined,
    buildingId: query.buildingId ? String(query.buildingId) : undefined,
    assignee: query.assignee ? String(query.assignee) : undefined,
    createdFrom: query.createdFrom ? String(query.createdFrom) : undefined,
    createdTo: query.createdTo ? String(query.createdTo) : undefined,
    q: query.q ? String(query.q) : undefined,
    page: Number.isFinite(page) ? page : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  }
  return await listWorkorders(params)
})
