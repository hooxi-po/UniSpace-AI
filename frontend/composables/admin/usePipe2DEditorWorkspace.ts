import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import type { PipeEditorMapView } from '~/utils/pipe2d-geometry'
import {
  createEmptyToolbarDragState,
  defaultToolbarGhostIcon,
  toolItems,
  toolKeySet,
  viewModeSet,
  type CanvasSkin,
  type EditorMessage,
  type ToolKey,
  type ViewMode,
} from '~/components/admin/pipe2d-editor/pipe2d-editor-config'

type UsePipe2DEditorWorkspaceOptions = {
  open: Ref<boolean>
  saving: Ref<boolean>
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  mapContainerRef: Ref<HTMLDivElement | null>
  mapCursorClass: ComputedRef<string>
  mapView: Ref<PipeEditorMapView>
  addPointMode: Ref<boolean>
  addNodeMode: Ref<boolean>
  deletePointMode: Ref<boolean>
  quickReportMode: Ref<boolean>
  sceneMode: Ref<'2d' | '3d'>
  undergroundSliceEnabled: Ref<boolean>
  actionMessage: Ref<EditorMessage | null>
  toggleAddPointMode: () => void
  toggleDeletePointMode: () => void
  insertPointAtScreenPosition: (screenX: number, screenY: number) => boolean
  placeGraphNodeAtScreen: (screenX: number, screenY: number) => boolean
  toggleSceneMode: () => void
  setUndergroundSliceEnabled: (enabled: boolean) => void
  setBasemapById: (id: string) => void
  setZoomLevel: (zoom: number) => void
  openAssetBindingModal?: () => void
  openBuildingModelModal?: () => void
}

export function usePipe2DEditorWorkspace(options: UsePipe2DEditorWorkspaceOptions) {
  const activeTool = ref<ToolKey>('select')
  const viewMode = ref<ViewMode>('topology2d')
  const canvasSkin = ref<CanvasSkin>('dots')
  const panelCollapsed = ref(false)
  const projectTitle = ref('校园地下管网运维系统')
  const editingProjectTitle = ref(false)
  const projectTitleDraft = ref('')
  const shortcutHelpVisible = ref(false)
  const toolbarDrag = ref(createEmptyToolbarDragState())
  const ignoreToolClickUntil = ref(0)

  const activeToolLabel = computed(() => toolItems.find(item => item.key === activeTool.value)?.label || '选择工具')
  const activeToolHint = computed(() => {
    if (!options.selectedFeature.value) return '请先从右侧面板选择一条管道'

    // 根据不同模式显示不同提示
    if (options.addPointMode.value) {
      return '插点模式：点击线段插入节点 | 按 Esc 退出'
    }
    if (options.deletePointMode.value) {
      return '删点模式：点击节点删除 | 按 Esc 退出'
    }

    // 工具提示
    if (activeTool.value === 'addNode') return '点击画布创建设备节点（窨井/阀门/泵站等） | 按 Esc 退出'
    if (activeTool.value === 'editPipe') return '点击第一个节点选为起点，再点击第二个节点连线 | Shift+点击使用曲线 | 按 Esc 退出'
    if (activeTool.value === 'reportFault') return '故障标注模式：点击地图位置快速上报 | 按 Esc 退出'
    if (activeTool.value === 'bindAsset') return '点击管线关联房产信息 | 按 Esc 取消'
    if (activeTool.value === 'buildingModel') return '建筑模型模式：为建筑配置 GLB 模型，并可视化调整锚点与姿态'
    if (activeTool.value === 'annotate') return '点击位置添加批注 | 按 Esc 取消'

    // 默认提示（选择模式）
    if (options.selectedFeature.value) {
      return '拖拽节点编辑 | 右键菜单 | Ctrl+Z 撤销 | Ctrl+Y 重做'
    }

    return ''
  })
  const toolCursorClass = computed(() => {
    if (activeTool.value === 'addNode' || activeTool.value === 'editPipe' || activeTool.value === 'reportFault') return 'cursor--crosshair'
    if (activeTool.value === 'bindAsset') return 'cursor--cell'
    if (activeTool.value === 'select') return 'cursor--grab'
    return 'cursor--default'
  })
  const canvasClass = computed(() => {
    return ['map-container', 'mars-canvas', options.mapCursorClass.value, toolCursorClass.value]
  })
  const stageClass = computed(() => {
    return ['stage', `stage--skin-${canvasSkin.value}`, { 'stage--drop-target': toolbarDrag.value.active && toolbarDrag.value.overCanvas }]
  })
  const zoomPercentText = computed(() => `${Math.round((options.mapView.value.zoom / 20) * 100)}%`)
  const toolbarDragTool = computed(() => {
    return toolItems.find(item => item.key === toolbarDrag.value.toolKey) || null
  })
  const toolbarDragLabel = computed(() => toolbarDragTool.value?.label || '工具')
  const toolbarDragIcon = computed(() => toolbarDragTool.value?.icon || defaultToolbarGhostIcon)

  function setMapContainerRef(el: HTMLDivElement | null) {
    options.mapContainerRef.value = el
  }

  function setEditModes(targetAdd: boolean, targetDelete: boolean, targetAddNode = false, targetQuickReport = false) {
    options.addNodeMode.value = targetAddNode
    options.quickReportMode.value = targetQuickReport
    if (options.addPointMode.value !== targetAdd) {
      options.toggleAddPointMode()
    }
    if (options.deletePointMode.value !== targetDelete) {
      options.toggleDeletePointMode()
    }
  }

  function showPlanned(feature: string) {
    options.actionMessage.value = { type: 'ok', text: `${feature} 将在下一阶段接入` }
  }

  function ensurePipeSelectedForEditing(actionLabel: string) {
    if (options.selectedFeature.value) return true
    activeTool.value = 'select'
    setEditModes(false, false, false, false)
    options.actionMessage.value = { type: 'error', text: `请先选择一条管道，再${actionLabel}` }
    return false
  }

  function activateTool(tool: ToolKey) {
    activeTool.value = tool
    if (tool === 'select') {
      setEditModes(false, false, false, false)
      return true
    }
    if (tool === 'addNode') {
      if (!ensurePipeSelectedForEditing('创建节点')) return false
      setEditModes(false, false, true, false)
      return true
    }
    if (tool === 'editPipe') {
      if (!ensurePipeSelectedForEditing('编辑管线')) return false
      setEditModes(false, false, false, false)
      return true
    }
    if (tool === 'reportFault') {
      if (!ensurePipeSelectedForEditing('标注故障')) return false
      setEditModes(false, false, false, true)
      return true
    }
    if (tool === 'bindAsset') {
      setEditModes(false, false, false, false)
      if (!ensurePipeSelectedForEditing('绑定房产')) return false
      options.openAssetBindingModal?.()
      activeTool.value = 'select'
      return true
    }
    if (tool === 'buildingModel') {
      setEditModes(false, false, false, false)
      options.openBuildingModelModal?.()
      activeTool.value = 'select'
      return true
    }
    if (tool === 'annotate') {
      setEditModes(false, false, false, false)
      showPlanned('运维批注')
      return true
    }
    if (tool === 'layer') {
      setEditModes(false, false, false, false)
      showPlanned('图层过滤')
      return true
    }
    setEditModes(false, false, false, false)
    showPlanned('数据导入')
    return true
  }

  function selectTool(tool: ToolKey) {
    if (Date.now() < ignoreToolClickUntil.value) return
    activateTool(tool)
  }

  function isPointInCanvas(clientX: number, clientY: number) {
    const canvas = options.mapContainerRef.value
    if (!canvas) return false
    const rect = canvas.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  function tryDropToolToCanvas(tool: ToolKey, clientX: number, clientY: number) {
    if (!isPointInCanvas(clientX, clientY)) return
    if (!activateTool(tool)) return
    if (tool === 'reportFault') {
      options.actionMessage.value = { type: 'ok', text: '故障标注已启用，点击地图位置即可上报' }
      return
    }
    if (tool !== 'addNode' && tool !== 'editPipe') return
    const canvas = options.mapContainerRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const screenX = clientX - rect.left
    const screenY = clientY - rect.top
    if (tool === 'addNode') {
      const placed = options.placeGraphNodeAtScreen(screenX, screenY)
      if (placed) {
        options.actionMessage.value = { type: 'ok', text: '已放置节点' }
      }
    } else {
      const inserted = options.insertPointAtScreenPosition(screenX, screenY)
      if (inserted) {
        options.actionMessage.value = { type: 'ok', text: '已放置管线点' }
      }
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

  function resetToolbarDragState() {
    toolbarDrag.value = createEmptyToolbarDragState()
  }

  function handleToolbarDragEnd(event: PointerEvent) {
    const current = toolbarDrag.value
    stopToolbarDragWatchers()
    if (!current.active) return

    if (current.moved && current.toolKey) {
      ignoreToolClickUntil.value = Date.now() + 220
      tryDropToolToCanvas(current.toolKey, event.clientX, event.clientY)
    }

    resetToolbarDragState()
  }

  function startToolbarDrag(tool: ToolKey, event: PointerEvent) {
    if (event.button !== 0 || options.saving.value) return
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

  function handleToolbarPointerDown(toolKey: string, event: PointerEvent) {
    if (!toolKeySet.has(toolKey as ToolKey)) return
    startToolbarDrag(toolKey as ToolKey, event)
  }

  function handleToolbarSelect(toolKey: string) {
    if (!toolKeySet.has(toolKey as ToolKey)) return
    selectTool(toolKey as ToolKey)
  }

  function applyCanvasSkin(mode: CanvasSkin) {
    canvasSkin.value = mode
    if (mode === 'satellite') {
      options.setBasemapById('gaode_img')
      return
    }
    options.setBasemapById('gaode_vec')
  }

  function switchView(mode: ViewMode) {
    viewMode.value = mode
    if (mode === 'topology2d' || mode === 'sketch') {
      if (options.undergroundSliceEnabled.value) {
        options.setUndergroundSliceEnabled(false)
      }
      if (options.sceneMode.value === '3d') {
        options.toggleSceneMode()
      }
      applyCanvasSkin(mode === 'sketch' ? 'plain' : 'dots')
      return
    }
    applyCanvasSkin(mode === 'global' ? 'satellite' : 'blueprint')
    if (options.sceneMode.value === '2d') {
      options.toggleSceneMode()
    }
    options.setUndergroundSliceEnabled(mode === 'underground')
  }

  function switchViewByKey(value: string) {
    if (!viewModeSet.has(value as ViewMode)) return
    switchView(value as ViewMode)
  }

  function toggleSceneModeByPanel() {
    if (options.sceneMode.value === '3d') {
      if (options.undergroundSliceEnabled.value) {
        options.setUndergroundSliceEnabled(false)
      }
      viewMode.value = 'topology2d'
    } else if (viewMode.value === 'topology2d') {
      viewMode.value = 'global'
    }
    options.toggleSceneMode()
  }

  function resetZoomToHundred() {
    options.setZoomLevel(20)
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

  function shouldIgnoreShortcutTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null
    if (!el) return false
    const tag = el.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (el.isContentEditable) return true
    return false
  }

  function handleDesignerShortcut(event: KeyboardEvent) {
    if (!options.open.value || options.saving.value) return
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
      activateTool('editPipe')
      return
    }
    if (key === 'f') {
      event.preventDefault()
      activateTool('reportFault')
      return
    }
    if (key === 'u') {
      event.preventDefault()
      activateTool('buildingModel')
      return
    }
    if (event.code === 'Space') {
      event.preventDefault()
      activateTool('select')
    }
  }

  watch(
    options.open,
    (opened) => {
      if (opened) {
        applyCanvasSkin(canvasSkin.value)
        return
      }
      stopToolbarDragWatchers()
      resetToolbarDragState()
    },
    { immediate: true },
  )

  watch(
    options.selectedFeature,
    (feature) => {
      if (feature) return
      if (
        activeTool.value === 'addNode'
        || activeTool.value === 'editPipe'
        || activeTool.value === 'reportFault'
        || options.addNodeMode.value
        || options.addPointMode.value
        || options.deletePointMode.value
        || options.quickReportMode.value
      ) {
        activeTool.value = 'select'
        setEditModes(false, false, false, false)
      }
    },
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
  })

  return {
    activeTool,
    viewMode,
    canvasSkin,
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
    stopWorkspaceListeners: stopToolbarDragWatchers,
  }
}
