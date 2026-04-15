import type {
  PipelineMedium,
  PipelineOrderListQuery,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
} from '~/types/pipeline-ops'
import { getDashboardFiltered } from '~/server/utils/pipeline-ops-db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params: PipelineOrderListQuery = {
    type: query.type ? String(query.type) as PipelineOrderType : undefined,
    status: query.status ? String(query.status) as PipelineOrderStatus : undefined,
    area: query.area ? String(query.area) : undefined,
    pipelineMedium: query.pipelineMedium ? String(query.pipelineMedium) as PipelineMedium : undefined,
    priority: query.priority ? String(query.priority) as PipelinePriority : undefined,
    nodeId: query.nodeId ? String(query.nodeId) : undefined,
    segmentId: query.segmentId ? String(query.segmentId) : undefined,
    buildingId: query.buildingId ? String(query.buildingId) : undefined,
    assignee: query.assignee ? String(query.assignee) : undefined,
    createdFrom: query.createdFrom ? String(query.createdFrom) : undefined,
    createdTo: query.createdTo ? String(query.createdTo) : undefined,
    q: query.q ? String(query.q) : undefined,
  }
  const dashboard = await getDashboardFiltered(params)
  return { dashboard }
})
