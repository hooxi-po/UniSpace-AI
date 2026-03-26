<template>
  <div v-if="open" class="dialog modao-editor">
    <div class="dialog__mask" @click="emit('close')" />
    <div class="dialog__panel" @click.stop>
      <Pipe2DEditorTopbarSection
        :project-title="projectTitle"
        :editing-project-title="editingProjectTitle"
        :project-title-draft="projectTitleDraft"
        :save-status-class="saveStatusClass"
        :save-status-text="saveStatusText"
        :saving="saving"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :view-mode="viewMode"
        :view-mode-options="viewModeOptions"
        @start-edit-project-title="startEditProjectTitle"
        @update:project-title-draft="projectTitleDraft = $event"
        @commit-project-title="commitProjectTitle"
        @cancel-project-title="cancelProjectTitle"
        @change-view-mode="switchViewByKey"
        @ai="showPlanned('AI智能助手')"
        @undo="undoLast"
        @redo="redoLast"
        @beautify="showPlanned('一键美化布局')"
        @share="showPlanned('分享')"
        @close="emit('close')"
      />

      <div class="workspace">
        <Pipe2DEditorToolbarSection
          :active-tool-label="activeToolLabel"
          :tool-items="toolItems"
          :active-tool="activeTool"
          :saving="saving"
          @pointerdown="handleToolbarPointerDown"
          @select="handleToolbarSelect"
        />

        <Pipe2DEditorStageSection
          :section-class="stageClass"
          :canvas-class="canvasClass"
          :toolbar-drag-active="toolbarDrag.active"
          :toolbar-drag-over-canvas="toolbarDrag.overCanvas"
          :toolbar-drag-label="toolbarDragLabel"
          :active-tool-hint="activeToolHint"
          :loading="loading"
          :load-error="loadError"
          :selected-feature-exists="Boolean(selectedFeature)"
          :map-error="mapError"
          :snap-hint-visible="snapHintVisible"
          :hover-length-hint="hoverLengthHint"
          :save-success-visible="saveSuccessVisible"
          :action-message="actionMessage"
          :saving="saving"
          :zoom-level="mapView.zoom"
          :zoom-percent-text="zoomPercentText"
          :draft-restored-toast-visible="draftRestoredToastVisible"
          :context-menu="contextMenu"
          @set-map-container="setMapContainerRef"
          @stage-pointerdown="hideContextMenu"
          @import-template="showPlanned('示例模板导入')"
          @zoom-out="zoomOut"
          @zoom-in="zoomIn"
          @zoom-change="setZoomLevel"
          @zoom-reset="resetZoomToHundred"
          @menu-insert="handleMenuInsert"
          @menu-delete="handleMenuDelete"
          @menu-copy="handleMenuCopy"
          @menu-bind-asset="handleMenuBindAsset"
          @menu-trace="handleMenuTrace"
        />

        <button v-if="panelCollapsed" class="panel-expand" type="button" @click="panelCollapsed = false">
          <PanelRightOpen :size="16" />
          属性
        </button>

        <Pipe2DEditorRightPanelSection
          v-else
          :selected-feature="selectedFeature"
          :selected-feature-id="selectedFeatureId"
          :pipes="pipes"
          :loading="loading"
          :saving="saving"
          :display-pipe-name="displayPipeName"
          :selected-pipe-id-text="selectedPipeIdText"
          :selected-feature-type-tag="selectedFeatureTypeTag"
          :renaming="renaming"
          :rename-draft="renameDraft"
          :renaming-saving="renamingSaving"
          :draft-status-text="draftStatusText"
          :panel-section-collapsed="panelSectionCollapsed"
          :relation-active-names="relationActiveNames"
          :linked-building-count="linkedBuildingCount"
          :impacted-room-count="impactedRoomCount"
          :traced-segment-count="tracedSegmentCount"
          :traced-node-count="tracedNodeCount"
          :linked-building-labels="linkedBuildingLabels"
          :insight-error="insightError"
          :add-point-mode="addPointMode"
          :delete-point-mode="deletePointMode"
          :can-delete-point="canDeletePoint"
          :snap-enabled="snapEnabled"
          :scene-mode="sceneMode"
          :telemetry-series="telemetrySeries"
          :telemetry-polyline-points="telemetryPolylinePoints"
          :telemetry-min-text="telemetryMinText"
          :telemetry-latest-text="telemetryLatestText"
          :telemetry-max-text="telemetryMaxText"
          :telemetry-list="telemetryList"
          :audit-logs="auditLogs"
          :total-points="totalPoints"
          :segment-count="segmentCount"
          :total-length-text="formatMeters(totalLengthMeters)"
          :active-line-length-text="formatMeters(activeLineLengthMeters)"
          :active-line-index="activeLineIndex"
          :selected-point-label="selectedPointLabel"
          :zoom-level="mapView.zoom"
          :is-dirty="isDirty"
          @collapse-panel="panelCollapsed = true"
          @toggle-section="togglePanelSection"
          @update:selected-feature-id="selectedFeatureId = $event"
          @refresh="loadPipes"
          @focus="fitCurrentPipeView"
          @start-rename="startRename"
          @update:rename-draft="renameDraft = $event"
          @commit-rename="commitRename"
          @cancel-rename="cancelRename"
          @toggle-add-point-mode="toggleAddPointMode"
          @insert-center-point="insertPointAtCanvasCenter"
          @toggle-delete-point-mode="toggleDeletePointMode"
          @delete-selected-point="deleteSelectedPoint"
          @toggle-snap="snapEnabled = !snapEnabled"
          @toggle-scene-mode="toggleSceneModeByPanel"
          @update:relation-active-names="relationActiveNames = $event"
          @reset-draft="handleResetDraft"
          @save-geometry="saveGeometry"
        />

        <div
          v-if="toolbarDrag.active"
          class="tool-drag-ghost"
          :style="{ left: `${toolbarDrag.clientX + 12}px`, top: `${toolbarDrag.clientY + 12}px` }"
        >
          <component :is="toolbarDragIcon" :size="16" />
          <span>{{ toolbarDragLabel }}</span>
        </div>
      </div>

      <Pipe2DEditorStatusbarSection
        :total-points="totalPoints"
        :segment-count="segmentCount"
        :linked-building-count="linkedBuildingCount"
        :alert-count="alertCount"
        :fps-text="fpsText"
        :load-progress-text="loadProgressText"
      />

      <Pipe2DEditorShortcutHelp
        :visible="shortcutHelpVisible"
        @close="shortcutHelpVisible = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  FileText,
  Hand,
  Home,
  Layers,
  Network,
  PanelRightOpen,
  Plus,
  Search,
  Upload,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch, type Component } from 'vue'
import Pipe2DEditorRightPanelSection from '~/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue'
import Pipe2DEditorShortcutHelp from '~/components/admin/pipe2d-editor/Pipe2DEditorShortcutHelp.vue'
import Pipe2DEditorStageSection from '~/components/admin/pipe2d-editor/Pipe2DEditorStageSection.vue'
import Pipe2DEditorStatusbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorStatusbarSection.vue'
import Pipe2DEditorToolbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorToolbarSection.vue'
import Pipe2DEditorTopbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorTopbarSection.vue'
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

const viewModeSet = new Set<ViewMode>(viewModeOptions.map(item => item.key))

const toolItems: Array<{ key: ToolKey; icon: Component; label: string; tooltip: string; shortcut: string }> = [
  { key: 'select', icon: Hand, label: '选择工具', tooltip: '选择工具', shortcut: 'V' },
  { key: 'addNode', icon: Plus, label: '添加节点', tooltip: '添加节点', shortcut: 'N' },
  { key: 'addPipe', icon: Network, label: '添加管线', tooltip: '添加管线', shortcut: 'P' },
  { key: 'bindAsset', icon: Home, label: '房产绑定', tooltip: '绑定房产', shortcut: 'B' },
  { key: 'annotate', icon: FileText, label: '批注', tooltip: '添加批注', shortcut: 'M' },
  { key: 'layer', icon: Layers, label: '图层', tooltip: '图层过滤', shortcut: 'L' },
  { key: 'import', icon: Upload, label: '导入', tooltip: '导入数据', shortcut: 'U' },
]

const toolKeySet = new Set<ToolKey>(toolItems.map(item => item.key))

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
const shortcutHelpVisible = ref(false)

const panelSectionCollapsed = ref<Record<PanelSectionKey, boolean>>({
  basic: false,
  relation: false,
  control: false,
  realtime: false,
  timeline: false,
  runtime: true,
})
const relationActiveNames = ref<string[]>([])

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
  insertPointFromContextMenu,
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
  return ['map-container', 'mars-canvas', mapCursorClass.value, toolCursorClass.value]
})

const stageClass = computed(() => {
  return ['stage', `stage--skin-${canvasSkin.value}`, { 'stage--drop-target': toolbarDrag.value.active && toolbarDrag.value.overCanvas }]
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
const selectedPipeIdText = computed(() => (selectedFeature.value ? String(selectedFeature.value.id) : '--'))

function formatMeters(meters: number) {
  if (!Number.isFinite(meters)) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(1)} m`
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

function handleMenuInsert() {
  insertPointFromContextMenu()
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
  activateTool('bindAsset')
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

function isToolKey(value: string): value is ToolKey {
  return toolKeySet.has(value as ToolKey)
}

function isViewMode(value: string): value is ViewMode {
  return viewModeSet.has(value as ViewMode)
}

function handleToolbarPointerDown(toolKey: string, event: PointerEvent) {
  if (!isToolKey(toolKey)) return
  startToolbarDrag(toolKey, event)
}

function handleToolbarSelect(toolKey: string) {
  if (!isToolKey(toolKey)) return
  selectTool(toolKey)
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

function setMapContainerRef(el: HTMLDivElement | null) {
  mapContainerRef.value = el
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

function switchViewByKey(value: string) {
  if (!isViewMode(value)) return
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
  if (key === '?') {
    event.preventDefault()
    shortcutHelpVisible.value = true
    return
  }
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
