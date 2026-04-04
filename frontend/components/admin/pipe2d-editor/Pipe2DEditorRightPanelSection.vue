<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, ChevronRight, House, PanelRightClose } from 'lucide-vue-next'
import type { SelectedElement } from '~/composables/admin/usePipe2DEditorGraph'
import type { EdgeAttributes, NodeAttributes, NodeType, PipeGraph, PipeNode } from '~/utils/pipe2d-graph'
import Pipe2DEditorGraphPanel from './Pipe2DEditorGraphPanel.vue'

type PanelSectionKey = 'basic' | 'relation' | 'control' | 'realtime' | 'timeline' | 'runtime'

type PipeFeature = {
  id: string | number
  geometry?: { type?: string }
  properties?: Record<string, unknown>
}

type TelemetryItem = {
  pointId: string
  metric: string
  value: number
  unit: string
  sampledAt: string
}

type AuditLog = {
  id: string
  action: string
  changedAt: string
  changedBy?: string | null
}

const props = defineProps<{
  selectedFeature: PipeFeature | null
  selectedFeatureId: string
  pipes: PipeFeature[]
  loading: boolean
  saving: boolean
  displayPipeName: string
  selectedPipeIdText: string
  selectedFeatureTypeTag: string
  renaming: boolean
  renameDraft: string
  renamingSaving: boolean
  draftStatusText: string
  panelSectionCollapsed: Record<PanelSectionKey, boolean>
  relationActiveNames: string[]
  linkedBuildingCount: number
  impactedRoomCount: number
  tracedSegmentCount: number
  tracedNodeCount: number
  linkedBuildingLabels: string[]
  insightError: string | null
  addPointMode: boolean
  deletePointMode: boolean
  canDeletePoint: boolean
  snapEnabled: boolean
  sceneMode: string
  telemetrySeries: TelemetryItem[]
  telemetryPolylinePoints: string
  telemetryMinText: string
  telemetryLatestText: string
  telemetryMaxText: string
  telemetryList: TelemetryItem[]
  auditLogs: AuditLog[]
  totalPoints: number
  segmentCount: number
  totalLengthText: string
  globalSegmentCount: number
  activeLineLengthText: string
  activeLineIndex: number
  selectedPointLabel: string
  zoomLevel: number
  isDirty: boolean
  globalPipeCount: number
  globalNodeCount: number
  globalTotalLengthText: string
  graph?: PipeGraph | null
  graphSelected?: SelectedElement | null
}>()

const emit = defineEmits<{
  (e: 'collapse-panel'): void
  (e: 'toggle-section', key: PanelSectionKey): void
  (e: 'update:selected-feature-id', value: string): void
  (e: 'refresh'): void
  (e: 'focus'): void
  (e: 'start-rename'): void
  (e: 'update:rename-draft', value: string): void
  (e: 'commit-rename'): void
  (e: 'cancel-rename'): void
  (e: 'toggle-add-point-mode'): void
  (e: 'insert-center-point'): void
  (e: 'toggle-delete-point-mode'): void
  (e: 'delete-selected-point'): void
  (e: 'toggle-snap'): void
  (e: 'toggle-scene-mode'): void
  (e: 'update:relation-active-names', value: string[]): void
  (e: 'reset-draft'): void
  (e: 'save-geometry'): void
  (e: 'update-node', nodeId: string, attrs: NodeAttributes): void
  (e: 'update-node-type', nodeId: string, type: NodeType): void
  (e: 'update-edge', edgeId: string, attrs: EdgeAttributes): void
  (e: 'toggle-edge-curve', edgeId: string): void
  (e: 'remove-node', nodeId: string): void
  (e: 'remove-edge', edgeId: string): void
}>()

const selectedGraphNode = computed<PipeNode | null>(() => {
  const selected = props.graphSelected
  const graph = props.graph
  if (!selected || !graph || selected.kind !== 'node') return null
  return graph.nodes.find(node => node.id === selected.nodeId) ?? null
})

const selectedGraphEdge = computed(() => {
  const selected = props.graphSelected
  const graph = props.graph
  if (!selected || !graph || selected.kind !== 'edge') return null
  return graph.edges.find(edge => edge.id === selected.edgeId) ?? null
})

const showRelationPanel = computed(() => Boolean(props.selectedFeature) && !selectedGraphEdge.value)
const showRealtimePanel = computed(() => {
  return Boolean(props.selectedFeature) && !selectedGraphEdge.value
})
const showTimelinePanel = computed(() => Boolean(props.selectedFeature) && !selectedGraphEdge.value)

function onSelectFeature(event: Event) {
  emit('update:selected-feature-id', (event.target as HTMLSelectElement).value)
}

function pipeOptionLabel(feature: PipeFeature) {
  const properties = feature.properties || {}
  const name = String(properties.name || properties.ref || feature.id)
  return `${String(feature.id)} · ${name}`
}

function formatDateTime(value: string) {
  const ts = new Date(value)
  if (Number.isNaN(ts.getTime())) return value || '-'
  return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`
}

function handleUpdateNode(nodeId: string, attrs: NodeAttributes) {
  emit('update-node', nodeId, attrs)
}

function handleUpdateNodeType(nodeId: string, type: NodeType) {
  emit('update-node-type', nodeId, type)
}

function handleUpdateEdge(edgeId: string, attrs: EdgeAttributes) {
  emit('update-edge', edgeId, attrs)
}

function handleToggleEdgeCurve(edgeId: string) {
  emit('toggle-edge-curve', edgeId)
}

function handleRemoveNode(nodeId: string) {
  emit('remove-node', nodeId)
}

function handleRemoveEdge(edgeId: string) {
  emit('remove-edge', edgeId)
}
</script>

<template>
  <aside class="right-panel">
    <div class="right-panel__head">
      <div class="panel-header">
        <div class="title" :title="displayPipeName">{{ displayPipeName }}</div>
        <div class="right-panel__sub">
          <span class="tag">{{ selectedFeatureTypeTag }}</span>
          <span class="id">ID {{ selectedPipeIdText }}</span>
        </div>
      </div>
      <button class="icon-btn" type="button" title="收起面板" @click="emit('collapse-panel')">
        <PanelRightClose :size="16" />
      </button>
    </div>

    <Pipe2DEditorGraphPanel
      v-if="graph && graphSelected"
      :graph="graph"
      :selected="graphSelected"
      @update-node="handleUpdateNode"
      @update-node-type="handleUpdateNodeType"
      @update-edge="handleUpdateEdge"
      @toggle-edge-curve="handleToggleEdgeCurve"
      @remove-node="handleRemoveNode"
      @remove-edge="handleRemoveEdge"
    />

    <section class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'basic')">
        <span>基本信息</span>
        <component :is="panelSectionCollapsed.basic ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.basic" class="panel-section-body">
        <select :value="selectedFeatureId" class="pipe-select" :disabled="loading || !pipes.length" @change="onSelectFeature">
          <option value="">全部管线 / 总览</option>
          <option v-for="item in pipes" :key="String(item.id)" :value="String(item.id)">
            {{ pipeOptionLabel(item) }}
          </option>
        </select>
        <div class="panel-row-actions">
          <button class="btn btn--sm" type="button" :disabled="loading" @click="emit('refresh')">刷新</button>
          <button class="btn btn--sm" type="button" :disabled="saving || !selectedFeature" @click="emit('focus')">聚焦</button>
        </div>

        <template v-if="selectedFeature">
          <div class="panel-field">
            <label>管道名称</label>
            <button
              v-if="!renaming"
              class="name-btn"
              type="button"
              :disabled="!selectedFeature"
              @click="emit('start-rename')"
            >
              {{ displayPipeName }}
            </button>
            <input
              v-else
              :value="renameDraft"
              class="name-input"
              maxlength="64"
              :disabled="renamingSaving"
              autofocus
              @input="emit('update:rename-draft', ($event.target as HTMLInputElement).value.trim())"
              @blur="emit('commit-rename')"
              @keydown.enter.prevent="emit('commit-rename')"
              @keydown.esc.prevent="emit('cancel-rename')"
            >
          </div>
          <div class="panel-meta"><span>编号</span><strong>{{ String(selectedFeature.id) }}</strong></div>
          <div class="panel-meta"><span>几何</span><strong>{{ selectedFeature.geometry?.type || '-' }}</strong></div>
          <div class="panel-meta"><span>草稿</span><strong>{{ draftStatusText }}</strong></div>
        </template>

        <template v-else>
          <div class="panel-summary">
            <div class="panel-summary__title">全局统计</div>
            <div class="panel-summary__grid">
              <div class="panel-summary__item">
                <span>管线总数</span>
                <strong>{{ globalPipeCount }}</strong>
              </div>
              <div class="panel-summary__item">
                <span>节点总数</span>
                <strong>{{ globalNodeCount }}</strong>
              </div>
              <div class="panel-summary__item panel-summary__item--wide">
                <span>总长度</span>
                <strong>{{ globalTotalLengthText }}</strong>
              </div>
            </div>
          </div>
          <div class="inline-empty inline-empty--compact">从顶部搜索或下拉框选择具体管线后开始编辑</div>
        </template>
      </div>
    </section>

    <section v-if="showRelationPanel" class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'relation')">
        <span>关联关系</span>
        <component :is="panelSectionCollapsed.relation ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.relation" class="panel-section-body">
        <div class="panel-meta"><span>关联楼宇</span><strong>{{ linkedBuildingCount }}</strong></div>
        <div class="panel-meta"><span>关联房间</span><strong>{{ impactedRoomCount }}</strong></div>
        <div class="panel-meta"><span>链路段数量</span><strong>{{ tracedSegmentCount }}</strong></div>
        <div class="panel-meta"><span>节点数量</span><strong>{{ tracedNodeCount }}</strong></div>
        <div v-if="linkedBuildingLabels.length" class="token-wrap">
          <span v-for="label in linkedBuildingLabels" :key="label" class="token">{{ label }}</span>
        </div>
        <div v-if="insightError" class="panel-empty-state">
          <House class="empty-icon" :size="18" />
          <div>暂无数据</div>
          <div class="tip">点击左侧工具栏开始绑定房产</div>
        </div>
      </div>
    </section>

    <section v-if="showRealtimePanel" class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'realtime')">
        <span>实时数据</span>
        <component :is="panelSectionCollapsed.realtime ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.realtime" class="panel-section-body">
        <div v-if="telemetrySeries.length" class="telemetry-chart">
          <svg viewBox="0 0 320 92" preserveAspectRatio="none" class="telemetry-svg">
            <polyline
              class="telemetry-line"
              :points="telemetryPolylinePoints"
              fill="none"
              stroke-width="2"
            />
          </svg>
          <div class="telemetry-legend">
            <span>最小 {{ telemetryMinText }}</span>
            <strong>{{ telemetryLatestText }}</strong>
            <span>最大 {{ telemetryMaxText }}</span>
          </div>
        </div>
        <div v-else class="inline-empty">暂无实时测点数据</div>
        <ul v-if="telemetryList.length" class="telemetry-list">
          <li v-for="item in telemetryList.slice(0, 6)" :key="`${item.pointId}-${item.sampledAt}`">
            <span>{{ item.metric }}</span>
            <strong>{{ item.value }} {{ item.unit }}</strong>
            <em>{{ formatDateTime(item.sampledAt) }}</em>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="showTimelinePanel" class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'timeline')">
        <span>运维记录</span>
        <component :is="panelSectionCollapsed.timeline ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.timeline" class="panel-section-body">
        <ul v-if="auditLogs.length" class="timeline-list">
          <li v-for="item in auditLogs.slice(0, 8)" :key="item.id" class="timeline-item">
            <span class="timeline-dot" />
            <div class="timeline-body">
              <div class="timeline-title">{{ item.action }}</div>
              <div class="timeline-meta">{{ formatDateTime(item.changedAt) }} · {{ item.changedBy || 'system' }}</div>
            </div>
          </li>
        </ul>
        <div v-else class="inline-empty">暂无运维记录</div>
      </div>
    </section>

    <section class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'runtime')">
        <span>运行信息</span>
        <component :is="panelSectionCollapsed.runtime ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.runtime" class="panel-section-body">
        <template v-if="selectedFeature">
          <div v-if="selectedGraphEdge" class="panel-note">已选中管段，右侧仅保留与当前编辑最相关的运行信息。</div>
          <div class="panel-meta"><span>节点总数</span><strong>{{ totalPoints }}</strong></div>
          <div class="panel-meta"><span>管段总数</span><strong>{{ segmentCount }}</strong></div>
          <div class="panel-meta"><span>总长度</span><strong>{{ totalLengthText }}</strong></div>
          <div class="panel-meta"><span>当前线段</span><strong>{{ activeLineLengthText }}</strong></div>
          <div class="panel-meta"><span>活动线索引</span><strong>{{ activeLineIndex + 1 }}</strong></div>
          <div class="panel-meta"><span>选中节点</span><strong>{{ selectedPointLabel }}</strong></div>
          <div class="panel-meta"><span>视图缩放</span><strong>Z{{ zoomLevel }}</strong></div>
        </template>
        <template v-else>
          <div class="panel-note">当前为管网总览模式，运行信息切换为全局统计。</div>
          <div class="panel-meta"><span>管线总数</span><strong>{{ globalPipeCount }}</strong></div>
          <div class="panel-meta"><span>节点总数</span><strong>{{ globalNodeCount }}</strong></div>
          <div class="panel-meta"><span>管段总数</span><strong>{{ globalSegmentCount }}</strong></div>
          <div class="panel-meta"><span>总长度</span><strong>{{ globalTotalLengthText }}</strong></div>
          <div class="panel-meta"><span>视图缩放</span><strong>Z{{ zoomLevel }}</strong></div>
        </template>
      </div>
    </section>
  </aside>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
