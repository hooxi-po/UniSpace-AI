import { ofetch } from 'ofetch'
import { getBackendBaseUrl, toProxyError } from '~/server/utils/backend-proxy'
import { analyzeImpactScope, listRelatedWorkorders } from '~/server/utils/pipeline-ops-db'
import type { PipelineWorkOrder } from '~/types/pipeline-ops'

type ChatHistoryItem = {
  role?: string
  text?: string
}

type ChatContextPayload = Record<string, unknown> | null | undefined

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function toText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .map(item => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter(Boolean)
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function summarizeWorkorder(item: PipelineWorkOrder) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    priority: item.priority,
    pipelineMedium: item.pipelineMedium,
    area: item.area,
    assignee: item.assignee || '',
    buildingId: item.buildingId || '',
    buildingName: item.buildingName || '',
    segmentIds: item.segmentIds || [],
    nodeIds: item.nodeIds || [],
    updatedAt: item.updatedAt,
  }
}

async function loadFeatureById(featureId: string) {
  const backendBaseUrl = getBackendBaseUrl()
  const response = await ofetch<{ type?: string; features?: Array<Record<string, unknown>> }>(
    `${backendBaseUrl}/api/v1/features`,
    {
      query: {
        ids: featureId,
        limit: 1,
      },
    },
  )
  const feature = Array.isArray(response?.features) ? response.features[0] : null
  if (!feature) return null
  return feature
}

async function loadTwinContext(featureId: string) {
  const backendBaseUrl = getBackendBaseUrl()
  try {
    return await ofetch<Record<string, unknown>>(
      `${backendBaseUrl}/api/v1/twin/drilldown/${encodeURIComponent(featureId)}`,
    )
  } catch {
    return null
  }
}

async function loadTelemetryContext(featureId: string) {
  const backendBaseUrl = getBackendBaseUrl()
  try {
    const response = await ofetch<{ list?: Array<Record<string, unknown>> }>(
      `${backendBaseUrl}/api/v1/twin/telemetry/latest`,
      {
        query: {
          featureIds: featureId,
        },
      },
    )
    return Array.isArray(response?.list) ? response.list : []
  } catch {
    return []
  }
}

async function buildBusinessContext(input: ChatContextPayload) {
  if (!input || typeof input !== 'object') return null

  const selectionType = toText(input.selectionType) || 'unknown'
  const featureId = toText(input.assetId)
  const pipelineMedium = toText(input.pipelineMedium)
  const area = toText(input.area)
  const linkedBuildingIds = toStringArray(input.connectedBuildingIds)
  const topologyNodeIds = toStringArray(input.topologyNodeIds)

  let inferredSegmentIds: string[] = []
  let inferredNodeIds = [...topologyNodeIds]
  let inferredBuildingIds = [...linkedBuildingIds]
  let featureSnapshot: Record<string, unknown> | null = null
  let twinContext: Record<string, unknown> | null = null

  if (featureId) {
    featureSnapshot = await loadFeatureById(featureId)
    twinContext = await loadTwinContext(featureId)
  }

  const twinSegment = twinContext && typeof twinContext.segment === 'object' && twinContext.segment
    ? twinContext.segment as Record<string, unknown>
    : null
  const twinNodes = Array.isArray(twinContext?.nodes) ? twinContext.nodes as Array<Record<string, unknown>> : []
  const twinBuildings = Array.isArray(twinContext?.linkedBuildings)
    ? twinContext.linkedBuildings as Array<Record<string, unknown>>
    : []

  const segmentId = toText(twinSegment?.id) || toText(twinSegment?.segmentId)
  if (segmentId) inferredSegmentIds = [segmentId]
  if (!inferredNodeIds.length) {
    inferredNodeIds = twinNodes
      .map(node => toText(node.id) || toText(node.nodeId))
      .filter(Boolean)
  }
  if (!inferredBuildingIds.length) {
    inferredBuildingIds = twinBuildings
      .map(building => toText(building.id) || toText(building.buildingId))
      .filter(Boolean)
  }

  const [relatedWorkordersResult, impactResult, telemetryList] = await Promise.all([
    (inferredSegmentIds.length || inferredNodeIds.length || inferredBuildingIds.length)
      ? listRelatedWorkorders({
          segmentIds: inferredSegmentIds,
          nodeIds: inferredNodeIds,
          buildingIds: inferredBuildingIds,
          limit: 6,
        }).catch(() => ({ list: [] as PipelineWorkOrder[] }))
      : Promise.resolve({ list: [] as PipelineWorkOrder[] }),
    (selectionType === 'pipe' && (inferredSegmentIds.length || inferredNodeIds.length || inferredBuildingIds.length))
      ? analyzeImpactScope({
          segmentIds: inferredSegmentIds,
          nodeIds: inferredNodeIds,
          buildingId: inferredBuildingIds[0],
          buildingName: twinBuildings[0] ? toText(twinBuildings[0].name) : '',
          medium: pipelineMedium || undefined,
          area: area || undefined,
        }).catch(() => null)
      : Promise.resolve(null),
    featureId ? loadTelemetryContext(featureId) : Promise.resolve([] as Array<Record<string, unknown>>),
  ])

  return {
    selectionType,
    selectedAsset: input,
    featureSnapshot,
    twin: twinContext
      ? {
          segment: twinContext.segment || null,
          nodeCount: twinNodes.length,
          linkedBuildings: twinBuildings.slice(0, 6).map(item => ({
            id: toText(item.id) || toText(item.buildingId),
            name: toText(item.name) || toText(item.buildingName),
          })),
          impactedRooms: Array.isArray(twinContext.impactedRooms) ? twinContext.impactedRooms : [],
          valves: Array.isArray(twinContext.valves) ? twinContext.valves : [],
          equipments: Array.isArray(twinContext.equipments) ? twinContext.equipments : [],
        }
      : null,
    resolvedIds: {
      featureId,
      segmentIds: inferredSegmentIds,
      nodeIds: inferredNodeIds,
      buildingIds: inferredBuildingIds,
    },
    relatedWorkorders: (relatedWorkordersResult.list || []).map(summarizeWorkorder),
    impactAnalysis: impactResult
      ? {
          estimatedImpactHours: impactResult.estimatedImpactHours,
          affectedUserCount: impactResult.affectedUserCount,
          impactedBuildings: (impactResult.impactedBuildings || []).slice(0, 8),
        }
      : null,
    telemetryLatest: telemetryList.slice(0, 8).map(item => ({
      featureId: toText(item.featureId),
      metric: toText(item.metric),
      value: toNumber(item.value),
      unit: toText(item.unit),
      sampledAt: toText(item.sampledAt),
      quality: toText(item.quality),
    })),
  }
}

function buildSystemInstruction(contextSummary: Record<string, unknown> | null) {
  return `
你是 NOAH（Network Operations Artificial Helper），校园地下管网运维系统的 AI 运维助手。

你的工作要求：
1. 只基于已提供的真实业务上下文和用户问题回答，不要假装你查询了不存在的数据。
2. 如果上下文里没有足够信息，明确说“当前上下文不足”，并指出还缺什么。
3. 优先回答和地下管网、楼宇联动、工单、拓扑影响范围、遥测异常有关的问题。
4. 给建议时尽量落到可执行层面，例如排查顺序、建议工单类型、影响范围判断、下一步确认项。
5. 使用中文（简体），语气专业、简洁、冷静。
6. 你的最终输出必须是一个合法 JSON 对象，不要输出 Markdown，不要输出代码块，不要输出 JSON 以外的解释文字。
7. 你的 JSON 必须严格符合以下结构：
{
  "answer": "给用户看的简洁结论",
  "confirmedFacts": ["基于上下文能确认的事实"],
  "inferences": ["基于事实得出的推断或建议"],
  "missingInfo": ["当前缺失但会影响判断的信息"],
  "nextSteps": ["建议执行的后续步骤"],
  "sourceSummary": {
    "selectionType": "",
    "featureId": "",
    "segmentCount": 0,
    "nodeCount": 0,
    "buildingCount": 0,
    "workorderCount": 0,
    "telemetryCount": 0
  },
  "actions": [
    {
      "type": "create_workorder|open_workorder|open_workorder_board|open_pipe_editor|locate_on_map|none",
      "label": "按钮文案",
      "payload": {}
    }
  ]
}
8. 如果没有合适动作，actions 返回空数组。
9. confirmedFacts 只能写上下文中确实存在的事实；不确定的内容放到 inferences 或 missingInfo。

当前真实上下文（JSON）：
${JSON.stringify(contextSummary || {}, null, 2)}
`
}

function toDeepSeekHistory(history: ChatHistoryItem[]) {
  return history
    .map<DeepSeekMessage | null>((item) => {
      const content = toText(item.text)
      if (!content) return null
      return {
        role: item.role === 'model' ? 'assistant' : 'user',
        content,
      }
    })
    .filter((item): item is DeepSeekMessage => Boolean(item))
}

function buildSseEvent(text: string) {
  return `data: ${JSON.stringify({ text })}\n\n`
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const candidate = text.slice(start, end + 1)
  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    return null
  }
}

function toActionPayloads(contextSummary: Record<string, unknown> | null) {
  const resolvedIds = (contextSummary?.resolvedIds && typeof contextSummary.resolvedIds === 'object')
    ? contextSummary.resolvedIds as Record<string, unknown>
    : {}
  const featureId = toText(resolvedIds.featureId)
  const segmentIds = toStringArray(resolvedIds.segmentIds)
  const nodeIds = toStringArray(resolvedIds.nodeIds)
  const buildingIds = toStringArray(resolvedIds.buildingIds)
  const relatedWorkorders = Array.isArray(contextSummary?.relatedWorkorders)
    ? contextSummary?.relatedWorkorders as Array<Record<string, unknown>>
    : []

  return {
    featureId,
    segmentIds,
    nodeIds,
    buildingIds,
    firstWorkorderId: toText(relatedWorkorders[0]?.id),
  }
}

type NormalizedActionPayload = {
  featureId?: string
  segmentIds?: string[]
  nodeIds?: string[]
  buildingIds?: string[]
  workorderId?: string
}

type NormalizedAction = {
  type: string
  label: string
  payload: NormalizedActionPayload
}

function normalizeAiPayload(
  rawPayload: Record<string, unknown> | null,
  contextSummary: Record<string, unknown> | null,
) {
  const actionBase = toActionPayloads(contextSummary)
  const sourceSummaryInput = (rawPayload?.sourceSummary && typeof rawPayload.sourceSummary === 'object')
    ? rawPayload.sourceSummary as Record<string, unknown>
    : {}

  const actions = Array.isArray(rawPayload?.actions) ? rawPayload?.actions : []
  const normalizedActions: NormalizedAction[] = actions
    .map<NormalizedAction | null>((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const type = toText(row.type)
      const label = toText(row.label)
      if (!type || !label || type === 'none') return null
      const payload = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {}
      return {
        type,
        label,
        payload: {
          ...payload,
          featureId: toText(payload.featureId) || actionBase.featureId,
          segmentIds: toStringArray(payload.segmentIds).length ? toStringArray(payload.segmentIds) : actionBase.segmentIds,
          nodeIds: toStringArray(payload.nodeIds).length ? toStringArray(payload.nodeIds) : actionBase.nodeIds,
          buildingIds: toStringArray(payload.buildingIds).length ? toStringArray(payload.buildingIds) : actionBase.buildingIds,
          workorderId: toText(payload.workorderId) || actionBase.firstWorkorderId,
        } satisfies NormalizedActionPayload,
      }
    })
    .filter((item): item is NormalizedAction => Boolean(item))

  if (!normalizedActions.length && actionBase.featureId) {
    const createPayload: NormalizedActionPayload = { featureId: actionBase.featureId }
    const openEditorPayload: NormalizedActionPayload = { featureId: actionBase.featureId }
    const locatePayload: NormalizedActionPayload = {
      featureId: actionBase.featureId,
      segmentIds: actionBase.segmentIds,
      nodeIds: actionBase.nodeIds,
      buildingIds: actionBase.buildingIds,
    }
    normalizedActions.push(
      {
        type: 'create_workorder',
        label: '创建工单草稿',
        payload: createPayload,
      },
      {
        type: 'open_pipe_editor',
        label: '打开二维编辑器',
        payload: openEditorPayload,
      },
      {
        type: 'locate_on_map',
        label: '地图定位',
        payload: locatePayload,
      },
    )
  }
  if (actionBase.firstWorkorderId && !normalizedActions.some(item => item?.type === 'open_workorder')) {
    const openWorkorderPayload: NormalizedActionPayload = { workorderId: actionBase.firstWorkorderId }
    normalizedActions.push({
      type: 'open_workorder',
      label: '打开关联工单',
      payload: openWorkorderPayload,
    })
  }

  return {
    answer: toText(rawPayload?.answer),
    confirmedFacts: Array.isArray(rawPayload?.confirmedFacts) ? rawPayload.confirmedFacts : [],
    inferences: Array.isArray(rawPayload?.inferences) ? rawPayload.inferences : [],
    missingInfo: Array.isArray(rawPayload?.missingInfo) ? rawPayload.missingInfo : [],
    nextSteps: Array.isArray(rawPayload?.nextSteps) ? rawPayload.nextSteps : [],
    sourceSummary: {
      selectionType: toText(sourceSummaryInput.selectionType) || toText(contextSummary?.selectionType),
      featureId: toText(sourceSummaryInput.featureId) || actionBase.featureId,
      segmentCount: toNumber(sourceSummaryInput.segmentCount) ?? actionBase.segmentIds.length,
      nodeCount: toNumber(sourceSummaryInput.nodeCount) ?? actionBase.nodeIds.length,
      buildingCount: toNumber(sourceSummaryInput.buildingCount) ?? actionBase.buildingIds.length,
      workorderCount: toNumber(sourceSummaryInput.workorderCount)
        ?? (Array.isArray(contextSummary?.relatedWorkorders) ? contextSummary.relatedWorkorders.length : 0),
      telemetryCount: toNumber(sourceSummaryInput.telemetryCount)
        ?? (Array.isArray(contextSummary?.telemetryLatest) ? contextSummary.telemetryLatest.length : 0),
    },
    actions: normalizedActions,
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const message = toText(body?.message)
  const history = Array.isArray(body?.history) ? body.history as ChatHistoryItem[] : []
  const context = (body?.context && typeof body.context === 'object') ? body.context as Record<string, unknown> : null

  const deepseekApiKey = String(config.deepseekApiKey || '').trim()
  const deepseekModel = String(config.deepseekModel || 'deepseek-v4-flash').trim()

  if (!deepseekApiKey) {
    throw createError({
      statusCode: 500,
      message: '错误：系统配置丢失（未找到 DEEPSEEK_API_KEY）。通信离线。'
    })
  }

  if (!message) {
    throw createError({
      statusCode: 400,
      message: 'message_required',
    })
  }

  let businessContext: Record<string, unknown> | null = null
  try {
    businessContext = await buildBusinessContext(context)
  } catch (error) {
    throw toProxyError(event, error)
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: deepseekModel,
        stream: true,
        messages: [
          { role: 'system', content: buildSystemInstruction(businessContext) },
          ...toDeepSeekHistory(history),
          { role: 'user', content: message },
        ],
      }),
    })

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '')
      throw createError({
        statusCode: response.status || 500,
        message: errorText || 'deepseek_chat_request_failed',
      })
    }

    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ''
        let fullText = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() || ''

            for (const rawEvent of events) {
              const line = rawEvent
                .split('\n')
                .find(item => item.startsWith('data: '))
              if (!line) continue
              const data = line.slice(6).trim()
              if (!data || data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const text = String(parsed?.choices?.[0]?.delta?.content || '')
                if (text) {
                  fullText += text
                  controller.enqueue(buildSseEvent(text))
                }
              } catch {
                // ignore malformed upstream SSE chunks
              }
            }
          }

          const parsedPayload = normalizeAiPayload(extractJsonObject(fullText), businessContext)
          controller.enqueue(`data: ${JSON.stringify({ parsedPayload })}\n\n`)
          controller.enqueue('data: [DONE]\n\n')
          controller.close()
        } catch (error) {
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
    })

    return stream
  } catch (error) {
    console.error('DeepSeek communication failed:', error)
    throw createError({
      statusCode: 500,
      message: '网络错误：与 DeepSeek AI 核心的连接中断。'
    })
  }
})
