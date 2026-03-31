import * as Cesium from 'cesium'
import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { usePipe2DEditorMapGraphics } from '~/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics'
import { usePipe2DEditorMapInteractions } from '~/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions'
import { usePipe2DEditorDrawMode, type DrawMode } from '~/composables/admin/pipe2d-editor/usePipe2DEditorDrawMode'
import { usePipe2DEditorGraph, type SelectedElement } from '~/composables/admin/usePipe2DEditorGraph'
import type { EdgeType, NodeType } from '~/utils/pipe2d-graph'
import {
  buildHistoryItems,
  clamp,
  createContextMenuState,
  DEFAULT_VIEW,
  estimateZoomFromHeight,
  FITTED_VIEW_OPTIONS,
  lineLengthMeters,
  MAX_ZOOM,
  MIN_ZOOM,
  sumLength,
  toLonLat,
  type ContextMenuState,
  type EditorSceneMode,
  type HistoryItem,
  type HoverLengthHint,
  type PipePointMeta,
  zoomToHeight,
} from '~/composables/admin/pipe2d-editor/pipe2d-editor-map-shared'
import type { GeoJsonFeature } from '~/services/geo-features'
import { loadMars3D } from '~/utils/mars3d-loader'
import {
  buildFittedView,
  cloneLines,
  geometryToLines,
  type Lines,
  type PipeEditorMapView,
  type Point,
} from '~/utils/pipe2d-geometry'

type Message = {
  type: 'ok' | 'error'
  text: string
}

type UsePipe2DEditorMapOptions = {
  open: Ref<boolean>
  mapContainerRef: Ref<HTMLDivElement | null>
  pipes: Ref<GeoJsonFeature[]>
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  draftLines: Ref<Lines>
  originalLines: Ref<Lines>
  saving: Ref<boolean>
  actionMessage: Ref<Message | null>
  requestClose?: () => void
  // 思维导图选中状态（Phase 3 新增，可选）
  mindmapSelectedNodeIds?: Ref<Set<string>>
  mindmapSelectedEdgeIds?: Ref<Set<string>>
  // 思维导图悬停状态（Phase 3.3 新增，可选）
  mindmapHoveredNodeId?: Ref<string | null>
  mindmapHoveredEdgeId?: Ref<string | null>
  // 思维导图模式（用于 ESC 等全局按键冲突处理）
  mindmapModeType?: Ref<string>
  // 思维导图选中操作回调（用于从 Cesium 路径同步回 mindmapEditor 内部状态）
  mindmapSelectNode?: (nodeId: string) => void
  mindmapSelectEdge?: (edgeId: string) => void
  mindmapClearSelection?: () => void
}

export function usePipe2DEditorMap(options: UsePipe2DEditorMapOptions) {
  const mapView = ref<PipeEditorMapView>({ ...DEFAULT_VIEW })
  const activeLineIndex = ref(0)
  const selectedPoint = ref<PipePointMeta | null>(null)
  const dragging = ref<PipePointMeta | null>(null)
  const addPointMode = ref(false)
  const addNodeMode = ref(false)
  const snapEnabled = ref(true)
  const history = ref<Lines[]>([])
  const redoHistory = ref<Lines[]>([])
  const deletePointMode = ref(false)
  const contextMenu = ref<ContextMenuState>(createContextMenuState())
  const snapHintVisible = ref(false)
  const mapError = ref<string | null>(null)
  const sceneMode = ref<EditorSceneMode>('2d')
  const hoverLengthHint = ref<HoverLengthHint>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  })
  const hoveredLineIndex = ref<number | null>(null)
  const undergroundSliceEnabled = ref(false)
  const mapReady = ref(false)

  let marsMap: any | null = null
  let mars3dLib: any | null = null
  let viewer: Cesium.Viewer | null = null
  let graphicLayer: any | null = null
  let dragReleaseFallback: ((event: PointerEvent) => void) | null = null
  let skipDraftLinesWatch = false

  // ---------------------------------------------------------------------------
  // 图状态管理（新思维导图式编辑器）
  // ---------------------------------------------------------------------------
  const editorGraph = usePipe2DEditorGraph({ draftLines: options.draftLines })

  // 绘制模式状态（idle / placeNode / connectEdge）
  const drawMode = ref<DrawMode>('idle')
  const pendingEdgeType = ref<EdgeType>('straight')
  const connectSourceId = ref<string | null>(null)
  const previewTarget = ref<import('~/utils/pipe2d-geometry').Point | null>(null)
  const placeNodeType = ref<NodeType>('default')


  const snapEndpointCandidates = computed<Point[]>(() => {
    const candidates: Point[] = []
    const seen = new Set<string>()
    for (const feature of options.pipes.value) {
      const lines = geometryToLines(feature.geometry)
      for (const line of lines) {
        if (line.length < 2) continue
        const endpoints: Point[] = [line[0], line[line.length - 1]]
        for (const point of endpoints) {
          const key = `${point[0].toFixed(8)},${point[1].toFixed(8)}`
          if (seen.has(key)) continue
          seen.add(key)
          candidates.push(point)
        }
      }
    }
    return candidates
  })

  const totalPoints = computed(() => {
    return options.draftLines.value.reduce((sum, line) => sum + line.length, 0)
  })

  const totalLengthMeters = computed(() => {
    return sumLength(options.draftLines.value)
  })

  const activeLineLengthMeters = computed(() => {
    const line = options.draftLines.value[activeLineIndex.value]
    if (!line) return 0
    return lineLengthMeters(line)
  })

  const isDirty = computed(() => {
    return JSON.stringify(options.draftLines.value) !== JSON.stringify(options.originalLines.value)
  })

  const canDeletePoint = computed(() => {
    if (!selectedPoint.value) return false
    const line = options.draftLines.value[selectedPoint.value.lineIndex]
    return Array.isArray(line) && line.length > 2
  })

  const canRedo = computed(() => redoHistory.value.length > 0)
  const canUndo = computed(() => history.value.length > 0)
  const redoDepth = computed(() => redoHistory.value.length)
  const activeHistoryIndex = computed(() => {
    if (!history.value.length) return -1
    return history.value.length - 1
  })

  const historyItems = computed<HistoryItem[]>(() => {
    return buildHistoryItems(history.value)
  })

  const mapCursorClass = computed(() => {
    if (dragging.value) return 'canvas--editing'
    return 'canvas--idle'
  })

  function syncMapViewFromCamera() {
    if (!viewer) return
    const cartographic = viewer.camera.positionCartographic
    if (!cartographic) return
    const centerLon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(8))
    const centerLat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(8))
    const zoom = estimateZoomFromHeight(cartographic.height, centerLat)
    mapView.value = { centerLon, centerLat, zoom }
    sceneMode.value = viewer.scene.mode === Cesium.SceneMode.SCENE3D ? '3d' : '2d'
  }

  function createFittedView(lines: Lines) {
    return buildFittedView(lines, FITTED_VIEW_OPTIONS)
  }

  function toCartesian(point: Point) {
    return Cesium.Cartesian3.fromDegrees(point[0], point[1], 0)
  }

  function screenToLonLat(screenPosition: Cesium.Cartesian2): Point | null {
    if (!viewer) return null

    // 在 2D 模式下使用不同的拾取方法
    if (viewer.scene.mode === Cesium.SceneMode.SCENE2D || viewer.scene.mode === Cesium.SceneMode.COLUMBUS_VIEW) {
      // 2D 模式：直接使用相机拾取椭球体表面
      const ellipsoid = viewer.scene.globe?.ellipsoid
      if (!ellipsoid) return null
      const cartesian = viewer.camera.pickEllipsoid(screenPosition, ellipsoid)
      if (!cartesian) return null
      return toLonLat(cartesian)
    }

    // 3D 模式：使用射线拾取地球表面
    const ray = viewer.camera.getPickRay(screenPosition)
    if (!ray) return null
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
    if (!cartesian) return null
    return toLonLat(cartesian)
  }

  function worldToScreen(point: Point): Cesium.Cartesian2 | null {
    if (!viewer) return null
    const cartesian = Cesium.Cartesian3.fromDegrees(point[0], point[1], 0)
    const projected = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian)
    if (!projected) return null
    return new Cesium.Cartesian2(projected.x, projected.y)
  }

  /**
   * 拾取实体（用于思维导图编辑器）
   * 检测屏幕坐标处是否有节点、边或连接点
   */
  function pickEntity(screenPosition: { x: number; y: number }):
    | { type: 'node'; nodeId: string }
    | { type: 'edge'; edgeId: string }
    | { type: 'connectionPoint'; nodeId: string; direction: 'top' | 'right' | 'bottom' | 'left' }
    | null {
    if (!viewer) return null

    // 使用 Cesium 的拾取功能
    const pickedObject = viewer.scene.pick(new Cesium.Cartesian2(screenPosition.x, screenPosition.y))
    if (!pickedObject || !pickedObject.id) return null

    // 检查是否是我们的图形对象
    const entity = pickedObject.id
    if (!entity.properties) return null

    // 检查是否是连接点（优先级最高）
    if (entity.properties.isConnectionPoint && entity.properties.isConnectionPoint.getValue()) {
      return {
        type: 'connectionPoint',
        nodeId: entity.properties.graphNodeId.getValue(),
        direction: entity.properties.direction.getValue(),
      }
    }

    // 检查是否是节点
    if (entity.properties.graphNodeId && !entity.properties.isHalo && !entity.properties.isBadge) {
      const nodeId = typeof entity.properties.graphNodeId.getValue === 'function'
        ? entity.properties.graphNodeId.getValue()
        : entity.properties.graphNodeId
      return {
        type: 'node',
        nodeId,
      }
    }

    // 检查是否是边
    if (entity.properties.graphEdgeId && !entity.properties.isHalo) {
      const edgeId = typeof entity.properties.graphEdgeId.getValue === 'function'
        ? entity.properties.graphEdgeId.getValue()
        : entity.properties.graphEdgeId
      return {
        type: 'edge',
        edgeId,
      }
    }

    return null
  }

  function pushHistory() {
    history.value.push(cloneLines(options.draftLines.value))
    if (history.value.length > 10) history.value.shift()
    redoHistory.value = []
  }

  function clearDragReleaseFallback() {
    if (typeof window === 'undefined') return
    if (!dragReleaseFallback) return
    window.removeEventListener('pointerup', dragReleaseFallback, true)
    dragReleaseFallback = null
  }

  function installDragReleaseFallback() {
    if (typeof window === 'undefined') return
    clearDragReleaseFallback()
    dragReleaseFallback = () => {
      dragging.value = null
      setCameraControlsEnabled(true)
      clearDragReleaseFallback()
    }
    window.addEventListener('pointerup', dragReleaseFallback, true)
  }

  function setCameraControlsEnabled(enabled: boolean) {
    if (!viewer) return
    const controller = viewer.scene.screenSpaceCameraController
    controller.enableTranslate = enabled
    controller.enableRotate = enabled
    controller.enableTilt = enabled
    controller.enableZoom = enabled
    controller.enableLook = enabled
  }

  const { clearGraphics, bindLayerEvents, renderDraftGraphics, startEditingActiveLine, resetGraphicsState } =
    usePipe2DEditorMapGraphics({
      getViewer: () => viewer,
      getGraphicLayer: () => graphicLayer,
      getMars3dLib: () => mars3dLib,
      selectedFeature: options.selectedFeature,
      draftLines: options.draftLines,
      activeLineIndex,
      selectedPoint,
      hoveredLineIndex,
      setSkipDraftLinesWatch: (next) => {
        skipDraftLinesWatch = next
      },
      dragging,
      setCameraControlsEnabled,
      clearDragReleaseFallback,
      installDragReleaseFallback,
      pushHistory,
      toCartesian,
      graph: editorGraph.graph,
      graphSelected: editorGraph.selected,
      previewTarget,
      connectSourceId,
      // 传递思维导图选中状态
      mindmapSelectedNodeIds: options.mindmapSelectedNodeIds,
      mindmapSelectedEdgeIds: options.mindmapSelectedEdgeIds,
      // 传递思维导图悬停状态
      mindmapHoveredNodeId: options.mindmapHoveredNodeId,
      mindmapHoveredEdgeId: options.mindmapHoveredEdgeId,
    })

  const {
    hideContextMenu,
    stopDragging,
    insertPointAtCanvasCenter,
    insertPointAtScreenPosition,
    toggleDeletePointMode,
    toggleAddPointMode,
    undoLast,
    redoLast,
    restoreFromHistory,
    resetDraft,
    deleteSelectedPoint,
    endEditing,
    insertPointFromContextMenu,
    deletePointFromContextMenu,
    handleKeydown,
    bindMapEvents,
    destroyInteractions,
  } = usePipe2DEditorMapInteractions({
    open: options.open,
    selectedFeature: options.selectedFeature,
    draftLines: options.draftLines,
    originalLines: options.originalLines,
    saving: options.saving,
    actionMessage: options.actionMessage,
    requestClose: options.requestClose,
    getViewer: () => viewer,
    getGraphicLayer: () => graphicLayer,
    toCartesian,
    screenToLonLat,
    worldToScreen,
    snapEndpointCandidates,
    activeLineIndex,
    selectedPoint,
    dragging,
    addPointMode,
    deletePointMode,
    addNodeMode,
    placeGraphNodeAtScreen,
    pickGraphEntity: (pos) => {
      const result = pickEntity(pos)
      if (!result) return null
      if (result.type === 'node') return { type: 'node' as const, nodeId: result.nodeId }
      if (result.type === 'edge') return { type: 'edge' as const, edgeId: result.edgeId }
      return null
    },
    selectGraphNode: (nodeId: string) => {
      editorGraph.selectNode(nodeId)
      if (options.mindmapSelectNode) {
        options.mindmapSelectNode(nodeId)
      } else {
        options.mindmapSelectedNodeIds?.value.clear()
        options.mindmapSelectedEdgeIds?.value.clear()
        options.mindmapSelectedNodeIds?.value.add(nodeId)
      }
    },
    selectGraphEdge: (edgeId: string) => {
      editorGraph.selectEdge(edgeId)
      if (options.mindmapSelectEdge) {
        options.mindmapSelectEdge(edgeId)
      } else {
        options.mindmapSelectedNodeIds?.value.clear()
        options.mindmapSelectedEdgeIds?.value.clear()
        options.mindmapSelectedEdgeIds?.value.add(edgeId)
      }
    },
    clearGraphSelection: () => {
      editorGraph.clearSelection()
      if (options.mindmapClearSelection) {
        options.mindmapClearSelection()
      } else {
        options.mindmapSelectedNodeIds?.value.clear()
        options.mindmapSelectedEdgeIds?.value.clear()
      }
    },
    snapEnabled,
    history,
    redoHistory,
    contextMenu,
    snapHintVisible,
    hoverLengthHint,
    hoveredLineIndex,
    renderDraftGraphics,
    startEditingActiveLine,
    setCameraControlsEnabled,
    clearDragReleaseFallback,
    pushHistory,
    // 传递思维导图状态（用于 ESC 键处理）
    mindmapSelectedNodeIds: options.mindmapSelectedNodeIds,
    mindmapSelectedEdgeIds: options.mindmapSelectedEdgeIds,
    mindmapModeType: options.mindmapModeType,
  })

  // ---------------------------------------------------------------------------
  // 绘制模式（思维导图式节点放置 + 连线）
  // ---------------------------------------------------------------------------
  const {
    enterPlaceNode,
    enterConnectFromNode,
    exitDrawMode,
    bindDrawEvents,
    destroyDrawEvents,
  } = usePipe2DEditorDrawMode({
    graph: editorGraph.graph,
    selected: editorGraph.selected,
    drawMode,
    pendingEdgeType,
    connectSourceId,
    previewTarget,
    placeNodeType,
    getViewer: () => viewer,
    screenToLonLat,
    addNode: editorGraph.addNode,
    addEdge: editorGraph.addEdge,
    selectNode: editorGraph.selectNode,
    selectEdge: editorGraph.selectEdge,
    clearSelection: editorGraph.clearSelection,
    renderDraftGraphics,
  })


  function placeGraphNodeAtScreen(x: number, y: number): boolean {
    const screen = new Cesium.Cartesian2(Math.round(x), Math.round(y))
    const point = screenToLonLat(screen)
    if (!point) return false
    const node = editorGraph.addNode(point[0], point[1], 'default', { label: '新节点' })
    editorGraph.selectNode(node.id)
    if (options.mindmapSelectNode) {
      options.mindmapSelectNode(node.id)
    } else {
      options.mindmapSelectedNodeIds?.value.clear()
      options.mindmapSelectedEdgeIds?.value.clear()
      options.mindmapSelectedNodeIds?.value.add(node.id)
    }
    return true
  }

  function zoomByStep(delta: number) {
    if (!viewer) return
    const nextZoom = clamp(Math.round(mapView.value.zoom + delta), MIN_ZOOM, MAX_ZOOM)
    setZoomLevel(nextZoom)
  }

  function setZoomLevel(zoom: number) {
    if (!viewer) return
    const nextZoom = clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM)
    if (nextZoom === mapView.value.zoom) return
    const targetHeight = zoomToHeight(nextZoom, mapView.value.centerLat)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        mapView.value.centerLon,
        mapView.value.centerLat,
        targetHeight,
      ),
      duration: 0.25,
    })
    mapView.value = { ...mapView.value, zoom: nextZoom }
  }

  function zoomIn() {
    zoomByStep(1)
  }

  function zoomOut() {
    zoomByStep(-1)
  }

  function fitCurrentPipeView() {
    if (!options.draftLines.value.length) return
    const fitted = createFittedView(options.draftLines.value)
    mapView.value = { ...fitted }
    if (!viewer) return

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        fitted.centerLon,
        fitted.centerLat,
        zoomToHeight(fitted.zoom, fitted.centerLat),
      ),
      duration: 0.45,
    })
  }

  function toggleSceneMode() {
    if (!viewer) return
    const nextMode: EditorSceneMode = sceneMode.value === '2d' ? '3d' : '2d'
    if (nextMode === '3d') {
      viewer.scene.morphTo3D(0.35)
    } else {
      if (undergroundSliceEnabled.value) {
        setUndergroundSliceEnabled(false)
      }
      viewer.scene.morphTo2D(0.35)
    }
    sceneMode.value = nextMode
  }

  function applyUndergroundSlice(enabled: boolean) {
    if (!viewer) return
    const globe = viewer.scene.globe
    globe.depthTestAgainstTerrain = enabled
    if (globe.translucency) {
      globe.translucency.enabled = enabled
      globe.translucency.frontFaceAlpha = enabled ? 0.26 : 1
      globe.translucency.backFaceAlpha = enabled ? 0.16 : 1
    }
    viewer.scene.fog.enabled = !enabled
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = !enabled
    }
    viewer.scene.globe.showGroundAtmosphere = !enabled
  }

  function setUndergroundSliceEnabled(enabled: boolean) {
    if (!viewer) {
      undergroundSliceEnabled.value = enabled
      return
    }
    if (enabled && sceneMode.value !== '3d') {
      viewer.scene.morphTo3D(0.35)
      sceneMode.value = '3d'
    }
    undergroundSliceEnabled.value = enabled
    applyUndergroundSlice(enabled)
  }

  function setBasemapById(basemapId: string) {
    if (!marsMap || !basemapId) return
    const target = marsMap as Record<string, unknown>
    if (typeof target.setBasemap === 'function') {
      ;(target.setBasemap as (id: string) => void)(basemapId)
      return
    }
    target.basemap = basemapId
  }

  function destroyMap() {
    mapReady.value = false
    destroyInteractions()
    destroyDrawEvents()
    clearDragReleaseFallback()
    if (graphicLayer && typeof graphicLayer.remove === 'function') {
      graphicLayer.remove(true)
    }
    graphicLayer = null
    if (viewer) {
      viewer.camera.changed.removeEventListener(syncMapViewFromCamera)
      clearGraphics()
      viewer = null
    }
    resetGraphicsState()
    if (marsMap && typeof marsMap.destroy === 'function') {
      marsMap.destroy()
    }
    marsMap = null
    mars3dLib = null
    mapReady.value = false
  }

  async function ensureMapReady() {
    if (typeof window === 'undefined') return
    if (marsMap || !options.mapContainerRef.value) return

    mapError.value = null
    try {
      const mars3d = await loadMars3D() as {
        Map: new (container: HTMLElement, options?: Record<string, unknown>) => any
      }
      mars3dLib = mars3d as any
      if (!options.mapContainerRef.value) return
      marsMap = new mars3d.Map(options.mapContainerRef.value, {
        scene: {
          center: {
            lng: mapView.value.centerLon,
            lat: mapView.value.centerLat,
            alt: zoomToHeight(mapView.value.zoom, mapView.value.centerLat),
            heading: 0,
            pitch: -80,
          },
        },
        basemaps: [
          {
            id: 'gaode_vec',
            name: '高德矢量',
            type: 'gaode',
            layer: 'vec',
            show: true,
          },
          {
            id: 'gaode_img',
            name: '高德影像',
            type: 'group',
            layers: [
              { type: 'gaode', layer: 'img_d' },
              { type: 'gaode', layer: 'img_z' },
            ],
          },
        ],
        control: {
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          vrButton: false,
          contextmenu: {
            preventDefault: true,
            hasDefault: false,
          },
        },
      })
      viewer = marsMap.viewer as Cesium.Viewer
      if (!viewer) {
        mapError.value = 'Mars3D 初始化失败（viewer 不可用）'
        return
      }
      const prefer3d = undergroundSliceEnabled.value || sceneMode.value === '3d'
      if (prefer3d) {
        if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
          viewer.scene.morphTo3D(0)
        }
        sceneMode.value = '3d'
      } else {
        if (viewer.scene.mode !== Cesium.SceneMode.SCENE2D) {
          viewer.scene.morphTo2D(0)
        }
        sceneMode.value = '2d'
      }
      applyUndergroundSlice(undergroundSliceEnabled.value)
      viewer.camera.percentageChanged = 0.01
      viewer.camera.changed.addEventListener(syncMapViewFromCamera)
      if (mars3dLib?.layer?.GraphicLayer) {
        graphicLayer = new mars3dLib.layer.GraphicLayer({
          isAutoEditing: true,
          isContinued: false,
          drawAddEventType: mars3dLib.EventType?.click || 'click',
          drawEndEventType: mars3dLib.EventType?.dblClick || 'dblClick',
          drawDelEventType: mars3dLib.EventType?.rightClick || 'rightClick',
        })
        if (typeof marsMap.addLayer === 'function') {
          marsMap.addLayer(graphicLayer)
        }
        bindLayerEvents()
      }
      bindMapEvents()
      bindDrawEvents()
      renderDraftGraphics()
      fitCurrentPipeView()
      mapReady.value = true
    } catch (error) {
      mapError.value = error instanceof Error ? error.message : 'Mars3D 初始化失败'
    }
  }

  if (typeof window !== 'undefined') {
    watch(
      () => options.mapContainerRef.value,
      (container) => {
        if (!container) return
        if (!options.open.value) return
        void ensureMapReady()
      },
      { immediate: true },
    )
  }

  watch(
    () => options.open.value,
    (open) => {
      if (!open) {
        destroyMap()
        return
      }
      void ensureMapReady()
    },
    { immediate: true },
  )

  watch(
    () => options.selectedFeature.value?.id,
    () => {
      selectedPoint.value = null
      hoveredLineIndex.value = null
      activeLineIndex.value = 0
      history.value = []
      redoHistory.value = []
      addPointMode.value = false
      deletePointMode.value = false
      hideContextMenu()
      hoverLengthHint.value.visible = false
      exitDrawMode()
      // 用新加载的 draftLines 重新推断图结构
      editorGraph.initFromLines(options.draftLines.value)
      renderDraftGraphics()
      fitCurrentPipeView()
    },
  )

  watch(
    () => options.draftLines.value,
    () => {
      if (skipDraftLinesWatch) {
        skipDraftLinesWatch = false
        return
      }
      renderDraftGraphics()
    },
    { deep: true },
  )

  watch(activeLineIndex, () => {
    renderDraftGraphics()
  })

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', destroyMap)
    window.addEventListener('keydown', handleKeydown)
  }

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', destroyMap)
      window.removeEventListener('keydown', handleKeydown)
    }
    clearDragReleaseFallback()
    destroyMap()
  })

  return {
    mapView,
    mapReady,
    activeLineIndex,
    selectedPoint,
    addPointMode,
    addNodeMode,
    snapEnabled,
    history,
    historyItems,
    canRedo,
    canUndo,
    redoDepth,
    activeHistoryIndex,
    totalPoints,
    totalLengthMeters,
    activeLineLengthMeters,
    isDirty,
    canDeletePoint,
    mapCursorClass,
    contextMenu,
    snapHintVisible,
    hoverLengthHint,
    mapError,
    deletePointMode,
    sceneMode,
    undergroundSliceEnabled,
    createFittedView,
    undoLast,
    redoLast,
    restoreFromHistory,
    resetDraft,
    stopDragging,
    toggleAddPointMode,
    toggleDeletePointMode,
    insertPointAtCanvasCenter,
    insertPointAtScreenPosition,
    placeGraphNodeAtScreen,
    zoomIn,
    zoomOut,
    setZoomLevel,
    fitCurrentPipeView,
    toggleSceneMode,
    setUndergroundSliceEnabled,
    setBasemapById,
    hideContextMenu,
    insertPointFromContextMenu,
    deletePointFromContextMenu,
    endEditing,
    deleteSelectedPoint,
    // --- 图结构 (Phase 1+2) ---
    editorGraph,
    drawMode,
    pendingEdgeType,
    connectSourceId,
    previewTarget,
    placeNodeType,
    enterPlaceNode,
    enterConnectFromNode,
    exitDrawMode,
    // --- 辅助函数（用于思维导图编辑器） ---
    screenToLonLat,
    worldToScreen,
    pickEntity,
  }
}
