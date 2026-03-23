<template>
  <div v-if="open" class="dialog modao-editor">
    <div class="dialog__mask" @click="emit('close')" />
    <div class="dialog__panel" @click.stop>
      <header class="topbar">
        <div class="topbar__left">
          <div class="project-group">
            <button
              v-if="!editingProjectTitle"
              class="project-name-btn"
              type="button"
              @click="startEditProjectTitle"
            >
              {{ projectTitle }}
            </button>
            <input
              v-else
              ref="projectTitleInputRef"
              v-model.trim="projectTitleDraft"
              class="project-name-input"
              maxlength="48"
              @blur="commitProjectTitle"
              @keydown.enter.prevent="commitProjectTitle"
              @keydown.esc.prevent="cancelProjectTitle"
            >
            <div :class="['save-chip', saveStatusClass]">
              <Loader2 v-if="saving" :size="14" class="spin" />
              <span v-else class="save-dot" />
              <span>{{ saveStatusText }}</span>
            </div>
          </div>
        </div>

        <div class="topbar__main">
          <div class="topbar__center">
            <label class="select-wrap">
              <span>视图</span>
              <select class="view-select" :value="viewMode" @change="onViewModeChange">
                <option v-for="item in viewModeOptions" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <button class="btn btn--ai" type="button" @click="showPlanned('AI智能助手')">
              <span class="btn--ai__spark">✦</span>
              <span class="btn--ai__text">AI 助手</span>
            </button>
          </div>

          <div class="topbar__right">
            <button class="icon-btn" type="button" :disabled="saving || !canUndo" title="撤销 (Ctrl/Cmd+Z)" @click="undoLast">
              <RotateCcw :size="18" />
            </button>
            <button class="icon-btn" type="button" :disabled="saving || !canRedo" title="重做 (Ctrl/Cmd+Y)" @click="redoLast">
              <RefreshCw :size="18" />
            </button>
            <button class="icon-btn" type="button" title="一键美化布局" @click="showPlanned('一键美化布局')">
              <Zap :size="18" />
            </button>
            <button class="icon-btn" type="button" title="分享" @click="showPlanned('分享')">
              <Send :size="18" />
            </button>
            <button class="icon-btn icon-btn--close" type="button" title="关闭" @click="emit('close')">
              <X :size="18" />
            </button>
          </div>
        </div>
      </header>

      <div class="workspace">
        <aside class="left-toolbar">
          <div class="tool-mode-hint">当前：{{ activeToolLabel }}</div>
          <button
            v-for="tool in toolItems"
            :key="tool.key"
            :class="['tool-btn', { 'tool-btn--active': activeTool === tool.key }]"
            :data-tip="`${tool.label} (${tool.shortcut})`"
            type="button"
            :disabled="saving"
            @pointerdown="startToolbarDrag(tool.key, $event)"
            @click="selectTool(tool.key)"
          >
            <component :is="tool.icon" :size="20" :stroke-width="2" />
            <span class="tool-btn__bar" />
          </button>
        </aside>

        <section
          :class="['stage', `stage--skin-${canvasSkin}`, { 'stage--drop-target': toolbarDrag.active && toolbarDrag.overCanvas }]"
          @pointerdown="hideContextMenu"
        >
          <div ref="mapContainerRef" :class="canvasClass" @contextmenu.prevent />

          <div
            v-if="toolbarDrag.active"
            :class="['drop-guide', toolbarDrag.overCanvas ? 'drop-guide--active' : '']"
          >
            {{ toolbarDrag.overCanvas ? `释放以放置 ${toolbarDragLabel}` : `拖拽 ${toolbarDragLabel} 到画布放置` }}
          </div>

          <div v-if="activeToolHint" class="canvas-hint">{{ activeToolHint }}</div>
          <div v-if="loading" class="state-overlay">加载管道中...</div>
          <div v-else-if="loadError" class="state-overlay state-overlay--error">{{ loadError }}</div>

          <div v-if="!loading && !loadError && !selectedFeature" class="empty-state">
            <div class="empty-state__title">从左侧工具开始编辑</div>
            <div class="empty-state__sub">支持拖拽工具到画布快速放置，也可直接点选工具后点击地图</div>
            <button class="btn" type="button" @click="showPlanned('示例模板导入')">导入示例模板</button>
          </div>

          <div v-if="mapError" class="state-overlay state-overlay--error state-overlay--bottom">{{ mapError }}</div>
          <div v-if="snapHintVisible" class="snap-toast">已吸附到邻近端点</div>

          <div
            v-if="hoverLengthHint.visible"
            class="hover-length"
            :style="{ left: `${hoverLengthHint.x}px`, top: `${hoverLengthHint.y}px` }"
          >
            {{ hoverLengthHint.text }}
          </div>

          <div v-if="saveSuccessVisible" class="save-success">保存成功</div>

          <div
            v-if="actionMessage"
            :class="['action-toast', actionMessage.type === 'error' ? 'action-toast--error' : 'action-toast--ok']"
          >
            {{ actionMessage.text }}
          </div>

          <div class="zoom-control">
            <button class="zoom-control__btn" type="button" :disabled="saving" @click="zoomOut">-</button>
            <input
              class="zoom-control__slider"
              type="range"
              min="14"
              max="20"
              step="1"
              :value="mapView.zoom"
              @input="onZoomSliderInput"
            >
            <button class="zoom-control__btn" type="button" :disabled="saving" @click="zoomIn">+</button>
            <button class="zoom-control__reset" type="button" :disabled="saving" @click="resetZoomToHundred">100%</button>
            <span class="zoom-control__value">{{ zoomPercentText }}</span>
          </div>

          <div v-if="draftRestoredToastVisible" class="draft-toast">已恢复本地草稿</div>

          <ul
            v-if="contextMenu.visible"
            class="stage-menu"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
            @pointerdown.stop
          >
            <li><button class="stage-menu__item" type="button" :disabled="!contextMenu.canDelete" @click="handleMenuDelete">删除</button></li>
            <li><button class="stage-menu__item" type="button" @click="handleMenuCopy">复制</button></li>
            <li><button class="stage-menu__item" type="button" @click="handleMenuBindAsset">绑定房产</button></li>
            <li><button class="stage-menu__item" type="button" @click="handleMenuTrace">查看链路</button></li>
          </ul>
        </section>

        <button v-if="panelCollapsed" class="panel-expand" type="button" @click="panelCollapsed = false">
          <PanelRightOpen :size="16" />
          属性
        </button>

        <aside v-else class="right-panel">
          <div class="right-panel__head">
            <div>
              <div class="right-panel__name">{{ panelTitle }}</div>
              <div v-if="selectedFeature" class="right-panel__sub">{{ displayPipeName }}</div>
              <span class="right-panel__tag">{{ selectedFeatureTypeTag }}</span>
            </div>
            <button class="icon-btn" type="button" title="收起面板" @click="panelCollapsed = true">
              <PanelRightClose :size="16" />
            </button>
          </div>

          <section class="panel-card">
            <button class="panel-collapse-toggle" type="button" @click="togglePanelSection('basic')">
              <span>基本信息</span>
              <component :is="panelSectionCollapsed.basic ? ChevronRight : ChevronDown" :size="16" />
            </button>
            <div v-show="!panelSectionCollapsed.basic" class="panel-section-body">
              <select v-model="selectedFeatureId" class="pipe-select" :disabled="loading || !pipes.length">
                <option v-for="item in pipes" :key="String(item.id)" :value="String(item.id)">
                  {{ pipeOptionLabel(item) }}
                </option>
              </select>
              <div class="panel-row-actions">
                <button class="btn btn--sm" type="button" :disabled="loading" @click="loadPipes">刷新</button>
                <button class="btn btn--sm" type="button" :disabled="saving || !selectedFeature" @click="fitCurrentPipeView">聚焦</button>
              </div>
              <div class="panel-field">
                <label>管道名称</label>
                <button
                  v-if="!renaming"
                  class="name-btn"
                  type="button"
                  :disabled="!selectedFeature"
                  @click="startRename"
                >
                  {{ displayPipeName }}
                </button>
                <input
                  v-else
                  ref="renameInputRef"
                  v-model.trim="renameDraft"
                  class="name-input"
                  maxlength="64"
                  :disabled="renamingSaving"
                  @blur="commitRename"
                  @keydown.enter.prevent="commitRename"
                  @keydown.esc.prevent="cancelRename"
                >
              </div>
              <div class="panel-meta"><span>编号</span><strong>{{ selectedFeature ? String(selectedFeature.id) : '-' }}</strong></div>
              <div class="panel-meta"><span>几何</span><strong>{{ selectedFeature?.geometry?.type || '-' }}</strong></div>
              <div class="panel-meta"><span>草稿</span><strong>{{ draftStatusText }}</strong></div>
            </div>
          </section>

          <section class="panel-card">
            <button class="panel-collapse-toggle" type="button" @click="togglePanelSection('relation')">
              <span>关联关系</span>
              <component :is="panelSectionCollapsed.relation ? ChevronRight : ChevronDown" :size="16" />
            </button>
            <div v-show="!panelSectionCollapsed.relation" class="panel-section-body">
              <div class="panel-meta"><span>关联楼宇</span><strong>{{ linkedBuildingCount }}</strong></div>
              <div class="panel-meta"><span>关联房间</span><strong>{{ impactedRoomCount }}</strong></div>
              <div class="sub-collapse">
                <button class="sub-collapse__toggle" type="button" @click="toggleRelationDetail('traceSegments')">
                  <span>追踪链路段</span>
                  <component :is="relationDetailCollapsed.traceSegments ? ChevronRight : ChevronDown" :size="14" />
                </button>
                <div v-show="!relationDetailCollapsed.traceSegments" class="sub-collapse__body">
                  <div class="panel-meta"><span>链路段数量</span><strong>{{ tracedSegmentCount }}</strong></div>
                </div>
              </div>
              <div class="sub-collapse">
                <button class="sub-collapse__toggle" type="button" @click="toggleRelationDetail('networkNodes')">
                  <span>网络节点</span>
                  <component :is="relationDetailCollapsed.networkNodes ? ChevronRight : ChevronDown" :size="14" />
                </button>
                <div v-show="!relationDetailCollapsed.networkNodes" class="sub-collapse__body">
                  <div class="panel-meta"><span>节点数量</span><strong>{{ tracedNodeCount }}</strong></div>
                </div>
              </div>
              <div v-if="linkedBuildingLabels.length" class="token-wrap">
                <span v-for="label in linkedBuildingLabels" :key="label" class="token">{{ label }}</span>
              </div>
              <div v-if="insightError" class="inline-empty">
                <div class="inline-empty__art" aria-hidden="true"><span /><span /></div>
                <div>暂无数据</div>
                <div class="inline-empty__sub">点击左侧工具栏开始绑定房产</div>
              </div>
            </div>
          </section>

          <section class="panel-card">
            <button class="panel-collapse-toggle" type="button" @click="togglePanelSection('control')">
              <span>编辑控制</span>
              <component :is="panelSectionCollapsed.control ? ChevronRight : ChevronDown" :size="16" />
            </button>
            <div v-show="!panelSectionCollapsed.control" class="panel-section-body">
              <div class="panel-row-actions">
                <button
                  :class="['btn btn--sm', { 'btn--active': addPointMode }]"
                  type="button"
                  :disabled="saving || !selectedFeature"
                  @click="toggleAddPointMode"
                >
                  节点编辑
                </button>
                <button class="btn btn--sm" type="button" :disabled="saving || !selectedFeature" @click="insertPointAtCanvasCenter">中心加点</button>
              </div>
              <div class="panel-row-actions">
                <button
                  :class="['btn btn--sm', { 'btn--danger': deletePointMode }]"
                  type="button"
                  :disabled="saving || !selectedFeature"
                  @click="toggleDeletePointMode"
                >
                  删除模式
                </button>
                <button class="btn btn--sm" type="button" :disabled="saving || !canDeletePoint" @click="deleteSelectedPoint">删除选中点</button>
              </div>
              <div class="panel-row-actions">
                <button :class="['btn btn--sm', { 'btn--active': snapEnabled }]" type="button" :disabled="saving" @click="snapEnabled = !snapEnabled">
                  {{ snapEnabled ? '端点吸附 开' : '端点吸附 关' }}
                </button>
                <button class="btn btn--sm" type="button" :disabled="saving" @click="toggleSceneModeByPanel">{{ sceneMode === '2d' ? '切换3D' : '切换2D' }}</button>
              </div>
            </div>
          </section>

          <section class="panel-card">
            <button class="panel-collapse-toggle" type="button" @click="togglePanelSection('realtime')">
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
            <button class="panel-collapse-toggle" type="button" @click="togglePanelSection('timeline')">
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
            <button class="panel-collapse-toggle" type="button" @click="togglePanelSection('runtime')">
              <span>运行信息</span>
              <component :is="panelSectionCollapsed.runtime ? ChevronRight : ChevronDown" :size="16" />
            </button>
            <div v-show="!panelSectionCollapsed.runtime" class="panel-section-body">
              <div class="panel-meta"><span>节点总数</span><strong>{{ totalPoints }}</strong></div>
              <div class="panel-meta"><span>管段总数</span><strong>{{ segmentCount }}</strong></div>
              <div class="panel-meta"><span>总长度</span><strong>{{ formatMeters(totalLengthMeters) }}</strong></div>
              <div class="panel-meta"><span>当前线段</span><strong>{{ formatMeters(activeLineLengthMeters) }}</strong></div>
              <div class="panel-meta"><span>活动线索引</span><strong>{{ activeLineIndex + 1 }}</strong></div>
              <div class="panel-meta"><span>选中节点</span><strong>{{ selectedPointLabel }}</strong></div>
              <div class="panel-meta"><span>视图缩放</span><strong>Z{{ mapView.zoom }}</strong></div>
            </div>
          </section>

          <div class="panel-footer">
            <button class="btn" type="button" :disabled="saving" @click="handleResetDraft">取消</button>
            <button class="btn btn--primary" type="button" :disabled="!selectedFeature || !isDirty || saving" @click="saveGeometry">
              {{ saving ? '保存中...' : '保存修改' }}
            </button>
          </div>
        </aside>

        <div
          v-if="toolbarDrag.active"
          class="tool-drag-ghost"
          :style="{ left: `${toolbarDrag.clientX + 12}px`, top: `${toolbarDrag.clientY + 12}px` }"
        >
          <component :is="toolbarDragIcon" :size="16" />
          <span>{{ toolbarDragLabel }}</span>
        </div>
      </div>

      <footer class="bottom-status">
        <div class="status-group">
          <span class="status-mono">节点 {{ totalPoints }}</span>
          <span class="status-sep">|</span>
          <span class="status-mono">管段 {{ segmentCount }}</span>
          <span class="status-sep">|</span>
          <span class="status-mono">楼栋 {{ Math.max(linkedBuildingCount, 3) }}</span>
        </div>
        <div class="status-group">
          <span class="status-alert"><i /><span class="status-mono">{{ alertCount }}</span></span>
        </div>
        <div class="status-group status-group--right">
          <span class="status-online"><i />在线 1人</span>
          <span class="status-sep">•</span>
          <span class="status-mono">FPS {{ fpsText }}</span>
          <span class="status-sep">•</span>
          <span class="status-mono">进度 {{ loadProgressText }}</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Hand,
  Home,
  Layers,
  Loader2,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Upload,
  X,
  Zap,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch, type Component } from 'vue'
import { usePipe2DEditorData } from '~/composables/admin/usePipe2DEditorData'
import { usePipe2DEditorMap } from '~/composables/admin/usePipe2DEditorMap'
import { geoFeatureService, type GeoJsonFeature } from '~/services/geo-features'
import { twinService } from '~/services/twin'
import { cloneLines, geometryToLines, type Lines } from '~/utils/pipe2d-geometry'

type Message = {
  type: 'ok' | 'error'
  text: string
}

type ViewMode = 'global' | 'underground' | 'topology2d' | 'sketch'
type CanvasSkin = 'dots' | 'plain' | 'blueprint' | 'satellite'
type ToolKey =
  | 'select'
  | 'addNode'
  | 'addPipe'
  | 'bindAsset'
  | 'annotate'
  | 'layer'
  | 'import'

type PanelSectionKey = 'basic' | 'relation' | 'control' | 'realtime' | 'timeline' | 'runtime'
type RelationDetailKey = 'traceSegments' | 'networkNodes'

type ToolbarDragState = {
  active: boolean
  toolKey: ToolKey | null
  clientX: number
  clientY: number
  startX: number
  startY: number
  moved: boolean
  overCanvas: boolean
}

const viewModeOptions: Array<{ key: ViewMode; label: string }> = [
  { key: 'global', label: '全域3D' },
  { key: 'underground', label: '地下切片' },
  { key: 'sketch', label: '平面草图' },
  { key: 'topology2d', label: '2D拓扑' },
]

const toolItems: Array<{ key: ToolKey; icon: Component; label: string; shortcut: string }> = [
  { key: 'select', icon: Hand, label: '选择工具', shortcut: 'V' },
  { key: 'addNode', icon: Plus, label: '添加节点', shortcut: 'N' },
  { key: 'addPipe', icon: Network, label: '添加管线', shortcut: 'P' },
  { key: 'bindAsset', icon: Home, label: '房产绑定', shortcut: 'B' },
  { key: 'annotate', icon: FileText, label: '批注', shortcut: 'M' },
  { key: 'layer', icon: Layers, label: '图层', shortcut: 'L' },
  { key: 'import', icon: Upload, label: '导入', shortcut: 'U' },
]

const props = defineProps<{
  open: boolean
  backendBaseUrl: string
  initialFeatureId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', id: string): void
}>()

const mapContainerRef = ref<HTMLDivElement | null>(null)
const renameInputRef = ref<HTMLInputElement | null>(null)
const projectTitleInputRef = ref<HTMLInputElement | null>(null)

const saving = ref(false)
const actionMessage = ref<Message | null>(null)
const saveSuccessVisible = ref(false)

const pipes = ref<GeoJsonFeature[]>([])
const selectedFeatureId = ref('')

const draftLines = ref<Lines>([])
const originalLines = ref<Lines>([])

const renaming = ref(false)
const renamingSaving = ref(false)
const renameDraft = ref('')
const draftStatusText = ref('等待加载')
const activeTool = ref<ToolKey>('select')
const viewMode = ref<ViewMode>('topology2d')
const canvasSkin = ref<CanvasSkin>('dots')
const panelCollapsed = ref(false)
const projectTitle = ref('校园地下管网运维系统')
const editingProjectTitle = ref(false)
const projectTitleDraft = ref('')
const draftRestoredToastVisible = ref(false)

const panelSectionCollapsed = ref<Record<PanelSectionKey, boolean>>({
  basic: false,
  relation: false,
  control: false,
  realtime: false,
  timeline: false,
  runtime: true,
})

const relationDetailCollapsed = ref<Record<RelationDetailKey, boolean>>({
  traceSegments: true,
  networkNodes: true,
})

const toolbarDrag = ref<ToolbarDragState>({
  active: false,
  toolKey: null,
  clientX: 0,
  clientY: 0,
  startX: 0,
  startY: 0,
  moved: false,
  overCanvas: false,
})

const ignoreToolClickUntil = ref(0)

let draftAutosaveTimer: ReturnType<typeof setTimeout> | null = null
let draftIntervalTimer: ReturnType<typeof setInterval> | null = null
let saveCloseTimer: ReturnType<typeof setTimeout> | null = null
let draftToastTimer: ReturnType<typeof setTimeout> | null = null

const DRAFT_STORAGE_PREFIX = 'pipe2d-editor-draft:v3:'

const selectedFeature = computed(() => {
  return pipes.value.find(item => String(item.id) === selectedFeatureId.value) || null
})

const {
  history,
  mapView,
  activeLineIndex,
  selectedPoint,
  mapCursorClass,
  isDirty,
  canUndo,
  canRedo,
  totalPoints,
  totalLengthMeters,
  activeLineLengthMeters,
  mapError,
  sceneMode,
  undergroundSliceEnabled,
  snapEnabled,
  contextMenu,
  snapHintVisible,
  hoverLengthHint,
  addPointMode,
  canDeletePoint,
  deletePointMode,
  undoLast,
  redoLast,
  resetDraft,
  fitCurrentPipeView,
  deleteSelectedPoint,
  toggleDeletePointMode,
  toggleAddPointMode,
  insertPointAtCanvasCenter,
  insertPointAtScreenPosition,
  zoomIn,
  zoomOut,
  setZoomLevel,
  toggleSceneMode,
  setUndergroundSliceEnabled,
  setBasemapById,
  hideContextMenu,
  deletePointFromContextMenu,
} = usePipe2DEditorMap({
  open: toRef(props, 'open'),
  mapContainerRef,
  pipes,
  selectedFeature,
  draftLines,
  originalLines,
  saving,
  actionMessage,
  requestClose: () => emit('close'),
})

const {
  loading,
  loadError,
  drilldown,
  traceResult,
  telemetryList,
  auditLogs,
  insightError,
  loadPipes,
  loadInsights,
  saveGeometry: persistGeometry,
} = usePipe2DEditorData({
  backendBaseUrl: toRef(props, 'backendBaseUrl'),
  initialFeatureId: toRef(props, 'initialFeatureId'),
  pipes,
  selectedFeatureId,
  selectedFeature,
  draftLines,
  originalLines,
  history,
  saving,
  actionMessage,
  emitSaved: (id) => emit('saved', id),
})

const displayPipeName = computed(() => {
  if (!selectedFeature.value) return '未选择管道'
  const p = selectedFeature.value.properties || {}
  return String(p.name || p.ref || selectedFeature.value.id)
})

const selectedPointLabel = computed(() => {
  if (!selectedPoint.value) return '无'
  return `L${selectedPoint.value.lineIndex + 1}-P${selectedPoint.value.pointIndex + 1}`
})

const selectedFeatureTypeTag = computed(() => {
  const geometryType = selectedFeature.value?.geometry?.type || ''
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return '管网线'
  return '管网节点'
})

const segmentCount = computed(() => {
  return draftLines.value.reduce((sum, line) => sum + Math.max(0, line.length - 1), 0)
})

const saveStatusText = computed(() => {
  if (saving.value) return '云同步中'
  if (isDirty.value) return '草稿未保存'
  return '已同步云端'
})

const saveStatusClass = computed(() => {
  if (saving.value) return 'save-chip--syncing'
  if (isDirty.value) return 'save-chip--dirty'
  return 'save-chip--saved'
})

const zoomPercentText = computed(() => `${Math.round((mapView.value.zoom / 20) * 100)}%`)
const activeToolLabel = computed(() => toolItems.find(item => item.key === activeTool.value)?.label || '选择工具')

const activeToolHint = computed(() => {
  if (!selectedFeature.value) return ''
  if (activeTool.value === 'addNode') return '点击画布在线段上插入节点'
  if (activeTool.value === 'addPipe') return '点击画布继续编辑管线节点'
  if (activeTool.value === 'bindAsset') return '点击管线，准备关联房产信息'
  if (activeTool.value === 'annotate') return '点击目标位置添加运维批注'
  return ''
})

const toolCursorClass = computed(() => {
  if (activeTool.value === 'addNode' || activeTool.value === 'addPipe') return 'cursor--crosshair'
  if (activeTool.value === 'bindAsset') return 'cursor--cell'
  if (activeTool.value === 'select') return 'cursor--grab'
  return 'cursor--default'
})

const canvasClass = computed(() => {
  return ['mars-canvas', mapCursorClass.value, toolCursorClass.value]
})

const loadProgressText = computed(() => (loading.value ? '载入中' : '100%'))
const fpsText = computed(() => (sceneMode.value === '3d' ? '58' : '60'))
const alertCount = computed(() => telemetryList.value.filter(item => String(item.quality || '').toLowerCase() !== 'good').length)

const linkedBuildingCount = computed(() => {
  return Array.isArray(drilldown.value?.linkedBuildings) ? drilldown.value.linkedBuildings.length : 0
})

const impactedRoomCount = computed(() => {
  return Array.isArray(drilldown.value?.impactedRooms) ? drilldown.value.impactedRooms.length : 0
})

const tracedSegmentCount = computed(() => {
  return Array.isArray(traceResult.value?.pathSegmentIds) ? traceResult.value.pathSegmentIds.length : 0
})

const tracedNodeCount = computed(() => {
  return Array.isArray(traceResult.value?.nodeIds) ? traceResult.value.nodeIds.length : 0
})

function toRecordLabel(raw: unknown) {
  const row = raw as Record<string, unknown>
  const candidate = row.name || row.buildingName || row.roomName || row.code || row.id
  return String(candidate || '未命名')
}

const linkedBuildingLabels = computed(() => {
  if (!Array.isArray(drilldown.value?.linkedBuildings)) return []
  return drilldown.value.linkedBuildings.slice(0, 6).map(toRecordLabel)
})

const telemetrySeries = computed(() => {
  const sorted = [...telemetryList.value].sort((a, b) => {
    const av = new Date(a.sampledAt).getTime()
    const bv = new Date(b.sampledAt).getTime()
    return av - bv
  })
  return sorted.slice(-12)
})

const telemetryMinMax = computed(() => {
  if (!telemetrySeries.value.length) {
    return { min: 0, max: 0 }
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const item of telemetrySeries.value) {
    min = Math.min(min, item.value)
    max = Math.max(max, item.value)
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 }
  }
  return { min, max }
})

const telemetryPolylinePoints = computed(() => {
  if (!telemetrySeries.value.length) return ''
  const width = 320
  const height = 92
  const paddingX = 10
  const paddingY = 8
  const min = telemetryMinMax.value.min
  const max = telemetryMinMax.value.max
  const range = Math.max(max - min, 1)

  return telemetrySeries.value.map((item, index) => {
    const x = paddingX + ((width - paddingX * 2) * index) / Math.max(telemetrySeries.value.length - 1, 1)
    const y = height - paddingY - ((height - paddingY * 2) * (item.value - min)) / range
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const telemetryUnit = computed(() => telemetrySeries.value[telemetrySeries.value.length - 1]?.unit || '')
const telemetryMinText = computed(() => `${telemetryMinMax.value.min.toFixed(2)} ${telemetryUnit.value}`)
const telemetryMaxText = computed(() => `${telemetryMinMax.value.max.toFixed(2)} ${telemetryUnit.value}`)
const telemetryLatestText = computed(() => {
  const latest = telemetrySeries.value[telemetrySeries.value.length - 1]
  if (!latest) return '--'
  return `${latest.value.toFixed(2)} ${latest.unit}`
})

const toolbarDragTool = computed(() => {
  return toolItems.find(item => item.key === toolbarDrag.value.toolKey) || null
})

const toolbarDragLabel = computed(() => toolbarDragTool.value?.label || '工具')
const toolbarDragIcon = computed(() => toolbarDragTool.value?.icon || Search)
const panelTitle = computed(() => (selectedFeature.value ? `管道 ${String(selectedFeature.value.id)}` : '未选择管道'))

function pipeOptionLabel(feature: GeoJsonFeature) {
  const p = feature.properties || {}
  const name = String(p.name || p.ref || feature.id)
  return `${String(feature.id)} · ${name}`
}

function formatMeters(meters: number) {
  if (!Number.isFinite(meters)) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(1)} m`
}

function formatDateTime(value: string) {
  const ts = new Date(value)
  if (Number.isNaN(ts.getTime())) return value || '-'
  return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`
}

function isValidDraftLines(value: unknown): value is Lines {
  if (!Array.isArray(value) || !value.length) return false
  return value.every((line) => {
    if (!Array.isArray(line) || line.length < 2) return false
    return line.every((point) => {
      if (!Array.isArray(point) || point.length < 2) return false
      return Number.isFinite(point[0]) && Number.isFinite(point[1])
    })
  })
}

function draftStorageKey(featureId: string) {
  return `${DRAFT_STORAGE_PREFIX}${featureId}`
}

function writeLocalDraft(featureId: string) {
  if (typeof window === 'undefined') return
  const payload = {
    featureId,
    savedAt: Date.now(),
    lines: cloneLines(draftLines.value),
  }
  window.localStorage.setItem(draftStorageKey(featureId), JSON.stringify(payload))
  draftStatusText.value = '草稿已暂存'
}

function readLocalDraft(featureId: string): Lines | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(draftStorageKey(featureId))
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as { lines?: unknown }
    if (!isValidDraftLines(payload.lines)) return null
    return cloneLines(payload.lines)
  } catch {
    return null
  }
}

function clearLocalDraft(featureId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(draftStorageKey(featureId))
}

function saveDraftToLocal(force = false) {
  if (!props.open || saving.value || !selectedFeature.value) return
  if (!force && !isDirty.value) return
  writeLocalDraft(String(selectedFeature.value.id))
}

function scheduleDraftAutosave() {
  if (draftAutosaveTimer) clearTimeout(draftAutosaveTimer)
  draftAutosaveTimer = setTimeout(() => {
    draftAutosaveTimer = null
    saveDraftToLocal()
  }, 800)
}

function stopTimers() {
  if (draftAutosaveTimer) {
    clearTimeout(draftAutosaveTimer)
    draftAutosaveTimer = null
  }
  if (draftIntervalTimer) {
    clearInterval(draftIntervalTimer)
    draftIntervalTimer = null
  }
  if (saveCloseTimer) {
    clearTimeout(saveCloseTimer)
    saveCloseTimer = null
  }
  if (draftToastTimer) {
    clearTimeout(draftToastTimer)
    draftToastTimer = null
  }
  draftRestoredToastVisible.value = false
}

function ensureDraftInterval() {
  if (draftIntervalTimer || typeof window === 'undefined') return
  draftIntervalTimer = setInterval(() => {
    saveDraftToLocal()
  }, 8_000)
}

function restoreDraftIfExists(featureId: string) {
  const localDraft = readLocalDraft(featureId)
  if (!localDraft) {
    draftStatusText.value = '与服务端一致'
    return
  }
  draftLines.value = localDraft
  draftRestoredToastVisible.value = true
  if (draftToastTimer) clearTimeout(draftToastTimer)
  draftToastTimer = setTimeout(() => {
    draftRestoredToastVisible.value = false
  }, 3000)
  draftStatusText.value = '已恢复本地草稿'
}

function startRename() {
  if (!selectedFeature.value) return
  renaming.value = true
  renameDraft.value = displayPipeName.value
  nextTick(() => renameInputRef.value?.focus())
}

async function persistPipeName(feature: GeoJsonFeature, nextName: string) {
  const properties = {
    ...(feature.properties || {}),
    name: nextName,
  }
  const visible = Boolean((feature.properties as Record<string, unknown> | undefined)?.visible ?? true)

  try {
    await twinService.updatePipeProperties(props.backendBaseUrl, String(feature.id), {
      properties,
      visible,
      updatedBy: 'admin-2d-editor',
    })
  } catch {
    await geoFeatureService.update(props.backendBaseUrl, {
      id: String(feature.id),
      layer: 'pipes',
      geometry: feature.geometry,
      properties,
      visible,
    })
  }
}

async function commitRename() {
  if (renamingSaving.value) return
  if (!selectedFeature.value) {
    renaming.value = false
    return
  }

  const featureId = String(selectedFeature.value.id)
  const name = renameDraft.value.trim()
  const nextName = name || featureId
  const idx = pipes.value.findIndex(item => String(item.id) === featureId)
  if (idx < 0) {
    renaming.value = false
    return
  }

  const prevName = String(pipes.value[idx].properties?.name || pipes.value[idx].properties?.ref || featureId)
  if (prevName === nextName) {
    renaming.value = false
    return
  }

  renamingSaving.value = true
  try {
    await persistPipeName(pipes.value[idx], nextName)
    pipes.value[idx] = {
      ...pipes.value[idx],
      properties: {
        ...(pipes.value[idx].properties || {}),
        name: nextName,
      },
    }
    actionMessage.value = { type: 'ok', text: '管道名称已保存' }
    renaming.value = false
  } catch (err) {
    const message = err instanceof Error ? err.message : '管道名称保存失败'
    actionMessage.value = { type: 'error', text: message || '管道名称保存失败' }
  } finally {
    renamingSaving.value = false
  }
}

function cancelRename() {
  if (renamingSaving.value) return
  renaming.value = false
}

function startEditProjectTitle() {
  editingProjectTitle.value = true
  projectTitleDraft.value = projectTitle.value
  nextTick(() => projectTitleInputRef.value?.focus())
}

function commitProjectTitle() {
  const next = projectTitleDraft.value.trim()
  projectTitle.value = next || '校园地下管网运维系统'
  editingProjectTitle.value = false
}

function cancelProjectTitle() {
  editingProjectTitle.value = false
}

function togglePanelSection(key: PanelSectionKey) {
  panelSectionCollapsed.value[key] = !panelSectionCollapsed.value[key]
}

function toggleRelationDetail(key: RelationDetailKey) {
  relationDetailCollapsed.value[key] = !relationDetailCollapsed.value[key]
}

function setEditModes(targetAdd: boolean, targetDelete: boolean) {
  if (addPointMode.value !== targetAdd) {
    toggleAddPointMode()
  }
  if (deletePointMode.value !== targetDelete) {
    toggleDeletePointMode()
  }
}

function showPlanned(feature: string) {
  actionMessage.value = { type: 'ok', text: `${feature} 将在下一阶段接入` }
}

function handleMenuDelete() {
  deletePointFromContextMenu()
  hideContextMenu()
}

function handleMenuCopy() {
  hideContextMenu()
  showPlanned('复制')
}

function handleMenuBindAsset() {
  hideContextMenu()
  showPlanned('绑定房产')
}

function handleMenuTrace() {
  hideContextMenu()
  showPlanned('查看链路')
}

function activateTool(tool: ToolKey) {
  activeTool.value = tool
  if (tool === 'select') {
    setEditModes(false, false)
    return
  }
  if (tool === 'addNode' || tool === 'addPipe') {
    setEditModes(true, false)
    return
  }
  if (tool === 'bindAsset') {
    setEditModes(false, false)
    showPlanned('房产绑定')
    return
  }
  if (tool === 'annotate') {
    setEditModes(false, false)
    showPlanned('运维批注')
    return
  }
  if (tool === 'layer') {
    setEditModes(false, false)
    showPlanned('图层过滤')
    return
  }
  if (tool === 'import') {
    setEditModes(false, false)
    showPlanned('数据导入')
  }
}

function selectTool(tool: ToolKey) {
  if (Date.now() < ignoreToolClickUntil.value) return
  activateTool(tool)
}

function isPointInCanvas(clientX: number, clientY: number) {
  const canvas = mapContainerRef.value
  if (!canvas) return false
  const rect = canvas.getBoundingClientRect()
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
}

function tryDropToolToCanvas(tool: ToolKey, clientX: number, clientY: number) {
  if (!isPointInCanvas(clientX, clientY)) return
  activateTool(tool)
  if (tool !== 'addNode' && tool !== 'addPipe') return
  const canvas = mapContainerRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const screenX = clientX - rect.left
  const screenY = clientY - rect.top
  const inserted = insertPointAtScreenPosition(screenX, screenY)
  if (inserted) {
    actionMessage.value = { type: 'ok', text: `已放置${tool === 'addNode' ? '节点' : '管线点'}` }
  }
}

function handleToolbarDragMove(event: PointerEvent) {
  if (!toolbarDrag.value.active) return
  const moved = Math.abs(event.clientX - toolbarDrag.value.startX) > 4
    || Math.abs(event.clientY - toolbarDrag.value.startY) > 4
  toolbarDrag.value = {
    ...toolbarDrag.value,
    moved,
    clientX: event.clientX,
    clientY: event.clientY,
    overCanvas: isPointInCanvas(event.clientX, event.clientY),
  }
}

function stopToolbarDragWatchers() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', handleToolbarDragMove)
  window.removeEventListener('pointerup', handleToolbarDragEnd)
}

function handleToolbarDragEnd(event: PointerEvent) {
  const current = toolbarDrag.value
  stopToolbarDragWatchers()
  if (!current.active) return

  if (current.moved && current.toolKey) {
    ignoreToolClickUntil.value = Date.now() + 220
    tryDropToolToCanvas(current.toolKey, event.clientX, event.clientY)
  }

  toolbarDrag.value = {
    active: false,
    toolKey: null,
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
    moved: false,
    overCanvas: false,
  }
}

function startToolbarDrag(tool: ToolKey, event: PointerEvent) {
  if (event.button !== 0 || saving.value) return
  if (typeof window === 'undefined') return
  toolbarDrag.value = {
    active: true,
    toolKey: tool,
    clientX: event.clientX,
    clientY: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    overCanvas: isPointInCanvas(event.clientX, event.clientY),
  }
  window.addEventListener('pointermove', handleToolbarDragMove)
  window.addEventListener('pointerup', handleToolbarDragEnd)
}

function switchView(mode: ViewMode) {
  viewMode.value = mode
  if (mode === 'topology2d' || mode === 'sketch') {
    if (undergroundSliceEnabled.value) {
      setUndergroundSliceEnabled(false)
    }
    if (sceneMode.value === '3d') {
      toggleSceneMode()
    }
    applyCanvasSkin(mode === 'sketch' ? 'plain' : 'dots')
    return
  }
  applyCanvasSkin(mode === 'global' ? 'satellite' : 'blueprint')
  if (sceneMode.value === '2d') {
    toggleSceneMode()
  }
  setUndergroundSliceEnabled(mode === 'underground')
}

function onViewModeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as ViewMode
  switchView(value)
}

function applyCanvasSkin(mode: CanvasSkin) {
  canvasSkin.value = mode
  if (mode === 'satellite') {
    setBasemapById('gaode_img')
  } else {
    setBasemapById('gaode_vec')
  }
}

function toggleSceneModeByPanel() {
  if (sceneMode.value === '3d') {
    if (undergroundSliceEnabled.value) {
      setUndergroundSliceEnabled(false)
    }
    viewMode.value = 'topology2d'
  } else if (viewMode.value === 'topology2d') {
    viewMode.value = 'global'
  }
  toggleSceneMode()
}

function onZoomSliderInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  setZoomLevel(value)
}

function resetZoomToHundred() {
  setZoomLevel(20)
}

async function saveGeometry() {
  const featureId = selectedFeature.value ? String(selectedFeature.value.id) : ''
  await persistGeometry()
  if (!featureId) return false
  if (actionMessage.value?.type === 'ok') {
    clearLocalDraft(featureId)
    draftStatusText.value = '已保存到服务端'
    saveSuccessVisible.value = true
    if (saveCloseTimer) clearTimeout(saveCloseTimer)
    saveCloseTimer = setTimeout(() => {
      saveSuccessVisible.value = false
    }, 620)
    return true
  }
  return false
}

function handleResetDraft() {
  resetDraft()
  if (!selectedFeature.value) return
  clearLocalDraft(String(selectedFeature.value.id))
  draftStatusText.value = '已恢复服务端版本'
}

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

function handleDesignerShortcut(event: KeyboardEvent) {
  if (!props.open || saving.value) return
  if (shouldIgnoreShortcutTarget(event.target)) return
  const key = event.key.toLowerCase()
  if (key === 'v') {
    event.preventDefault()
    activateTool('select')
    return
  }
  if (key === 'n') {
    event.preventDefault()
    activateTool('addNode')
    return
  }
  if (key === 'p') {
    event.preventDefault()
    activateTool('addPipe')
    return
  }
  if (event.code === 'Space') {
    event.preventDefault()
    activateTool('select')
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      stopTimers()
      renaming.value = false
      saveSuccessVisible.value = false
      toolbarDrag.value.active = false
      stopToolbarDragWatchers()
      return
    }
    ensureDraftInterval()
    loadPipes()
  },
  { immediate: true },
)

watch(
  () => props.initialFeatureId,
  (id) => {
    if (!props.open || !id) return
    if (pipes.value.some(item => String(item.id) === id)) {
      selectedFeatureId.value = id
    }
  },
)

watch(selectedFeature, (feature) => {
  if (!feature) {
    draftLines.value = []
    originalLines.value = []
    draftStatusText.value = '未选择管道'
    return
  }

  const lines = geometryToLines(feature.geometry)
  if (!lines.length) {
    const fallback: Lines = [[[119.1888, 26.0252], [119.1894, 26.0255]]]
    originalLines.value = cloneLines(fallback)
    draftLines.value = cloneLines(fallback)
  } else {
    originalLines.value = cloneLines(lines)
    draftLines.value = cloneLines(lines)
  }

  actionMessage.value = null
  restoreDraftIfExists(String(feature.id))
  fitCurrentPipeView()
})

watch(
  [() => props.open, selectedFeatureId],
  ([opened, featureId]) => {
    if (!opened || !featureId) return
    void loadInsights(featureId)
  },
  { immediate: true },
)

watch(
  draftLines,
  () => {
    if (!props.open || !selectedFeature.value || saving.value) return
    if (!isDirty.value) {
      draftStatusText.value = '与服务端一致'
      return
    }
    scheduleDraftAutosave()
  },
  { deep: true },
)

watch(
  () => props.open,
  (opened) => {
    if (!opened) return
    applyCanvasSkin(canvasSkin.value)
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('keydown', handleDesignerShortcut)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleDesignerShortcut)
  }
  stopToolbarDragWatchers()
  stopTimers()
})
</script>

<style scoped src="./Pipe2DEditorDialog.css"></style>
