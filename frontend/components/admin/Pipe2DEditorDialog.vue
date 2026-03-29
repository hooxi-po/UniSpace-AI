<template>
  <div v-if="open" :class="['dialog', 'modao-editor', { 'dialog--standalone': standalone }]">
    <div v-if="!standalone" class="dialog__mask" @click="requestDialogClose" />
    <div class="dialog__panel" @click.stop>
      <Pipe2DEditorTopbarSection
        :project-title="projectTitle"
        :editing-project-title="editingProjectTitle"
        :project-title-draft="projectTitleDraft"
        :save-status-class="saveStatusClass"
        :save-status-text="saveStatusText"
        :saving="saving"
        :can-undo="combinedCanUndo"
        :can-redo="combinedCanRedo"
        :view-mode="viewMode"
        :view-mode-options="viewModeOptions"
        @start-edit-project-title="startEditProjectTitle"
        @update:project-title-draft="projectTitleDraft = $event"
        @commit-project-title="commitProjectTitle"
        @cancel-project-title="cancelProjectTitle"
        @change-view-mode="switchViewByKey"
        @ai="showPlanned('AI智能助手')"
        @undo="handleUndo"
        @redo="handleRedo"
        @beautify="showPlanned('一键美化布局')"
        @share="showPlanned('分享')"
        @close="requestDialogClose"
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
          :canvas-class="combinedCursorClass"
          :toolbar-drag-active="toolbarDrag.active"
          :toolbar-drag-over-canvas="toolbarDrag.overCanvas"
          :toolbar-drag-label="toolbarDragLabel"
          :active-tool-hint="combinedToolHint"
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
          :graph="editorGraph.graph.value"
          :graph-selected="editorGraph.selected.value"
          @update-node="handleUpdateNode"
          @update-node-type="handleUpdateNodeType"
          @update-edge="handleUpdateEdge"
          @toggle-edge-curve="editorGraph.toggleEdgeCurve"
          @remove-node="editorGraph.removeNode"
          @remove-edge="editorGraph.removeEdge"
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
import * as Cesium from 'cesium'
import { PanelRightOpen } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import {
  defaultPanelSectionCollapsed,
  toolItems,
  viewModeOptions,
  type EditorMessage,
  type PanelSectionKey,
} from '~/components/admin/pipe2d-editor/pipe2d-editor-config'
import Pipe2DEditorRightPanelSection from '~/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue'
import Pipe2DEditorShortcutHelp from '~/components/admin/pipe2d-editor/Pipe2DEditorShortcutHelp.vue'
import Pipe2DEditorStageSection from '~/components/admin/pipe2d-editor/Pipe2DEditorStageSection.vue'
import Pipe2DEditorStatusbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorStatusbarSection.vue'
import Pipe2DEditorToolbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorToolbarSection.vue'
import Pipe2DEditorTopbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorTopbarSection.vue'
import { usePipe2DEditorData } from '~/composables/admin/usePipe2DEditorData'
import { usePipe2DEditorDrafts } from '~/composables/admin/usePipe2DEditorDrafts'
import { usePipe2DEditorMap } from '~/composables/admin/usePipe2DEditorMap'
import { usePipe2DEditorWorkspace } from '~/composables/admin/usePipe2DEditorWorkspace'
import { useMindmapEditor } from '~/composables/admin/useMindmapEditor'
import { useMindmapEditorEvents } from '~/composables/admin/useMindmapEditorEvents'
import { geoFeatureService, type GeoJsonFeature } from '~/services/geo-features'
import { twinService } from '~/services/twin'
import { type Lines } from '~/utils/pipe2d-geometry'
import { type EdgeAttributes, type NodeAttributes, type NodeType } from '~/utils/pipe2d-graph'

const props = defineProps<{
  open: boolean
  backendBaseUrl: string
  initialFeatureId?: string | null
  onRequestClose?: () => void
  standalone?: boolean
}>()

const standalone = computed(() => Boolean(props.standalone))

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', id: string): void
}>()

const mapContainerRef = ref<HTMLDivElement | null>(null)

const saving = ref(false)
const actionMessage = ref<EditorMessage | null>(null)
const saveSuccessVisible = ref(false)

const pipes = ref<GeoJsonFeature[]>([])
const selectedFeatureId = ref('')
const draftLines = ref<Lines>([])
const originalLines = ref<Lines>([])

const renaming = ref(false)
const renamingSaving = ref(false)
const renameDraft = ref('')
const panelSectionCollapsed = ref<Record<PanelSectionKey, boolean>>({ ...defaultPanelSectionCollapsed })
const relationActiveNames = ref<string[]>([])

let saveCloseTimer: ReturnType<typeof setTimeout> | null = null

const selectedFeature = computed(() => {
  return pipes.value.find(item => String(item.id) === selectedFeatureId.value) || null
})

function requestDialogClose() {
  try {
    hideContextMenu()
  } catch {
    // ensure close action is never blocked by menu state errors
  } finally {
    try {
      props.onRequestClose?.()
    } catch {
      // keep close behavior resilient when parent callback throws
    }
    emit('close')
  }
}

// 先初始化思维导图编辑器的状态容器（空状态）
const mindmapSelectedNodeIds = ref<Set<string>>(new Set())
const mindmapSelectedEdgeIds = ref<Set<string>>(new Set())
const mindmapHoveredNodeId = ref<string | null>(null)
const mindmapHoveredEdgeId = ref<string | null>(null)
const mindmapModeType = ref<string>('idle')

// 初始化地图编辑器（传递思维导图状态引用）
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
  editorGraph,
  screenToLonLat,
  worldToScreen,
  pickEntity,
} = usePipe2DEditorMap({
  open: toRef(props, 'open'),
  mapContainerRef,
  pipes,
  selectedFeature,
  draftLines,
  originalLines,
  saving,
  actionMessage,
  requestClose: requestDialogClose,
  // 传递思维导图状态引用
  mindmapSelectedNodeIds,
  mindmapSelectedEdgeIds,
  mindmapHoveredNodeId,
  mindmapHoveredEdgeId,
  mindmapModeType,
})

// 然后初始化思维导图编辑器（使用共享的 editorGraph 和状态引用）
const mindmapEditor = useMindmapEditor({
  draftLines,
  editorGraph, // 传递共享的图结构编辑器
})

// 同步思维导图编辑器的状态到共享的 ref
// 使用 watch 保持双向同步
watch(mindmapEditor.selectedNodeIds, (newVal) => {
  mindmapSelectedNodeIds.value = newVal
}, { deep: true })

watch(mindmapEditor.selectedEdgeIds, (newVal) => {
  mindmapSelectedEdgeIds.value = newVal
}, { deep: true })

watch(mindmapEditor.hoveredNodeId, (newVal) => {
  mindmapHoveredNodeId.value = newVal
})

watch(mindmapEditor.hoveredEdgeId, (newVal) => {
  mindmapHoveredEdgeId.value = newVal
})

watch(() => mindmapEditor.mode.value.type, (newVal) => {
  mindmapModeType.value = newVal
}, { immediate: true })

const {
  activeTool,
  viewMode,
  panelCollapsed,
  projectTitle,
  editingProjectTitle,
  projectTitleDraft,
  shortcutHelpVisible,
  toolbarDrag,
  activeToolLabel,
  activeToolHint,
  canvasClass,
  stageClass,
  zoomPercentText,
  toolbarDragLabel,
  toolbarDragIcon,
  showPlanned,
  activateTool,
  setMapContainerRef,
  handleToolbarPointerDown,
  handleToolbarSelect,
  switchViewByKey,
  toggleSceneModeByPanel,
  resetZoomToHundred,
  startEditProjectTitle,
  commitProjectTitle,
  cancelProjectTitle,
  stopWorkspaceListeners,
} = usePipe2DEditorWorkspace({
  open: toRef(props, 'open'),
  saving,
  selectedFeature,
  mapContainerRef,
  mapCursorClass,
  mapView,
  addPointMode,
  deletePointMode,
  sceneMode,
  undergroundSliceEnabled,
  actionMessage,
  toggleAddPointMode,
  toggleDeletePointMode,
  insertPointAtScreenPosition,
  toggleSceneMode,
  setUndergroundSliceEnabled,
  setBasemapById,
  setZoomLevel,
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

const {
  draftStatusText,
  draftRestoredToastVisible,
  clearLocalDraft,
  setDraftStatus,
  stopDraftTimers,
} = usePipe2DEditorDrafts({
  open: toRef(props, 'open'),
  selectedFeature,
  draftLines,
  originalLines,
  isDirty,
  saving,
  fitCurrentPipeView,
  graph: editorGraph.graph,
  restoreGraph: (g) => {
    editorGraph.graph.value = g
    editorGraph.selected.value = null
  },
})

// 思维导图事件处理器
const mindmapEvents = useMindmapEditorEvents({
  editor: mindmapEditor,
  mapContainerRef,
  open: toRef(props, 'open'),
  screenToLonLat: (pos) => screenToLonLat(new Cesium.Cartesian2(pos.x, pos.y)),
  pickEntity,
})

// 合并思维导图模式提示和原有工具提示
const combinedToolHint = computed(() => {
  // 优先使用思维导图编辑器的模式提示
  if (mindmapEditor.modeHint.value) {
    return mindmapEditor.modeHint.value
  }
  // 回退到原有的工具提示
  return activeToolHint.value
})

// 合并光标样式
const combinedCursorClass = computed(() => {
  const mindmapCursor = mindmapEditor.cursorClass.value
  if (mindmapCursor) {
    // 如果 canvasClass 是数组，将思维导图光标添加到数组中
    if (Array.isArray(canvasClass.value)) {
      return [...canvasClass.value.filter(c => !c.startsWith('cursor--')), mindmapCursor]
    }
    return [canvasClass.value, mindmapCursor]
  }
  // 回退到原有的光标样式
  return canvasClass.value
})

// 合并撤销/重做状态
const combinedCanUndo = computed(() => mindmapEditor.canUndo.value || canUndo.value)
const combinedCanRedo = computed(() => mindmapEditor.canRedo.value || canRedo.value)

// 合并撤销/重做操作
function handleUndo() {
  if (mindmapEditor.canUndo.value) {
    mindmapEditor.undo()
  } else {
    undoLast()
  }
}

function handleRedo() {
  if (mindmapEditor.canRedo.value) {
    mindmapEditor.redo()
  } else {
    redoLast()
  }
}

const displayPipeName = computed(() => {
  if (!selectedFeature.value) return '未选择管道'
  const properties = selectedFeature.value.properties || {}
  return String(properties.name || properties.ref || selectedFeature.value.id)
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

const selectedPipeIdText = computed(() => (selectedFeature.value ? String(selectedFeature.value.id) : '--'))

function formatMeters(meters: number) {
  if (!Number.isFinite(meters)) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters.toFixed(1)} m`
}

function clearSaveCloseTimer() {
  if (!saveCloseTimer) return
  clearTimeout(saveCloseTimer)
  saveCloseTimer = null
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
  const index = pipes.value.findIndex(item => String(item.id) === featureId)
  if (index < 0) {
    renaming.value = false
    return
  }

  const previousName = String(pipes.value[index].properties?.name || pipes.value[index].properties?.ref || featureId)
  if (previousName === nextName) {
    renaming.value = false
    return
  }

  renamingSaving.value = true
  try {
    await persistPipeName(pipes.value[index], nextName)
    pipes.value[index] = {
      ...pipes.value[index],
      properties: {
        ...(pipes.value[index].properties || {}),
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

function togglePanelSection(key: PanelSectionKey) {
  panelSectionCollapsed.value[key] = !panelSectionCollapsed.value[key]
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

async function saveGeometry() {
  const featureId = selectedFeature.value ? String(selectedFeature.value.id) : ''
  await persistGeometry()
  if (!featureId) return false
  if (actionMessage.value?.type === 'ok') {
    clearLocalDraft(featureId)
    setDraftStatus('已保存到服务端')
    saveSuccessVisible.value = true
    clearSaveCloseTimer()
    saveCloseTimer = setTimeout(() => {
      saveSuccessVisible.value = false
      saveCloseTimer = null
    }, 620)
    return true
  }
  return false
}

function handleResetDraft() {
  resetDraft()
  if (!selectedFeature.value) return
  clearLocalDraft(String(selectedFeature.value.id))
  setDraftStatus('已恢复服务端版本')
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      renaming.value = false
      saveSuccessVisible.value = false
      clearSaveCloseTimer()
      stopDraftTimers()
      stopWorkspaceListeners()
      mindmapEvents.unbindEvents()
      return
    }
    loadPipes()
    mindmapEvents.bindEvents()
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

watch(selectedFeature, () => {
  actionMessage.value = null
})

watch(
  [() => props.open, selectedFeatureId],
  ([opened, featureId]) => {
    if (!opened || !featureId) return
    void loadInsights(featureId)
  },
  { immediate: true },
)

// 图结构事件处理器（类型明确）
function handleUpdateNode(id: string, attrs: NodeAttributes) {
  editorGraph.updateNode(id, { attributes: attrs })
}

function handleUpdateNodeType(id: string, type: NodeType) {
  editorGraph.updateNode(id, { type })
}

function handleUpdateEdge(id: string, attrs: EdgeAttributes) {
  editorGraph.updateEdge(id, { attributes: attrs })
}


function onWindowKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key !== 'Escape') return

  // ESC 键不再关闭编辑器，只用于取消编辑操作
  // 编辑操作的取消由 usePipe2DEditorMapInteractions 和 useMindmapEditorEvents 处理
  // 用户需要通过点击关闭按钮来关闭编辑器
  event.preventDefault()
  // 不再调用 requestDialogClose()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onWindowKeydown)
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onWindowKeydown)
  }
  clearSaveCloseTimer()
  stopDraftTimers()
  stopWorkspaceListeners()
  mindmapEvents.unbindEvents()
})
</script>

<style scoped src="./Pipe2DEditorDialog.css"></style>
