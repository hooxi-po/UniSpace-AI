<template>
  <div class="ops-linkage-view">
    <div v-if="workordersError" class="ops-linkage-view__notice">
      工单关联链加载失败: {{ workordersError.message || '请稍后重试' }}
    </div>
    <div v-else-if="linkageLoadWarning" class="ops-linkage-view__notice ops-linkage-view__notice--warn">
      {{ linkageLoadWarning }}
    </div>
    <PipelineOpsTimeline
      :chains="timelineChains"
      @open-workorder="handleOpenWorkorder"
    />
    <PipelineOpsBoard
      v-model:realtime-enabled="realtimeEnabled"
      mode="linkage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PipelineOpsBoard from '~/components/admin/ops/PipelineOpsBoard.vue'
import PipelineOpsTimeline from '~/components/admin/ops/PipelineOpsTimeline.vue'
import { usePipelineOpsRealtime } from '~/composables/admin/usePipelineOpsRealtime'
import { pipelineOpsSourceLabel } from '~/components/admin/ops/pipeline-ops-view-constants'
import { pipelineOpsService } from '~/services/pipeline-ops'
import type { PipelineOrderStatus, PipelineOrderType, PipelineWorkOrder } from '~/types/pipeline-ops'

type TimelineItem = {
  workorderId: string
  type: PipelineOrderType
  title: string
  status: PipelineOrderStatus
  createdAt: string
  assignee?: string
  triggerReasons?: string[]
}

type TimelineLevel = {
  id: string
  items: TimelineItem[]
}

type TimelineChain = {
  id: string
  startDate: string
  levels: TimelineLevel[]
}

const LINKAGE_REFRESH_LIMIT = 200
const LINKAGE_REFRESH_SORT = 'created_at_asc' as const
const WORKORDERS_UPDATED_EVENT = 'pipeline:workorders-updated'

const nuxtApp = useNuxtApp()
const route = useRoute()
const router = useRouter()
const realtimeEnabled = ref(false)
const linkageLoadWarning = ref('')
let linkageRefreshRunning = false
let linkageRefreshQueued = false

const { data: initialWorkorders, error: initialWorkordersError } = await useAsyncData(
  'ops-linkage-workorders',
  fetchAllLinkageWorkorders,
  { default: () => [] as PipelineWorkOrder[] },
)

const workorders = ref<PipelineWorkOrder[]>(initialWorkorders.value)
const workordersError = ref<Error | null>(normalizeError(initialWorkordersError.value))
const timelineChains = computed(() => buildTimelineChains(workorders.value))

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener(WORKORDERS_UPDATED_EVENT, handleWorkordersUpdated)
  }
  if (!nuxtApp.isHydrating || workordersError.value || linkageLoadWarning.value) {
    void refreshLinkageChains()
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener(WORKORDERS_UPDATED_EVENT, handleWorkordersUpdated)
  }
})

usePipelineOpsRealtime({
  enabled: realtimeEnabled,
  interval: 30000,
  onUpdate: async () => {
    await refreshLinkageChains()
  },
})

async function fetchAllLinkageWorkorders(): Promise<PipelineWorkOrder[]> {
  linkageLoadWarning.value = ''
  const firstPage = await pipelineOpsService.fetchWorkorders({
    page: 1,
    limit: LINKAGE_REFRESH_LIMIT,
    sortBy: LINKAGE_REFRESH_SORT,
  })
  const pages = Math.max(1, firstPage.pagination?.totalPages || 1)
  const all = [...firstPage.list]
  const failedPages: number[] = []

  for (let page = 2; page <= pages; page += 1) {
    try {
      const pageResult = await pipelineOpsService.fetchWorkorders({
        page,
        limit: LINKAGE_REFRESH_LIMIT,
        sortBy: LINKAGE_REFRESH_SORT,
      })
      all.push(...pageResult.list)
    } catch {
      failedPages.push(page)
    }
  }

  if (failedPages.length > 0) {
    linkageLoadWarning.value = `联动链刷新部分失败，已保留成功加载的数据。失败页码: ${failedPages.join(', ')}`
  }

  return dedupeWorkorders(all)
}

async function refreshLinkageChains() {
  if (linkageRefreshRunning) {
    linkageRefreshQueued = true
    return
  }
  linkageRefreshRunning = true
  try {
    const allWorkorders = await fetchAllLinkageWorkorders()
    workorders.value = allWorkorders
    workordersError.value = null
  } catch (error) {
    if (workorders.value.length === 0) {
      workordersError.value = normalizeError(error)
    } else {
      linkageLoadWarning.value = normalizeError(error)?.message || '联动链刷新失败，已保留当前数据'
    }
  } finally {
    linkageRefreshRunning = false
    if (linkageRefreshQueued) {
      linkageRefreshQueued = false
      void refreshLinkageChains()
    }
  }
}

function handleWorkordersUpdated() {
  void refreshLinkageChains()
}

function buildTimelineChains(items: PipelineWorkOrder[]): TimelineChain[] {
  const orderMap = new Map(items.map(item => [item.id, item]))
  const edgeMap = new Map<string, { parentId: string; childId: string }>()
  const undirected = new Map<string, Set<string>>()

  for (const item of items) {
    const linkedIds = dedupeIds(
      item.linkedWorkorderIds.filter(linkedId => linkedId && linkedId !== item.id && orderMap.has(linkedId)),
    )
    if (!linkedIds.length) continue

    for (const linkedId of linkedIds) {
      const linkedOrder = orderMap.get(linkedId)
      if (!linkedOrder) continue
      const edgeKey = [item.id, linkedId].sort().join('::')
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, inferDirectedEdge(item, linkedOrder))
      }
      ensureUndirectedNode(undirected, item.id)
      ensureUndirectedNode(undirected, linkedId)
      undirected.get(item.id)?.add(linkedId)
      undirected.get(linkedId)?.add(item.id)
    }
  }

  const children = new Map<string, string[]>()
  for (const { parentId, childId } of edgeMap.values()) {
    ensureNode(children, parentId)
    ensureNode(children, childId)
    const siblings = children.get(parentId) || []
    if (!siblings.includes(childId)) {
      siblings.push(childId)
      siblings.sort((leftId, rightId) => compareWorkorders(orderMap.get(leftId)!, orderMap.get(rightId)!))
      children.set(parentId, siblings)
    }
  }

  const chains = collectComponents(undirected)
    .map(componentIds => buildComponentTimelineChain(componentIds, children, orderMap))
    .filter((chain): chain is TimelineChain => Boolean(chain))

  return chains.sort((a, b) => toTimestamp(b.startDate) - toTimestamp(a.startDate))
}

function buildComponentTimelineChain(
  componentIds: Set<string>,
  children: Map<string, string[]>,
  orderMap: Map<string, PipelineWorkOrder>,
): TimelineChain | null {
  const remaining = new Set(componentIds)
  const componentIndegree = new Map<string, number>()
  const parentIdsByNode = new Map<string, string[]>()

  for (const nodeId of componentIds) {
    componentIndegree.set(nodeId, 0)
    parentIdsByNode.set(nodeId, [])
  }

  for (const parentId of componentIds) {
    for (const childId of children.get(parentId) || []) {
      if (!componentIds.has(childId)) continue
      componentIndegree.set(childId, (componentIndegree.get(childId) || 0) + 1)
      parentIdsByNode.get(childId)?.push(parentId)
    }
  }

  let ready = Array.from(componentIds)
    .filter(nodeId => (componentIndegree.get(nodeId) || 0) === 0)
    .sort((leftId, rightId) => compareWorkorders(orderMap.get(leftId)!, orderMap.get(rightId)!))
  const levelIdsList: string[][] = []

  while (remaining.size > 0) {
    const currentLevelIds = dedupeIds(
      (ready.length > 0
        ? ready
        : Array.from(remaining)
          .sort((leftId, rightId) => compareWorkorders(orderMap.get(leftId)!, orderMap.get(rightId)!))
          .slice(0, 1))
        .filter(nodeId => remaining.has(nodeId)),
    ).sort((leftId, rightId) => compareWorkorders(orderMap.get(leftId)!, orderMap.get(rightId)!))

    if (!currentLevelIds.length) break

    levelIdsList.push(currentLevelIds)
    const nextReady = new Set<string>()

    for (const currentId of currentLevelIds) {
      remaining.delete(currentId)
    }

    for (const currentId of currentLevelIds) {
      for (const childId of children.get(currentId) || []) {
        if (!componentIds.has(childId) || !remaining.has(childId)) continue
        const nextIndegree = (componentIndegree.get(childId) || 0) - 1
        componentIndegree.set(childId, nextIndegree)
        if (nextIndegree <= 0) {
          nextReady.add(childId)
        }
      }
    }

    ready = Array.from(nextReady)
      .filter(nodeId => remaining.has(nodeId))
      .sort((leftId, rightId) => compareWorkorders(orderMap.get(leftId)!, orderMap.get(rightId)!))
  }

  const totalNodes = levelIdsList.reduce((count, levelIds) => count + levelIds.length, 0)
  if (totalNodes <= 1) return null

  const levelIndexById = new Map<string, number>()
  levelIdsList.forEach((levelIds, levelIndex) => {
    for (const id of levelIds) {
      levelIndexById.set(id, levelIndex)
    }
  })

  const levels = levelIdsList
    .map((levelIds, levelIndex) => ({
      id: `${levelIds[0] || 'level'}-${levelIndex}`,
      items: levelIds
        .map(id => orderMap.get(id))
        .filter((order): order is PipelineWorkOrder => Boolean(order))
        .map(order => ({
          workorderId: order.id,
          type: order.type,
          title: order.title,
          status: order.status,
          createdAt: order.createdAt,
          assignee: order.assignee || undefined,
          triggerReasons: buildTriggerReasons(
            order,
            parentIdsByNode.get(order.id) || [],
            orderMap,
            levelIndexById,
          ),
        })),
    }))
    .filter(level => level.items.length > 0)

  const firstItem = levels[0]?.items[0]
  if (!firstItem) return null

  return {
    id: firstItem.workorderId,
    startDate: firstItem.createdAt,
    levels,
  }
}

function buildTriggerReasons(
  order: PipelineWorkOrder,
  parentIds: string[],
  orderMap: Map<string, PipelineWorkOrder>,
  levelIndexById: Map<string, number>,
) {
  const currentLevelIndex = levelIndexById.get(order.id) ?? 0

  return dedupeIds(parentIds)
    .filter(parentId => (levelIndexById.get(parentId) ?? -1) < currentLevelIndex)
    .map(parentId => orderMap.get(parentId))
    .filter((parent): parent is PipelineWorkOrder => Boolean(parent))
    .sort(compareWorkorders)
    .map(parent => buildTriggerReason(order, parent))
}

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)))
}

function ensureUndirectedNode(undirected: Map<string, Set<string>>, id: string) {
  if (!undirected.has(id)) {
    undirected.set(id, new Set())
  }
}

function collectComponents(undirected: Map<string, Set<string>>) {
  const visited = new Set<string>()
  const components: Array<Set<string>> = []

  for (const startId of undirected.keys()) {
    if (visited.has(startId)) continue
    const queue = [startId]
    const component = new Set<string>()
    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId || visited.has(currentId)) continue
      visited.add(currentId)
      component.add(currentId)
      for (const nextId of undirected.get(currentId) || []) {
        if (!visited.has(nextId)) {
          queue.push(nextId)
        }
      }
    }
    if (component.size > 1) {
      components.push(component)
    }
  }

  return components
}

function ensureNode(children: Map<string, string[]>, id: string) {
  if (!children.has(id)) {
    children.set(id, [])
  }
}

function inferDirectedEdge(left: PipelineWorkOrder, right: PipelineWorkOrder) {
  const leftToRight = hasLinkageLog(left, right.id)
  const rightToLeft = hasLinkageLog(right, left.id)
  if (leftToRight && !rightToLeft) {
    return { parentId: left.id, childId: right.id }
  }
  if (rightToLeft && !leftToRight) {
    return { parentId: right.id, childId: left.id }
  }
  return compareWorkorders(left, right) <= 0
    ? { parentId: left.id, childId: right.id }
    : { parentId: right.id, childId: left.id }
}

function hasLinkageLog(order: PipelineWorkOrder, linkedId: string) {
  return order.executionLogs.some(log => log.stage === 'system_linkage' && containsWorkorderId(log.content, linkedId))
}

function compareWorkorders(a: PipelineWorkOrder, b: PipelineWorkOrder) {
  const createdDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
  if (createdDiff !== 0) return createdDiff
  return a.id.localeCompare(b.id)
}

function toTimestamp(value?: string) {
  const timestamp = Date.parse(value || '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function buildTriggerReason(order: PipelineWorkOrder, parent: PipelineWorkOrder) {
  const linkageLog = parent.executionLogs
    .slice()
    .reverse()
    .find(log => log.stage === 'system_linkage' && containsWorkorderId(log.content, order.id))
  if (linkageLog?.content) return linkageLog.content
  if (order.source !== 'manual') {
    return `${parent.id}: ${pipelineOpsSourceLabel[order.source] || '联动触发'}`
  }
  return `由 ${parent.id} 关联流转`
}

function containsWorkorderId(content: string, workorderId: string) {
  if (!content || !workorderId) return false
  const escapedId = escapeRegExp(workorderId)
  const exactIdPattern = new RegExp(`(^|[^A-Za-z0-9_-])${escapedId}([^A-Za-z0-9_-]|$)`)
  return exactIdPattern.test(content)
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function dedupeWorkorders(items: PipelineWorkOrder[]) {
  return Array.from(new Map(items.map(item => [item.id, item])).values())
}

function normalizeError(error: unknown): Error | null {
  if (!error) return null
  if (error instanceof Error) return error
  const message = (error as any)?.message || (error as any)?.data?.statusMessage || String(error)
  return new Error(message)
}

async function handleOpenWorkorder(id: string) {
  const currentWorkorderId = typeof route.query.workorderId === 'string' ? route.query.workorderId : ''
  const { workorderId: _ignored, ...restQuery } = route.query

  if (currentWorkorderId === id) {
    await router.replace({ query: restQuery })
  }

  await router.replace({
    query: {
      ...restQuery,
      workorderId: id,
    },
  })
}
</script>

<style scoped>
.ops-linkage-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.ops-linkage-view__notice {
  border: 1px solid #ffcdcd;
  border-radius: 10px;
  background: #fff2f2;
  color: #af2c2c;
  padding: 10px 12px;
  font-size: 12px;
}

.ops-linkage-view__notice--warn {
  border-color: #f2d39a;
  background: #fff8e9;
  color: #8f5a00;
}
</style>
