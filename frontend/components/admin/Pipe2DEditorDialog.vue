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
        :save-button-text="saveButtonText"
        :saving="saving"
        :is-dirty="isDirty"
        :selected-feature="selectedFeature"
        :can-undo="combinedCanUndo"
        :can-redo="combinedCanRedo"
        :buildings-visible="showBuildings"
        :external-nodes-visible="showExternalNodes"
        :view-mode="viewMode"
        :view-mode-options="viewModeOptions"
        :pipes="pipes"
        :selected-feature-id="selectedFeatureId"
        @start-edit-project-title="startEditProjectTitle"
        @update:project-title-draft="projectTitleDraft = $event"
        @commit-project-title="commitProjectTitle"
        @cancel-project-title="cancelProjectTitle"
        @change-view-mode="switchViewByKey"
        @ai="showPlanned('AI智能助手')"
        @undo="handleUndo"
        @redo="handleRedo"
        @toggle-buildings="showBuildings = !showBuildings"
        @toggle-external-nodes="showExternalNodes = !showExternalNodes"
        @beautify="showPlanned('一键美化布局')"
        @share="showPlanned('分享')"
        @validate-topology="handleValidateTopology"
        @create-pipe="createDraftPipe"
        @save-geometry="saveGeometry"
        @search-select="handleTopbarSearchSelect"
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
          :selected-feature-exists="Boolean(selectedFeature) || pipes.length > 0"
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
          :current-pipe-medium="currentPipeMedium"
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
          :global-segment-count="globalSegmentCount"
          :active-line-length-text="formatMeters(activeLineLengthMeters)"
          :active-line-index="activeLineIndex"
          :selected-point-label="selectedPointLabel"
          :zoom-level="mapView.zoom"
          :is-dirty="isDirty"
          :global-pipe-count="globalPipeCount"
          :global-node-count="globalNodeCount"
          :global-total-length-text="globalTotalLengthText"
          @collapse-panel="panelCollapsed = true"
          @toggle-section="togglePanelSection"
          @update:selected-feature-id="handleSelectedFeatureIdChange"
          @update:pipe-medium="updatePipeMedium"
          @refresh="handleRefreshPipes"
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
          @create-pipe="createDraftPipe"
          @save-geometry="saveGeometry"
          :graph="editorGraphValue"
          :graph-selected="editorGraphSelected"
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
        :total-points="statusbarPointCount"
        :segment-count="statusbarSegmentCount"
        :tertiary-label="statusbarTertiaryLabel"
        :tertiary-value="statusbarTertiaryValue"
        :alert-count="alertCount"
        :show-alert-count="statusbarShowAlertCount"
        :last-sync-text="lastSyncText"
        :active-tool-label="activeToolLabel"
      />

      <Pipe2DEditorShortcutHelp
        :visible="shortcutHelpVisible"
        @close="shortcutHelpVisible = false"
      />

      <Pipe2DEditorSaveConfirmModal
        :visible="saveConfirmVisible"
        :diff="pendingSaveDiff"
        :submitting="saving"
        @close="closeSaveConfirm"
        @confirm="confirmSaveGeometry"
      />

      <Pipe2DEditorQuickReportModal
        :visible="quickReportVisible"
        :pipe-name="displayPipeName"
        :location-text="quickReportLocationText"
        :submitting="quickReportSubmitting"
        @close="closeQuickReport"
        @submit="submitQuickReport"
      />

      <Pipe2DEditorBuildingModelModal
        :open="buildingModelModalOpen"
        :backend-base-url="props.backendBaseUrl"
        :preferred-building-ids="preferredBuildingIds"
        @close="buildingModelModalOpen = false"
        @saved="handleBuildingModelSaved"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import { PanelRightOpen } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import {
  defaultPanelSectionCollapsed,
  toolItems,
  viewModeOptions,
  type EditorMessage,
  type PanelSectionKey,
} from '~/components/admin/pipe2d-editor/pipe2d-editor-config'
import Pipe2DEditorRightPanelSection from '~/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue'
import Pipe2DEditorQuickReportModal from '~/components/admin/pipe2d-editor/Pipe2DEditorQuickReportModal.vue'
import type { QuickReportDraft } from '~/components/admin/pipe2d-editor/Pipe2DEditorQuickReportModal.vue'
import Pipe2DEditorSaveConfirmModal from '~/components/admin/pipe2d-editor/Pipe2DEditorSaveConfirmModal.vue'
import Pipe2DEditorShortcutHelp from '~/components/admin/pipe2d-editor/Pipe2DEditorShortcutHelp.vue'
import Pipe2DEditorBuildingModelModal from '~/components/admin/pipe2d-editor/Pipe2DEditorBuildingModelModal.vue'
import Pipe2DEditorStageSection from '~/components/admin/pipe2d-editor/Pipe2DEditorStageSection.vue'
import Pipe2DEditorStatusbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorStatusbarSection.vue'
import Pipe2DEditorToolbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorToolbarSection.vue'
import Pipe2DEditorTopbarSection from '~/components/admin/pipe2d-editor/Pipe2DEditorTopbarSection.vue'
import { sumLength } from '~/composables/admin/pipe2d-editor/pipe2d-editor-map-shared'
import { usePipe2DEditorData } from '~/composables/admin/usePipe2DEditorData'
import { usePipe2DEditorDrafts } from '~/composables/admin/usePipe2DEditorDrafts'
import { usePipe2DEditorMap } from '~/composables/admin/usePipe2DEditorMap'
import { usePipe2DEditorWorkspace } from '~/composables/admin/usePipe2DEditorWorkspace'
import { useMindmapEditor } from '~/composables/admin/useMindmapEditor'
import { useMindmapEditorEvents } from '~/composables/admin/useMindmapEditorEvents'
import { geoFeatureService, type GeoJsonFeature } from '~/services/geo-features'
import { pipelineOpsService } from '~/services/pipeline-ops'
import { twinService } from '~/services/twin'
import { geometryToLines, type Lines } from '~/utils/pipe2d-geometry'
import { cloneGraph, createEmptyGraph, diffGraphs, linesToGraph, normalizeLegacyMidPointEdges, type EdgeAttributes, type GraphDiff, type NodeAttributes, type NodeType, type PipeGraph } from '~/utils/pipe2d-graph'
import { validateTopology, type ValidationIssue } from '~/utils/pipe2d-topology-validation'

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
const lastSyncTime = ref<Date | null>(null)
const overviewPinned = ref(false)
const savedGraphBaseline = ref<PipeGraph>(createEmptyGraph())
const quickReportMode = ref(false)
const quickReportVisible = ref(false)
const quickReportSubmitting = ref(false)
const pendingQuickReportLocation = ref<{ lon: number; lat: number; nodeId?: string | null; edgeId?: string | null } | null>(null)
const buildingModelModalOpen = ref(false)
const saveConfirmVisible = ref(false)
const pendingSaveDiff = ref<GraphDiff | null>(null)
const validationResults = ref<ValidationIssue[]>([])

const pipes = ref<GeoJsonFeature[]>([])
const buildings = ref<GeoJsonFeature[]>([])
const selectedFeatureId = ref('')
const draftLines = ref<Lines>([])
const originalLines = ref<Lines>([])

const renaming = ref(false)
const renamingSaving = ref(false)
const renameDraft = ref('')
const panelSectionCollapsed = ref<Record<PanelSectionKey, boolean>>({ ...defaultPanelSectionCollapsed })
const relationActiveNames = ref<string[]>([])

let saveCloseTimer: ReturnType<typeof setTimeout> | null = null
const hasInitiallyRendered = ref(false)

const selectedFeature = computed(() => {
  return pipes.value.find(item => String(item.id) === selectedFeatureId.value) || null
})

const isDraftPipe = computed(() => {
  return Boolean(selectedFeature.value?.properties && (selectedFeature.value.properties as Record<string, unknown>).__draft)
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
// 管线编辑模式标志（由 activeTool watcher 维护，传递给 map 禁止拖拽）
const editPipeMode = ref(false)

// 思维导图选中回调持有者（由 mindmapEditor 初始化后赋值，通过闭包延迟调用）
type MindmapSelectCallbacks = {
  selectNode: (nodeId: string) => void
  selectEdge: (edgeId: string) => void
  clearSelection: () => void
}
const _mindmapSelectCbs: MindmapSelectCallbacks = {
  selectNode: () => {},
  selectEdge: () => {},
  clearSelection: () => {},
}

// 初始化地图编辑器（传递思维导图状态引用）
const {
  history,
  mapView,
  mapReady,
  activeLineIndex,
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
  showBuildings,
  showExternalNodes,
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
  placeGraphNodeAtScreen,
  addNodeMode,
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
  buildings,
  selectedFeature,
  draftLines,
  originalLines,
  saving,
  actionMessage,
  quickReportMode,
  validationResults,
  startQuickReport: ({ lon, lat, nodeId, edgeId }) => {
    if (!selectedFeature.value) {
      actionMessage.value = { type: 'error', text: '请先选择一条管线，再进行故障上报' }
      return
    }
    pendingQuickReportLocation.value = { lon, lat, nodeId: nodeId || null, edgeId: edgeId || null }
    quickReportVisible.value = true
    quickReportMode.value = false
  },
  requestClose: requestDialogClose,
  // 传递思维导图状态引用
  mindmapSelectedNodeIds,
  mindmapSelectedEdgeIds,
  mindmapHoveredNodeId,
  mindmapHoveredEdgeId,
  mindmapModeType,
  // 传递选中操作回调，确保 Cesium 路径同步回 mindmapEditor 内部状态
  mindmapSelectNode: (nodeId: string) => _mindmapSelectCbs.selectNode(nodeId),
  mindmapSelectEdge: (edgeId: string) => _mindmapSelectCbs.selectEdge(edgeId),
  mindmapClearSelection: () => _mindmapSelectCbs.clearSelection(),
  editPipeMode,
})

// 然后初始化思维导图编辑器（使用共享的 editorGraph 和状态引用）
const mindmapEditor = useMindmapEditor({
  draftLines,
  editorGraph, // 传递共享的图结构编辑器
})

// 将 mindmapEditor 的选中方法绑定到回调持有者，使 Cesium 路径能同步过来
_mindmapSelectCbs.selectNode = (nodeId) => mindmapEditor.selectNode(nodeId)
_mindmapSelectCbs.selectEdge = (edgeId) => mindmapEditor.selectEdge(edgeId)
_mindmapSelectCbs.clearSelection = () => mindmapEditor.clearSelection()

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
  addNodeMode,
  deletePointMode,
  quickReportMode,
  sceneMode,
  undergroundSliceEnabled,
  actionMessage,
  toggleAddPointMode,
  toggleDeletePointMode,
  insertPointAtScreenPosition,
  placeGraphNodeAtScreen,
  toggleSceneMode,
  setUndergroundSliceEnabled,
  setBasemapById,
  setZoomLevel,
  openBuildingModelModal: () => {
    buildingModelModalOpen.value = true
  },
})

// 同步 activeTool 到 editPipeMode（供 map 禁止拖拽）
watch(activeTool, (tool) => {
  editPipeMode.value = tool === 'editPipe'
}, { immediate: true })

const {
  loading,
  loadError,
  drilldown,
  traceResult,
  telemetryList,
  auditLogs,
  insightError,
  loadPipes,
  clearInsights,
  loadInsights,
  saveGeometry: persistGeometry,
} = usePipe2DEditorData({
  backendBaseUrl: toRef(props, 'backendBaseUrl'),
  initialFeatureId: toRef(props, 'initialFeatureId'),
  pipes,
  buildings,
  selectedFeatureId,
  selectedFeature,
  draftLines,
  originalLines,
  history,
  saving,
  actionMessage,
  emitSaved: (id) => emit('saved', id),
})

function hasMeaningfulGraphValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some(hasMeaningfulGraphValue)
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasMeaningfulGraphValue)
  }
  return true
}

function buildSavedGraphBaseline(lines: Lines, referenceGraph: PipeGraph): PipeGraph {
  const rawBaseline = linesToGraph(lines, 'n')
  if (!rawBaseline.nodes.length || !referenceGraph.nodes.length) {
    return rawBaseline
  }

  const coordKey = (lon: number, lat: number) => `${lon.toFixed(7)},${lat.toFixed(7)}`
  const referenceNodesById = new Map(referenceGraph.nodes.map(node => [node.id, node]))
  const referenceConnectedNodeIds = new Set<string>()
  for (const edge of referenceGraph.edges) {
    referenceConnectedNodeIds.add(edge.sourceId)
    referenceConnectedNodeIds.add(edge.targetId)
  }

  const referenceNodesByCoord = new Map<string, string[]>()
  for (const node of referenceGraph.nodes) {
    const key = coordKey(node.lon, node.lat)
    const bucket = referenceNodesByCoord.get(key) || []
    bucket.push(node.id)
    referenceNodesByCoord.set(key, bucket)
  }
  for (const [key, nodeIds] of referenceNodesByCoord) {
    nodeIds.sort((a, b) => {
      const aConnected = referenceConnectedNodeIds.has(a) ? 0 : 1
      const bConnected = referenceConnectedNodeIds.has(b) ? 0 : 1
      return aConnected - bConnected
    })
    referenceNodesByCoord.set(key, nodeIds)
  }

  const referenceEdgesByCoord = new Map<string, string[]>()
  for (const edge of referenceGraph.edges) {
    const src = referenceNodesById.get(edge.sourceId)
    const tgt = referenceNodesById.get(edge.targetId)
    if (!src || !tgt) continue
    const key = [coordKey(src.lon, src.lat), coordKey(tgt.lon, tgt.lat)].sort().join('::')
    const bucket = referenceEdgesByCoord.get(key) || []
    bucket.push(edge.id)
    referenceEdgesByCoord.set(key, bucket)
  }

  const rawNodesById = new Map(rawBaseline.nodes.map(node => [node.id, node]))
  const rawNodeIdToStableId = new Map<string, string>()
  const rawEdgeIdToStableId = new Map<string, string>()
  const usedReferenceNodeIds = new Set<string>()
  const usedReferenceEdgeIds = new Set<string>()

  for (const edge of rawBaseline.edges) {
    const rawSource = rawNodesById.get(edge.sourceId)
    const rawTarget = rawNodesById.get(edge.targetId)
    if (!rawSource || !rawTarget) continue

    const rawSourceKey = coordKey(rawSource.lon, rawSource.lat)
    const rawTargetKey = coordKey(rawTarget.lon, rawTarget.lat)
    const edgeKey = [rawSourceKey, rawTargetKey].sort().join('::')
    const candidateEdgeId = (referenceEdgesByCoord.get(edgeKey) || [])
      .find(id => !usedReferenceEdgeIds.has(id))
    if (!candidateEdgeId) continue

    const referenceEdge = referenceGraph.edges.find(item => item.id === candidateEdgeId)
    const referenceSource = referenceEdge ? referenceNodesById.get(referenceEdge.sourceId) : null
    const referenceTarget = referenceEdge ? referenceNodesById.get(referenceEdge.targetId) : null
    if (!referenceEdge || !referenceSource || !referenceTarget) continue

    const referenceSourceKey = coordKey(referenceSource.lon, referenceSource.lat)
    const referenceTargetKey = coordKey(referenceTarget.lon, referenceTarget.lat)
    if (rawSourceKey === referenceSourceKey && rawTargetKey === referenceTargetKey) {
      rawNodeIdToStableId.set(edge.sourceId, referenceEdge.sourceId)
      rawNodeIdToStableId.set(edge.targetId, referenceEdge.targetId)
    } else if (rawSourceKey === referenceTargetKey && rawTargetKey === referenceSourceKey) {
      rawNodeIdToStableId.set(edge.sourceId, referenceEdge.targetId)
      rawNodeIdToStableId.set(edge.targetId, referenceEdge.sourceId)
    } else {
      continue
    }

    usedReferenceNodeIds.add(rawNodeIdToStableId.get(edge.sourceId)!)
    usedReferenceNodeIds.add(rawNodeIdToStableId.get(edge.targetId)!)
    usedReferenceEdgeIds.add(referenceEdge.id)
    rawEdgeIdToStableId.set(edge.id, referenceEdge.id)
  }

  for (const node of rawBaseline.nodes) {
    if (rawNodeIdToStableId.has(node.id)) continue
    const nodeKey = coordKey(node.lon, node.lat)
    const candidateNodeId = (referenceNodesByCoord.get(nodeKey) || [])
      .find(id => !usedReferenceNodeIds.has(id))
    if (!candidateNodeId) continue
    rawNodeIdToStableId.set(node.id, candidateNodeId)
    usedReferenceNodeIds.add(candidateNodeId)
  }

  return {
    nodes: rawBaseline.nodes.map(node => ({
      ...node,
      id: rawNodeIdToStableId.get(node.id) || node.id,
    })),
    edges: rawBaseline.edges.map(edge => {
      const stableId = rawEdgeIdToStableId.get(edge.id) || edge.id
      const referenceEdge = referenceGraph.edges.find(item => item.id === stableId)
      const stableSourceId = rawNodeIdToStableId.get(edge.sourceId) || edge.sourceId
      const stableTargetId = rawNodeIdToStableId.get(edge.targetId) || edge.targetId
      return {
        ...edge,
        id: stableId,
        sourceId: referenceEdge?.sourceId || stableSourceId,
        targetId: referenceEdge?.targetId || stableTargetId,
      }
    }),
  }
}

const hasGraphDraftChanges = computed(() => {
  if (!selectedFeature.value) return false
  return editorGraph.graph.value.nodes.some(node => {
    return node.type !== 'default' || hasMeaningfulGraphValue(node.attributes)
  }) || editorGraph.graph.value.edges.some(edge => {
    return edge.edgeType !== 'straight'
      || edge.controlPoints !== null
      || hasMeaningfulGraphValue(edge.attributes)
  })
})

const topologyDiff = computed(() => {
  return diffGraphs(savedGraphBaseline.value, editorGraph.graph.value)
})

const {
  draftStatusText,
  draftRestoredToastVisible,
  clearLocalDraft,
  persistLocalDraft,
  setDraftStatus,
  stopDraftTimers,
} = usePipe2DEditorDrafts({
  open: toRef(props, 'open'),
  selectedFeature,
  draftLines,
  originalLines,
  isDirty,
  hasDraftChanges: computed(() => isDirty.value || hasGraphDraftChanges.value),
  saving,
  fitCurrentPipeView,
  graph: editorGraph.graph,
  restoreGraph: (g) => {
    editorGraph.graph.value = normalizeLegacyMidPointEdges(g)
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
  activeTool,
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
  if (!selectedFeature.value) return '管网总览'
  const properties = selectedFeature.value.properties || {}
  return String(properties.name || properties.ref || selectedFeature.value.id)
})

const currentPipeMedium = computed(() => {
  if (!selectedFeature.value) return 'water'
  const properties = selectedFeature.value.properties || {}
  const raw = String(
    properties.pipelineMedium
    || properties.pipeLayer
    || properties.pipeType
    || properties.medium
    || '',
  ).trim().toLowerCase()
  if (raw === 'water' || raw === '供水') return 'water'
  if (raw === 'drain' || raw === 'drainage' || raw === '排水') return 'drainage'
  if (raw === 'sewage' || raw === '污水') return 'sewage'
  return 'water'
})

const selectedPointLabel = computed(() => {
  const sel = editorGraph.selected.value
  if (!sel) return '无'
  if (sel.kind === 'node') return `节点 ${sel.nodeId}`
  return `管段 ${sel.edgeId}`
})

const selectedFeatureTypeTag = computed(() => {
  if (!selectedFeature.value) return '全局'
  const geometryType = selectedFeature.value?.geometry?.type || ''
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return '管网线'
  return '管网节点'
})

const segmentCount = computed(() => {
  return draftLines.value.reduce((sum, line) => sum + Math.max(0, line.length - 1), 0)
})

const saveStatusText = computed(() => {
  if (saving.value) return '云同步中'
  if (isDraftPipe.value) return isDirty.value ? '新管道待创建' : '新管道草稿'
  if (isDirty.value) return '草稿未保存'
  return '已同步云端'
})

const saveStatusClass = computed(() => {
  if (saving.value) return 'save-chip--syncing'
  if (isDraftPipe.value) return 'save-chip--dirty'
  if (isDirty.value) return 'save-chip--dirty'
  return 'save-chip--saved'
})

const saveButtonText = computed(() => isDraftPipe.value ? '创建管道' : '保存修改')

const alertCount = computed(() => telemetryList.value.filter(item => String(item.quality || '').toLowerCase() !== 'good').length)
const isOverviewMode = computed(() => !selectedFeature.value)
const globalPipeCount = computed(() => pipes.value.length)
const globalNodeCount = computed(() => {
  const keys = new Set<string>()
  for (const feature of pipes.value) {
    const lines = geometryToLines(feature.geometry)
    for (const line of lines) {
      for (const point of line) {
        keys.add(`${point[0].toFixed(8)},${point[1].toFixed(8)}`)
      }
    }
  }
  return keys.size
})
const globalSegmentCount = computed(() => {
  return pipes.value.reduce((sum, feature) => {
    const featureSegments = geometryToLines(feature.geometry)
      .reduce((lineSum, line) => lineSum + Math.max(0, line.length - 1), 0)
    return sum + featureSegments
  }, 0)
})
const globalTotalLengthText = computed(() => {
  const totalLength = pipes.value.reduce((sum, feature) => sum + sumLength(geometryToLines(feature.geometry)), 0)
  return formatMeters(totalLength)
})
const statusbarPointCount = computed(() => isOverviewMode.value ? globalNodeCount.value : totalPoints.value)
const statusbarSegmentCount = computed(() => isOverviewMode.value ? globalSegmentCount.value : segmentCount.value)
const statusbarTertiaryLabel = computed(() => isOverviewMode.value ? '管线' : '楼栋')
const statusbarTertiaryValue = computed(() => isOverviewMode.value ? globalPipeCount.value : linkedBuildingCount.value)
const statusbarShowAlertCount = computed(() => !isOverviewMode.value)
const lastSyncText = computed(() => {
  if (!lastSyncTime.value) return '未同步'
  const year = lastSyncTime.value.getFullYear()
  const month = String(lastSyncTime.value.getMonth() + 1).padStart(2, '0')
  const day = String(lastSyncTime.value.getDate()).padStart(2, '0')
  const hours = String(lastSyncTime.value.getHours()).padStart(2, '0')
  const minutes = String(lastSyncTime.value.getMinutes()).padStart(2, '0')
  const seconds = String(lastSyncTime.value.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
})

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

const preferredBuildingIds = computed(() => {
  if (!Array.isArray(drilldown.value?.linkedBuildings)) return []
  return drilldown.value.linkedBuildings
    .map((item) => String((item as Record<string, unknown>)?.id || '').trim())
    .filter(Boolean)
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
const editorGraphValue = computed(() => editorGraph.graph.value)
const editorGraphSelected = computed(() => editorGraph.selected.value)
const quickReportLocationText = computed(() => {
  const point = pendingQuickReportLocation.value
  if (!point) return '待选择位置'
  return `经纬度 ${point.lon.toFixed(6)}, ${point.lat.toFixed(6)}`
})

function clearValidationResults() {
  validationResults.value = []
}

function quickReportFaultLabel(faultType: QuickReportDraft['faultType']) {
  if (faultType === 'leak') return '漏水'
  if (faultType === 'burst') return '破裂'
  if (faultType === 'blockage') return '堵塞'
  return '故障'
}

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

function buildPipeMediumProperties(feature: GeoJsonFeature, nextMedium: 'water' | 'drainage' | 'sewage') {
  const mediumLabel = nextMedium === 'water' ? '供水' : nextMedium === 'drainage' ? '排水' : '污水'
  return {
    ...(feature.properties || {}),
    pipelineMedium: nextMedium,
    pipeLayer: nextMedium === 'drainage' ? 'drain' : nextMedium,
    pipeType: mediumLabel,
    medium: nextMedium,
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
    if (!isDraftPipe.value) {
      await persistPipeName(pipes.value[index], nextName)
    }
    pipes.value[index] = {
      ...pipes.value[index],
      properties: {
        ...(pipes.value[index].properties || {}),
        name: nextName,
      },
    }
    actionMessage.value = { type: 'ok', text: isDraftPipe.value ? '草稿管道名称已更新' : '管道名称已保存' }
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

async function updatePipeMedium(nextMediumRaw: string) {
  if (!selectedFeature.value) return
  const nextMedium = nextMediumRaw as 'water' | 'drainage' | 'sewage'
  if (!['water', 'drainage', 'sewage'].includes(nextMedium)) return

  const featureId = String(selectedFeature.value.id)
  const index = pipes.value.findIndex(item => String(item.id) === featureId)
  if (index < 0) return
  if (currentPipeMedium.value === nextMedium) return

  const nextProperties = buildPipeMediumProperties(pipes.value[index], nextMedium)
  const visible = Boolean((pipes.value[index].properties as Record<string, unknown> | undefined)?.visible ?? true)

  try {
    if (!isDraftPipe.value) {
      await twinService.updatePipeProperties(props.backendBaseUrl, featureId, {
        properties: nextProperties,
        visible,
        updatedBy: 'admin-2d-editor',
      })
    }
    pipes.value[index] = {
      ...pipes.value[index],
      properties: nextProperties,
    }
    actionMessage.value = {
      type: 'ok',
      text: isDraftPipe.value ? '草稿管道类型已更新' : '管道类型已保存',
    }
  } catch {
    try {
      await geoFeatureService.update(props.backendBaseUrl, {
        id: featureId,
        layer: 'pipes',
        geometry: pipes.value[index].geometry,
        properties: nextProperties,
        visible,
      })
      pipes.value[index] = {
        ...pipes.value[index],
        properties: nextProperties,
      }
      actionMessage.value = { type: 'ok', text: '管道类型已保存' }
    } catch (err) {
      const message = err instanceof Error ? err.message : '管道类型保存失败'
      actionMessage.value = { type: 'error', text: message || '管道类型保存失败' }
    }
  }
}

function createDraftPipe() {
  if (saving.value) return
  if (selectedFeature.value && (isDirty.value || hasGraphDraftChanges.value)) {
    persistLocalDraft(true)
  }
  clearValidationResults()
  clearInsights()
  renaming.value = false
  quickReportVisible.value = false
  pendingQuickReportLocation.value = null
  const draftId = `pipe_${Date.now()}`
  const draftFeature: GeoJsonFeature = {
    type: 'Feature',
    id: draftId,
    geometry: {
      type: 'LineString',
      coordinates: [],
    },
    properties: {
      name: '新管道',
      highway: 'service',
      pipelineMedium: 'water',
      pipeLayer: 'water',
      pipeType: '供水',
      medium: 'water',
      __draft: true,
    },
  }
  pipes.value = [draftFeature, ...pipes.value.filter(item => String(item.id) !== draftId)]
  overviewPinned.value = false
  selectedFeatureId.value = draftId
  actionMessage.value = { type: 'ok', text: '已创建新管道草稿，先放置节点再连线，最后保存即可落库' }
}

function togglePanelSection(key: PanelSectionKey) {
  panelSectionCollapsed.value[key] = !panelSectionCollapsed.value[key]
}

async function applySelectedFeatureId(nextId: string, shouldFocus = false) {
  const normalized = String(nextId || '')
  if (normalized && !pipes.value.some(item => String(item.id) === normalized)) return
  const changed = normalized !== selectedFeatureId.value
  if (changed) {
    overviewPinned.value = !normalized
    selectedFeatureId.value = normalized
    renaming.value = false
    mindmapEditor.clearSelection()
    if (!normalized) {
      editorGraph.initFromLines([])
      clearInsights()
    } else {
      editorGraph.clearSelection()
    }
  }
  if (shouldFocus && normalized) {
    await nextTick()
    fitCurrentPipeView()
  }
}

function handleSelectedFeatureIdChange(nextId: string) {
  void applySelectedFeatureId(nextId)
}

function handleTopbarSearchSelect(nextId: string) {
  void applySelectedFeatureId(nextId, true)
}

async function handleRefreshPipes() {
  const shouldRestoreOverview = overviewPinned.value
  clearValidationResults()
  const ok = await loadPipes()
  if (ok) {
    if (shouldRestoreOverview && selectedFeatureId.value) {
      await applySelectedFeatureId('')
    }
    lastSyncTime.value = new Date()
  }
  return ok
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
  if (!mindmapEditor.hasSelection.value) {
    actionMessage.value = { type: 'error', text: '当前仅支持复制已选中的拓扑节点或管段' }
    return
  }
  mindmapEditor.duplicateSelected()
  actionMessage.value = { type: 'ok', text: '已复制选中的拓扑元素' }
}

function handleMenuBindAsset() {
  hideContextMenu()
  activateTool('bindAsset')
}

function handleBuildingModelSaved(payload: { id: string; name: string }) {
  buildingModelModalOpen.value = false
  actionMessage.value = {
    type: 'ok',
    text: `已更新建筑模型：${payload.name || payload.id}`,
  }
}

function handleMenuTrace() {
  hideContextMenu()
  showPlanned('查看链路')
}

function closeSaveConfirm() {
  if (saving.value) return
  saveConfirmVisible.value = false
  pendingSaveDiff.value = null
}

function handleValidateTopology() {
  if (!selectedFeature.value) {
    actionMessage.value = { type: 'error', text: '请先选择一条管线，再执行拓扑校验' }
    return
  }
  const issues = validateTopology(editorGraph.graph.value)
  validationResults.value = issues
  if (!issues.length) {
    actionMessage.value = { type: 'ok', text: '拓扑校验通过，未发现孤立节点、自环或重复边' }
    return
  }
  const warningCount = issues.filter(issue => issue.severity === 'warning').length
  const errorCount = issues.filter(issue => issue.severity === 'error').length
  const parts = [`共 ${issues.length} 项`]
  if (warningCount) parts.push(`警告 ${warningCount}`)
  if (errorCount) parts.push(`错误 ${errorCount}`)
  actionMessage.value = { type: 'error', text: `拓扑校验完成：${parts.join('，')}` }
}

function closeQuickReport() {
  if (quickReportSubmitting.value) return
  quickReportVisible.value = false
  pendingQuickReportLocation.value = null
  if (activeTool.value === 'reportFault') {
    quickReportMode.value = true
  }
}

async function submitQuickReport(payload: QuickReportDraft) {
  if (!selectedFeature.value || !pendingQuickReportLocation.value) return

  quickReportSubmitting.value = true
  const target = pendingQuickReportLocation.value
  try {
    const result = await pipelineOpsService.quickReport({
      featureId: String(selectedFeature.value.id),
      lng: target.lon,
      lat: target.lat,
      faultType: payload.faultType,
      severity: payload.severity,
      note: payload.note,
      reportedBy: 'admin-2d-editor',
    })

    let targetNodeId: string | null = null
    if (target.nodeId && editorGraph.graph.value.nodes.some(node => node.id === target.nodeId)) {
      targetNodeId = target.nodeId
    } else if (target.edgeId) {
      targetNodeId = editorGraph.addNode(target.lon, target.lat, 'default', {}).id
    } else {
      targetNodeId = editorGraph.addNode(target.lon, target.lat, 'default', {}).id
    }

    if (targetNodeId) {
      const currentNode = editorGraph.graph.value.nodes.find(node => node.id === targetNodeId)
      editorGraph.updateNode(targetNodeId, {
        attributes: {
          ...(currentNode?.attributes || {}),
          label: currentNode?.attributes.label || `${quickReportFaultLabel(payload.faultType)}点`,
          status: 'error',
          faultType: payload.faultType,
          severity: payload.severity,
          notes: payload.note || currentNode?.attributes.notes,
        },
      })
    }

    quickReportVisible.value = false
    pendingQuickReportLocation.value = null
    if (activeTool.value === 'reportFault') {
      quickReportMode.value = true
    }
    actionMessage.value = {
      type: 'ok',
      text: `故障工单已创建：${result.workorder.id}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '快捷故障上报失败'
    actionMessage.value = { type: 'error', text: message || '快捷故障上报失败' }
  } finally {
    quickReportSubmitting.value = false
  }
}

async function saveGeometryNow() {
  const featureId = selectedFeature.value ? String(selectedFeature.value.id) : ''
  await persistGeometry()
  if (!featureId) return false
  if (actionMessage.value?.type === 'ok') {
    lastSyncTime.value = new Date()
    savedGraphBaseline.value = cloneGraph(editorGraph.graph.value)
    if (hasGraphDraftChanges.value) {
      persistLocalDraft(true)
      setDraftStatus('图结构草稿已暂存')
    } else {
      clearLocalDraft(featureId)
      setDraftStatus('已保存到服务端')
    }
    saveSuccessVisible.value = true
    clearSaveCloseTimer()
    saveCloseTimer = setTimeout(() => {
      saveSuccessVisible.value = false
      saveCloseTimer = null
    }, 620)
    clearValidationResults()
    return true
  }
  return false
}

function saveGeometry() {
  if (!selectedFeature.value) {
    actionMessage.value = { type: 'error', text: '请先选择一条管线，再保存修改' }
    return
  }
  if (!topologyDiff.value.hasChanges && isDirty.value) {
    void saveGeometryNow()
    return
  }
  if (!topologyDiff.value.hasChanges) {
    actionMessage.value = { type: 'ok', text: '当前没有需要保存的拓扑变更' }
    return
  }
  pendingSaveDiff.value = topologyDiff.value
  saveConfirmVisible.value = true
}

async function confirmSaveGeometry() {
  saveConfirmVisible.value = false
  await saveGeometryNow()
  if (actionMessage.value?.type === 'ok') {
    pendingSaveDiff.value = null
  }
}

function handleResetDraft() {
  resetDraft()
  clearValidationResults()
  if (!selectedFeature.value) return
  clearLocalDraft(String(selectedFeature.value.id))
  setDraftStatus('已恢复服务端版本')
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      hasInitiallyRendered.value = false
      renaming.value = false
      overviewPinned.value = false
      saveSuccessVisible.value = false
      saveConfirmVisible.value = false
      pendingSaveDiff.value = null
      quickReportVisible.value = false
      quickReportMode.value = false
      pendingQuickReportLocation.value = null
      clearValidationResults()
      clearSaveCloseTimer()
      stopDraftTimers()
      stopWorkspaceListeners()
      mindmapEvents.unbindEvents()
      return
    }
    void handleRefreshPipes()
    mindmapEvents.bindEvents()
  },
  { immediate: true },
)

watch(
  () => selectedFeature.value?.id ?? null,
  () => {
    if (selectedFeature.value) {
      savedGraphBaseline.value = buildSavedGraphBaseline(
        geometryToLines(selectedFeature.value.geometry),
        editorGraph.graph.value,
      )
      return
    }
    savedGraphBaseline.value = createEmptyGraph()
  },
)

watch(
  () => props.initialFeatureId,
  (id) => {
    if (!props.open || !id) return
    if (pipes.value.some(item => String(item.id) === id)) {
      void applySelectedFeatureId(id)
    }
  },
)

watch(selectedFeature, () => {
  actionMessage.value = null
  saveConfirmVisible.value = false
  pendingSaveDiff.value = null
  quickReportVisible.value = false
  pendingQuickReportLocation.value = null
  clearValidationResults()
})

// 当地图准备好且有管道数据时，确保渲染
watch(
  [mapReady, pipes, selectedFeature],
  ([ready, pipesList, feature]) => {
    if (hasInitiallyRendered.value) return
    if (!props.open || !ready || !pipesList.length) return
    // 地图已准备好，且有数据，调用 fitCurrentPipeView 确保显示
    nextTick(() => {
      fitCurrentPipeView()
      hasInitiallyRendered.value = true
    })
  },
)


watch(
  [() => props.open, selectedFeatureId],
  ([opened, featureId]) => {
    if (!opened || !featureId || isDraftPipe.value) {
      clearInsights()
      return
    }
    void loadInsights(featureId)
  },
  { immediate: true },
)

watch(
  editorGraphValue,
  () => {
    if (validationResults.value.length) {
      clearValidationResults()
    }
  },
  { deep: true },
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

onBeforeUnmount(() => {
  clearSaveCloseTimer()
  stopDraftTimers()
  stopWorkspaceListeners()
  mindmapEvents.unbindEvents()
})
</script>

<style scoped src="./Pipe2DEditorDialog.css"></style>
