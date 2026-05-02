<template>
  <div class="pipe-editor-route">
    <div v-if="currentWorkorderId" class="pipe-editor-route__context">
      <div class="pipe-editor-route__context-main">
        <div class="pipe-editor-route__context-label">来源工单</div>
        <div class="pipe-editor-route__context-title">
          <template v-if="workorderLoading">正在加载工单上下文...</template>
          <template v-else-if="workorderDetail">{{ workorderDetail.id }} · {{ workorderDetail.title }}</template>
          <template v-else>{{ currentWorkorderId }}</template>
        </div>
        <div class="pipe-editor-route__context-meta">
          <template v-if="workorderDetail">
            <span>{{ typeLabel[workorderDetail.type] }}</span>
            <span>{{ statusLabel[workorderDetail.status] }}</span>
            <span>{{ mediumLabel[workorderDetail.pipelineMedium] }}</span>
          </template>
          <span v-else-if="workorderError">{{ workorderError }}</span>
          <span v-else>已从工单反向打开管网二维运维工作台</span>
        </div>
      </div>

      <div class="pipe-editor-route__context-actions">
        <button class="pipe-editor-route__button" type="button" @click="openWorkorderBoard">
          返回工单看板
        </button>
        <button class="pipe-editor-route__button pipe-editor-route__button--primary" type="button" @click="openWorkorderMap">
          打开工单地图定位
        </button>
      </div>
    </div>

    <Pipe2DEditorDialog
      :open="true"
      standalone
      :backend-base-url="backendBaseUrl"
      :initial-feature-id="initialFeatureId"
      :source-workorder-id="currentWorkorderId || undefined"
      @close="closeEditor"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Pipe2DEditorDialog from '~/components/admin/Pipe2DEditorDialog.vue'
import { pipelineOpsMediumLabel, pipelineOpsStatusLabel, pipelineOpsTypeLabel } from '~/components/admin/ops/pipeline-ops-view-constants'
import { pipelineOpsService } from '~/services/pipeline-ops'
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'

definePageMeta({
  path: '/admin/pipe-editor',
})

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const closing = ref(false)
const workorderLoading = ref(false)
const workorderError = ref('')
const workorderDetail = ref<PipelineWorkOrder | null>(null)

const backendBaseUrl = normalizeBackendBaseUrl(runtimeConfig.public.backendBaseUrl as string | undefined)
const typeLabel = pipelineOpsTypeLabel
const statusLabel = pipelineOpsStatusLabel
const mediumLabel = pipelineOpsMediumLabel
const WORKORDER_BOARD_QUERY = {
  tab: 'ops',
  sub: 'ops_linkage',
  third: 'ops_linkage_board',
} as const

const routeFeatureId = computed(() => {
  const raw = route.query.featureId
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
})

const currentWorkorderId = computed(() => {
  const raw = route.query.workorderId
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  return trimmed || ''
})

const workorderFeatureId = computed(() => {
  const item = workorderDetail.value
  if (!item) return null
  const fallbackSegment = item.topologyChain.find(id => {
    const normalized = String(id || '').trim()
    return normalized.length > 0 && !normalized.startsWith('N-')
  })
  if (fallbackSegment) return fallbackSegment
  return item.segmentIds[0] || null
})

const initialFeatureId = computed(() => routeFeatureId.value || workorderFeatureId.value)

watch(
  currentWorkorderId,
  async (id) => {
    if (!id) {
      workorderDetail.value = null
      workorderError.value = ''
      workorderLoading.value = false
      return
    }

    workorderLoading.value = true
    workorderError.value = ''
    try {
      const result = await pipelineOpsService.fetchWorkorder(id)
      if (currentWorkorderId.value !== id) return
      workorderDetail.value = result.workorder
    } catch (error) {
      if (currentWorkorderId.value !== id) return
      workorderDetail.value = null
      workorderError.value = error instanceof Error ? error.message : '工单上下文加载失败'
    } finally {
      if (currentWorkorderId.value === id) {
        workorderLoading.value = false
      }
    }
  },
  { immediate: true },
)

function closeEditor() {
  if (closing.value) return
  closing.value = true
  const target = currentWorkorderId.value
    ? {
      path: '/admin',
      query: {
        ...WORKORDER_BOARD_QUERY,
        workorderId: currentWorkorderId.value,
      },
    }
    : { path: '/admin' }
  if (typeof window !== 'undefined') {
    const query = target.query ? `?${new URLSearchParams(target.query as Record<string, string>).toString()}` : ''
    window.location.assign(`${target.path}${query}`)
    return
  }
  void router.replace(target).finally(() => {
    closing.value = false
  })
}

function handleSaved(id: string) {
  const query = { ...route.query, featureId: id }
  void router.replace({ path: route.path, query })
}

function openWorkorderBoard() {
  void router.push({
    path: '/admin',
    query: {
      ...WORKORDER_BOARD_QUERY,
      workorderId: currentWorkorderId.value || undefined,
    },
  })
}

function openWorkorderMap() {
  const item = workorderDetail.value
  if (!item || typeof window === 'undefined') return
  const focusBuilding = item.buildingId || item.impactScope.impactedBuildings[0]?.buildingId || ''
  const focusNode = item.nodeIds[0] || ''
  const focusSegment = item.segmentIds[0] || ''
  const focusId = focusBuilding || focusNode || focusSegment || item.id
  const focusRooms = item.impactScope.impactedBuildings
    .flatMap(building => building.rooms.map(room => room.roomId).filter(Boolean))
    .slice(0, 8)

  const query = new URLSearchParams({
    focusId,
    fromWorkorder: item.id,
    focusBuilding,
    focusNode,
    focusSegment,
    focusRooms: focusRooms.join(','),
  })
  window.open(`/?${query.toString()}`, '_blank')
}
</script>

<style scoped>
.pipe-editor-route {
  height: 100vh;
  min-height: 720px;
  padding: 12px;
  background: #f5f6f8;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.pipe-editor-route__context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92));
  color: #e2e8f0;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.pipe-editor-route__context-main {
  min-width: 0;
}

.pipe-editor-route__context-label {
  font-size: 12px;
  color: rgba(125, 211, 252, 0.92);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.pipe-editor-route__context-title {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
}

.pipe-editor-route__context-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: rgba(148, 163, 184, 0.92);
  font-size: 12px;
}

.pipe-editor-route__context-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pipe-editor-route__button {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.68);
  color: #e2e8f0;
  padding: 0 14px;
  font-size: 13px;
}

.pipe-editor-route__button--primary {
  border-color: rgba(34, 211, 238, 0.3);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.92), rgba(34, 197, 94, 0.88));
  color: #f8fafc;
}

@media (max-width: 900px) {
  .pipe-editor-route__context {
    flex-direction: column;
    align-items: stretch;
  }

  .pipe-editor-route__context-actions {
    justify-content: stretch;
  }
}
</style>
