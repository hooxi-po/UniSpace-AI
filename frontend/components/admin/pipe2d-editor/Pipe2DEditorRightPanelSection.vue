<script setup lang="ts">
import { ChevronDown, ChevronRight, House, PanelRightClose } from 'lucide-vue-next'
import { computed } from 'vue'
import type { SelectedElement } from '~/composables/admin/usePipe2DEditorGraph'
import type { EdgeAttributes, NodeAttributes, NodeType, PipeGraph } from '~/utils/pipe2d-graph'
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
  activeLineLengthText: string
  activeLineIndex: number
  selectedPointLabel: string
  zoomLevel: number
  isDirty: boolean
  // 图结构属性面板（可选）
  graph?: PipeGraph | null
  graphSelected?: SelectedElement
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
  // 图结构操作
  (e: 'update-node', nodeId: string, attrs: NodeAttributes): void
  (e: 'update-node-type', nodeId: string, type: NodeType): void
  (e: 'update-edge', edgeId: string, attrs: EdgeAttributes): void
  (e: 'toggle-edge-curve', edgeId: string): void
  (e: 'remove-node', nodeId: string): void
  (e: 'remove-edge', edgeId: string): void
}>()

const relationNamesModel = computed({
  get: () => props.relationActiveNames,
  set: (value: string[]) => emit('update:relation-active-names', value),
})

function onSelectFeature(event: Event) {
  emit('update:selected-feature-id', (event.target as HTMLSelectElement).value)
}

function pipeOptionLabel(feature: PipeFeature) {
  const p = feature.properties || {}
  const name = String(p.name || p.ref || feature.id)
  return `${String(feature.id)} · ${name}`
}

function formatDateTime(value: string) {
  const ts = new Date(value)
  if (Number.isNaN(ts.getTime())) return value || '-'
  return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <aside class="right-panel">
    <div class="right-panel__head">
      <div class="panel-header">
        <div class="title">
          管道 <span class="id">{{ selectedPipeIdText }}</span>
        </div>
        <span class="tag">{{ selectedFeatureTypeTag }}</span>
        <div v-if="selectedFeature" class="right-panel__sub">{{ displayPipeName }}</div>
      </div>
      <button class="icon-btn" type="button" title="收起面板" @click="emit('collapse-panel')">
        <PanelRightClose :size="16" />
      </button>
    </div>

    <!-- 图结构节点/管段属性面板 -->
    <Pipe2DEditorGraphPanel
      v-if="graph && graphSelected"
      :graph="graph"
      :selected="graphSelected"
      @update-node="(id, attrs) => emit('update-node', id, attrs)"
      @update-node-type="(id, type) => emit('update-node-type', id, type)"
      @update-edge="(id, attrs) => emit('update-edge', id, attrs)"
      @toggle-edge-curve="(id) => emit('toggle-edge-curve', id)"
      @remove-node="(id) => emit('remove-node', id)"
      @remove-edge="(id) => emit('remove-edge', id)"
    />

    <section class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'basic')">
        <span>基本信息</span>
        <component :is="panelSectionCollapsed.basic ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.basic" class="panel-section-body">
        <select :value="selectedFeatureId" class="pipe-select" :disabled="loading || !pipes.length" @change="onSelectFeature">
          <option v-for="item in pipes" :key="String(item.id)" :value="String(item.id)">
            {{ pipeOptionLabel(item) }}
          </option>
        </select>
        <div class="panel-row-actions">
          <button class="btn btn--sm" type="button" :disabled="loading" @click="emit('refresh')">刷新</button>
          <button class="btn btn--sm" type="button" :disabled="saving || !selectedFeature" @click="emit('focus')">聚焦</button>
        </div>
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
        <div class="panel-meta"><span>编号</span><strong>{{ selectedFeature ? String(selectedFeature.id) : '-' }}</strong></div>
        <div class="panel-meta"><span>几何</span><strong>{{ selectedFeature?.geometry?.type || '-' }}</strong></div>
        <div class="panel-meta"><span>草稿</span><strong>{{ draftStatusText }}</strong></div>
      </div>
    </section>

    <section class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'relation')">
        <span>关联关系</span>
        <component :is="panelSectionCollapsed.relation ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.relation" class="panel-section-body">
        <div class="panel-meta"><span>关联楼宇</span><strong>{{ linkedBuildingCount }}</strong></div>
        <div class="panel-meta"><span>关联房间</span><strong>{{ impactedRoomCount }}</strong></div>
        <el-collapse v-model="relationNamesModel" class="relation-collapse">
          <el-collapse-item title="追踪链路段" name="traceSegments">
            <div class="panel-meta"><span>链路段数量</span><strong>{{ tracedSegmentCount }}</strong></div>
          </el-collapse-item>
          <el-collapse-item title="网络节点" name="networkNodes">
            <div class="panel-meta"><span>节点数量</span><strong>{{ tracedNodeCount }}</strong></div>
          </el-collapse-item>
        </el-collapse>
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

    <section class="panel-card">
      <button class="panel-collapse-toggle" type="button" @click="emit('toggle-section', 'control')">
        <span>编辑控制</span>
        <component :is="panelSectionCollapsed.control ? ChevronRight : ChevronDown" :size="16" />
      </button>
      <div v-show="!panelSectionCollapsed.control" class="panel-section-body">
        <div class="panel-row-actions">
          <button
            :class="['btn btn--sm', { 'btn--active': addPointMode }]"
            type="button"
            :disabled="saving || !selectedFeature"
            @click="emit('toggle-add-point-mode')"
          >
            节点编辑
          </button>
          <button class="btn btn--sm" type="button" :disabled="saving || !selectedFeature" @click="emit('insert-center-point')">中心加点</button>
        </div>
        <div class="panel-row-actions">
          <button
            :class="['btn btn--sm', { 'btn--danger': deletePointMode }]"
            type="button"
            :disabled="saving || !selectedFeature"
            @click="emit('toggle-delete-point-mode')"
          >
            删除模式
          </button>
          <button class="btn btn--sm" type="button" :disabled="saving || !canDeletePoint" @click="emit('delete-selected-point')">删除选中点</button>
        </div>
        <div class="panel-row-actions">
          <button :class="['btn btn--sm', { 'btn--active': snapEnabled }]" type="button" :disabled="saving" @click="emit('toggle-snap')">
            {{ snapEnabled ? '端点吸附 开' : '端点吸附 关' }}
          </button>
          <button class="btn btn--sm" type="button" :disabled="saving" @click="emit('toggle-scene-mode')">{{ sceneMode === '2d' ? '切换3D' : '切换2D' }}</button>
        </div>
      </div>
    </section>

    <section class="panel-card">
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

    <section class="panel-card">
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
        <div class="panel-meta"><span>节点总数</span><strong>{{ totalPoints }}</strong></div>
        <div class="panel-meta"><span>管段总数</span><strong>{{ segmentCount }}</strong></div>
        <div class="panel-meta"><span>总长度</span><strong>{{ totalLengthText }}</strong></div>
        <div class="panel-meta"><span>当前线段</span><strong>{{ activeLineLengthText }}</strong></div>
        <div class="panel-meta"><span>活动线索引</span><strong>{{ activeLineIndex + 1 }}</strong></div>
        <div class="panel-meta"><span>选中节点</span><strong>{{ selectedPointLabel }}</strong></div>
        <div class="panel-meta"><span>视图缩放</span><strong>Z{{ zoomLevel }}</strong></div>
      </div>
    </section>

    <div class="panel-footer">
      <button class="btn" type="button" :disabled="saving" @click="emit('reset-draft')">取消</button>
      <button class="btn btn--primary" type="button" :disabled="!selectedFeature || !isDirty || saving" @click="emit('save-geometry')">
        {{ saving ? '保存中...' : '保存修改' }}
      </button>
    </div>
  </aside>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
