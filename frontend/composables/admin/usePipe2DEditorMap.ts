import * as Cesium from 'cesium'
import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import { loadMars3D } from '~/utils/mars3d-loader'
import {
  buildFittedView,
  cloneLines,
  distanceToSegmentSquared,
  geometryToLines,
  isSamePoint,
  type Line,
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
}

type PipeLineMeta = {
  lineIndex: number
}

type PipePointMeta = {
  lineIndex: number
  pointIndex: number
}

type ContextMenuState = {
  visible: boolean
  x: number
  y: number
  canInsert: boolean
  canDelete: boolean
}

type HistoryItem = {
  index: number
  label: string
  points: number
  lengthMeters: number
}

type EditorSceneMode = '2d' | '3d'
type HoverLengthHint = {
  visible: boolean
  x: number
  y: number
  text: string
}

const VIEW_WIDTH = 980
const VIEW_HEIGHT = 560
const VIEW_PADDING = 30
const MIN_ZOOM = 14
const MAX_ZOOM = 20
const SNAP_PIXEL_THRESHOLD = 8
const DEFAULT_VIEW: PipeEditorMapView = {
  centerLon: 119.1895,
  centerLat: 26.0254,
  zoom: 18,
}

const FITTED_VIEW_OPTIONS = {
  defaultView: DEFAULT_VIEW,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  viewWidth: VIEW_WIDTH,
  viewHeight: VIEW_HEIGHT,
  viewPadding: VIEW_PADDING,
  tileSize: 256,
} as const

export function usePipe2DEditorMap(options: UsePipe2DEditorMapOptions) {
  const mapView = ref<PipeEditorMapView>({ ...DEFAULT_VIEW })
  const activeLineIndex = ref(0)
  const selectedPoint = ref<PipePointMeta | null>(null)
  const dragging = ref<PipePointMeta | null>(null)
  const ignoreNextClick = ref(false)
  const addPointMode = ref(false)
  const snapEnabled = ref(true)
  const history = ref<Lines[]>([])
  const redoHistory = ref<Lines[]>([])
  const deletePointMode = ref(false)
  const contextMenu = ref<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    canInsert: false,
    canDelete: false,
  })
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

  let marsMap: any | null = null
  let viewer: Cesium.Viewer | null = null
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let snapHintTimer: ReturnType<typeof setTimeout> | null = null
  let hoverHintTimer: ReturnType<typeof setTimeout> | null = null
  const currentLineEntities: Cesium.Entity[] = []
  const currentPointEntities: Cesium.Entity[] = []
  const contextMenuPoint = ref<Point | null>(null)
  const contextMenuPointMeta = ref<PipePointMeta | null>(null)

  const snapEndpointCandidates = computed<Point[]>(() => {
    const candidates: Point[] = []
    const seen = new Set<string>()
    for (const feature of options.pipes.value) {
      const lines = geometryToLines(feature.geometry)
      for (const line of lines) {
        if (line.length < 2) continue
        const endpoints: Point[] = [line[0], line[line.length - 1]]
        for (const pt of endpoints) {
          const key = `${pt[0].toFixed(8)},${pt[1].toFixed(8)}`
          if (seen.has(key)) continue
          seen.add(key)
          candidates.push(pt)
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
    const result: HistoryItem[] = []
    for (let i = history.value.length - 1; i >= 0; i--) {
      const snapshot = history.value[i]
      const points = snapshot.reduce((sum, line) => sum + line.length, 0)
      result.push({
        index: i,
        label: `回到第 ${i + 1} 步`,
        points,
        lengthMeters: sumLength(snapshot),
      })
    }
    return result
  })

  const mapCursorClass = computed(() => {
    if (dragging.value) return 'canvas--editing'
    return 'canvas--idle'
  })

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
  }

  function lineLengthMeters(line: Line) {
    if (!line || line.length < 2) return 0
    let total = 0
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]
      const b = line[i + 1]
      const geodesic = new Cesium.EllipsoidGeodesic(
        Cesium.Cartographic.fromDegrees(a[0], a[1]),
        Cesium.Cartographic.fromDegrees(b[0], b[1]),
      )
      total += geodesic.surfaceDistance || 0
    }
    return total
  }

  function sumLength(lines: Lines) {
    return lines.reduce((sum, line) => sum + lineLengthMeters(line), 0)
  }

  function estimateZoomFromHeight(height: number, latitude: number) {
    const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180))
    const metersPerPixel = Math.max(height / 800, 0.01)
    const zoom = Math.log2((156543.03392 * cosLat) / metersPerPixel)
    return clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM)
  }

  function zoomToHeight(zoom: number, latitude: number) {
    const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180))
    const metersPerPixel = (156543.03392 * cosLat) / (2 ** zoom)
    return Math.max(80, metersPerPixel * 780)
  }

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

  function toLonLat(cartesian: Cesium.Cartesian3): Point {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    const lon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(8))
    const lat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(8))
    return [lon, lat]
  }

  function screenToLonLat(screenPosition: Cesium.Cartesian2): Point | null {
    if (!viewer) return null
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

  function applyEndpointSnap(
    point: Point,
    screenPosition?: Cesium.Cartesian2,
    excludePoint?: Point | null,
  ): Point {
    if (!snapEnabled.value || !snapEndpointCandidates.value.length) return point
    const source = screenPosition || worldToScreen(point)
    if (!source) return point

    let best = point
    let bestDistanceSq = SNAP_PIXEL_THRESHOLD * SNAP_PIXEL_THRESHOLD
    for (const candidate of snapEndpointCandidates.value) {
      if (excludePoint && isSamePoint(candidate, excludePoint)) continue
      const projected = worldToScreen(candidate)
      if (!projected) continue
      const dx = projected.x - source.x
      const dy = projected.y - source.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq <= bestDistanceSq) {
        bestDistanceSq = distanceSq
        best = [candidate[0], candidate[1]]
      }
    }
    if (!isSamePoint(best, point)) {
      triggerSnapHint()
    }
    return best
  }

  function pushHistory() {
    history.value.push(cloneLines(options.draftLines.value))
    if (history.value.length > 10) history.value.shift()
    redoHistory.value = []
  }

  function triggerSnapHint() {
    snapHintVisible.value = true
    if (snapHintTimer) {
      clearTimeout(snapHintTimer)
    }
    snapHintTimer = setTimeout(() => {
      snapHintVisible.value = false
      snapHintTimer = null
    }, 800)
  }

  function hideContextMenu() {
    contextMenu.value.visible = false
  }

  function hideHoverLengthHint() {
    hoverLengthHint.value.visible = false
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
      hoverHintTimer = null
    }
  }

  function showHoverLengthHint(screenPosition: Cesium.Cartesian2, lineIndex: number) {
    const line = options.draftLines.value[lineIndex]
    if (!line || line.length < 2) {
      hideHoverLengthHint()
      return
    }
    hoverLengthHint.value = {
      visible: true,
      x: Math.round(screenPosition.x) + 12,
      y: Math.round(screenPosition.y) - 14,
      text: `长度：${lineLengthMeters(line).toFixed(1)} m`,
    }
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
    }
    hoverHintTimer = setTimeout(() => {
      hoverLengthHint.value.visible = false
      hoverHintTimer = null
    }, 2000)
  }

  function clearGraphics() {
    if (!viewer) return
    for (const entity of currentLineEntities) {
      viewer.entities.remove(entity)
    }
    for (const entity of currentPointEntities) {
      viewer.entities.remove(entity)
    }
    currentLineEntities.length = 0
    currentPointEntities.length = 0
  }

  function lineMetaOf(entity: Cesium.Entity | null): PipeLineMeta | null {
    if (!entity) return null
    const meta = (entity as any).__pipeLineMeta
    if (!meta || typeof meta !== 'object') return null
    if (!Number.isInteger(meta.lineIndex)) return null
    return { lineIndex: Number(meta.lineIndex) }
  }

  function pointMetaOf(entity: Cesium.Entity | null): PipePointMeta | null {
    if (!entity) return null
    const meta = (entity as any).__pipePointMeta
    if (!meta || typeof meta !== 'object') return null
    if (!Number.isInteger(meta.lineIndex) || !Number.isInteger(meta.pointIndex)) return null
    return {
      lineIndex: Number(meta.lineIndex),
      pointIndex: Number(meta.pointIndex),
    }
  }

  function resolvePipeBaseColor() {
    const properties = (options.selectedFeature.value?.properties || {}) as Record<string, unknown>
    const medium = String(
      properties.medium
      || properties.media
      || properties.type
      || properties.category
      || properties.pipelineType
      || '',
    ).toLowerCase()

    if (/(supply|water|给水|供水)/.test(medium)) return '#60a5fa'
    if (/(drain|排水|rain|storm)/.test(medium)) return '#34d399'
    if (/(sewage|污水|waste)/.test(medium)) return '#34d399'
    if (/(fire|消防)/.test(medium)) return '#f87171'
    return '#64748b'
  }

  function renderDraftGraphics() {
    if (!viewer) return
    const currentViewer = viewer
    clearGraphics()
    const baseColor = resolvePipeBaseColor()

    options.draftLines.value.forEach((line, lineIndex) => {
      if (line.length < 2) return
      const activeLine = lineIndex === activeLineIndex.value
      const hoveredLine = hoveredLineIndex.value === lineIndex
      const lineEntity = currentViewer.entities.add({
        polyline: {
          positions: line.map(toCartesian),
          width: activeLine || hoveredLine ? 4 : 3,
          clampToGround: true,
          material: activeLine || hoveredLine
            ? new Cesium.PolylineGlowMaterialProperty({
              glowPower: activeLine ? 0.2 : 0.14,
              color: Cesium.Color.fromCssColorString('#6366f1').withAlpha(0.95),
            })
            : Cesium.Color.fromCssColorString(baseColor).withAlpha(0.95),
        },
      })
      ;(lineEntity as any).__pipeLineMeta = { lineIndex }
      currentLineEntities.push(lineEntity)

      line.forEach((point, pointIndex) => {
        const active = selectedPoint.value?.lineIndex === lineIndex
          && selectedPoint.value?.pointIndex === pointIndex
        if (active) {
          const haloEntity = currentViewer.entities.add({
            position: toCartesian(point),
            point: {
              pixelSize: 19,
              color: Cesium.Color.fromCssColorString('#6366f1').withAlpha(0.3),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
          ;(haloEntity as any).__pipePointMeta = { lineIndex, pointIndex }
          currentPointEntities.push(haloEntity)
        }
        const shadowEntity = currentViewer.entities.add({
          position: toCartesian(point),
          point: {
            pixelSize: active ? 13 : 12,
            color: Cesium.Color.fromCssColorString('#1e293b').withAlpha(0.14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
        ;(shadowEntity as any).__pipePointMeta = { lineIndex, pointIndex }
        currentPointEntities.push(shadowEntity)
        const pointEntity = currentViewer.entities.add({
          position: toCartesian(point),
          point: {
            pixelSize: active ? 11 : 10,
            color: active
              ? Cesium.Color.fromCssColorString('#6366f1')
              : Cesium.Color.fromCssColorString('#60a5fa'),
            outlineColor: Cesium.Color.fromCssColorString('#e2e8f0'),
            outlineWidth: active ? 2 : 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
        ;(pointEntity as any).__pipePointMeta = { lineIndex, pointIndex }
        currentPointEntities.push(pointEntity)
      })
    })
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

  function pickEntity(screenPosition: Cesium.Cartesian2 | undefined) {
    if (!viewer || !screenPosition) return null
    const picked = viewer.scene.pick(screenPosition)
    if (!picked || !Cesium.defined(picked)) return null
    const id = (picked as any).id
    if (id instanceof Cesium.Entity) return id
    return null
  }

  function selectPoint(lineIndex: number, pointIndex: number) {
    activeLineIndex.value = lineIndex
    selectedPoint.value = { lineIndex, pointIndex }
    renderDraftGraphics()
  }

  function startDraggingByMeta(meta: PipePointMeta) {
    if (options.saving.value) return
    pushHistory()
    dragging.value = meta
    selectPoint(meta.lineIndex, meta.pointIndex)
    setCameraControlsEnabled(false)
  }

  function stopDragging() {
    if (dragging.value) {
      ignoreNextClick.value = true
    }
    dragging.value = null
    setCameraControlsEnabled(true)
  }

  function insertPointAtBestSegment(point: Point) {
    let bestLineIndex = -1
    let bestSegmentIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY

    options.draftLines.value.forEach((line, lineIndex) => {
      if (!line || line.length < 2) return
      for (let i = 0; i < line.length - 1; i++) {
        const d = distanceToSegmentSquared(point, line[i], line[i + 1])
        if (d < bestDistance) {
          bestDistance = d
          bestLineIndex = lineIndex
          bestSegmentIndex = i
        }
      }
    })

    if (bestLineIndex < 0 || bestSegmentIndex < 0) return
    const line = options.draftLines.value[bestLineIndex]
    if (!line) return

    pushHistory()
    line.splice(bestSegmentIndex + 1, 0, point)
    activeLineIndex.value = bestLineIndex
    selectedPoint.value = { lineIndex: bestLineIndex, pointIndex: bestSegmentIndex + 1 }
    renderDraftGraphics()
  }

  function insertPointAtCanvasCenter() {
    if (!viewer || !options.selectedFeature.value || options.saving.value) return
    const center = new Cesium.Cartesian2(
      Math.round(viewer.canvas.clientWidth / 2),
      Math.round(viewer.canvas.clientHeight / 2),
    )
    insertPointAtScreenPosition(center.x, center.y)
  }

  function insertPointAtScreenPosition(x: number, y: number) {
    if (!viewer || !options.selectedFeature.value || options.saving.value) return false
    const screen = new Cesium.Cartesian2(Math.round(x), Math.round(y))
    const point = screenToLonLat(screen)
    if (!point) return false
    insertPointAtBestSegment(applyEndpointSnap(point, screen))
    return true
  }

  function deletePointByMeta(meta: PipePointMeta) {
    const line = options.draftLines.value[meta.lineIndex]
    if (!line || line.length <= 2) return
    pushHistory()
    line.splice(meta.pointIndex, 1)
    selectedPoint.value = null
    renderDraftGraphics()
  }

  function toggleDeletePointMode() {
    if (!deletePointMode.value) {
      addPointMode.value = false
    }
    deletePointMode.value = !deletePointMode.value
  }

  function toggleAddPointMode() {
    if (!addPointMode.value) {
      deletePointMode.value = false
    }
    addPointMode.value = !addPointMode.value
  }

  function handleHoverHint(movement: Cesium.ScreenSpaceEventHandler.MotionEvent) {
    if (!viewer) return
    const pickedEntity = pickEntity(movement.endPosition)
    const pointMeta = pointMetaOf(pickedEntity)
    if (pointMeta) {
      if (hoveredLineIndex.value !== pointMeta.lineIndex) {
        hoveredLineIndex.value = pointMeta.lineIndex
        renderDraftGraphics()
      }
      showHoverLengthHint(movement.endPosition, pointMeta.lineIndex)
      return
    }
    const lineMeta = lineMetaOf(pickedEntity)
    if (lineMeta) {
      if (hoveredLineIndex.value !== lineMeta.lineIndex) {
        hoveredLineIndex.value = lineMeta.lineIndex
        renderDraftGraphics()
      }
      showHoverLengthHint(movement.endPosition, lineMeta.lineIndex)
      return
    }
    if (hoveredLineIndex.value !== null) {
      hoveredLineIndex.value = null
      renderDraftGraphics()
    }
    hideHoverLengthHint()
  }

  function undoLast() {
    const prev = history.value.pop()
    if (!prev) return
    redoHistory.value.push(cloneLines(options.draftLines.value))
    options.draftLines.value = cloneLines(prev)
    selectedPoint.value = null
    hideContextMenu()
    renderDraftGraphics()
  }

  function redoLast() {
    const next = redoHistory.value.pop()
    if (!next) return
    history.value.push(cloneLines(options.draftLines.value))
    if (history.value.length > 10) history.value.shift()
    options.draftLines.value = cloneLines(next)
    selectedPoint.value = null
    hideContextMenu()
    renderDraftGraphics()
  }

  function restoreFromHistory(index: number) {
    if (index < 0 || index >= history.value.length) return
    const target = history.value[index]
    const current = cloneLines(options.draftLines.value)
    const newer = history.value
      .slice(index + 1)
      .map(snapshot => cloneLines(snapshot))
    newer.push(current)
    redoHistory.value = newer
    history.value = history.value
      .slice(0, index)
      .map(snapshot => cloneLines(snapshot))
    options.draftLines.value = cloneLines(target)
    selectedPoint.value = null
    hideContextMenu()
    renderDraftGraphics()
  }

  function resetDraft() {
    options.draftLines.value = cloneLines(options.originalLines.value)
    history.value = []
    redoHistory.value = []
    selectedPoint.value = null
    addPointMode.value = false
    deletePointMode.value = false
    hideContextMenu()
    options.actionMessage.value = null
    renderDraftGraphics()
  }

  function deleteSelectedPoint() {
    if (!selectedPoint.value) return
    const { lineIndex, pointIndex } = selectedPoint.value
    const line = options.draftLines.value[lineIndex]
    if (!line || line.length <= 2) return
    pushHistory()
    line.splice(pointIndex, 1)
    selectedPoint.value = null
    hideContextMenu()
    renderDraftGraphics()
  }

  function endEditing() {
    dragging.value = null
    selectedPoint.value = null
    addPointMode.value = false
    deletePointMode.value = false
    hideContextMenu()
    hideHoverLengthHint()
    setCameraControlsEnabled(true)
    renderDraftGraphics()
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

  function openContextMenu(screenPosition: Cesium.Cartesian2) {
    const currentViewer = viewer
    if (!currentViewer) return

    const pickedEntity = pickEntity(screenPosition)
    const pointMeta = pointMetaOf(pickedEntity)
    const lineMeta = lineMetaOf(pickedEntity)
    const point = screenToLonLat(screenPosition)
    contextMenuPoint.value = point
    contextMenuPointMeta.value = pointMeta

    if (pointMeta) {
      selectPoint(pointMeta.lineIndex, pointMeta.pointIndex)
    } else if (lineMeta) {
      activeLineIndex.value = lineMeta.lineIndex
      renderDraftGraphics()
    }

    const activeLine = options.draftLines.value[activeLineIndex.value]
    const canInsert = Boolean(point && activeLine && activeLine.length >= 2)
    const canDeleteFromMeta = pointMeta
      ? ((options.draftLines.value[pointMeta.lineIndex]?.length || 0) > 2)
      : false

    const rect = currentViewer.canvas.getBoundingClientRect()
    const x = Math.max(6, Math.min(screenPosition.x, rect.width - 170))
    const y = Math.max(6, Math.min(screenPosition.y, rect.height - 126))

    contextMenu.value = {
      visible: true,
      x,
      y,
      canInsert,
      canDelete: canDeletePoint.value || canDeleteFromMeta,
    }
  }

  function insertPointFromContextMenu() {
    if (!contextMenuPoint.value) return
    insertPointAtBestSegment(contextMenuPoint.value)
    hideContextMenu()
  }

  function deletePointFromContextMenu() {
    if (!canDeletePoint.value && contextMenuPointMeta.value) {
      const { lineIndex, pointIndex } = contextMenuPointMeta.value
      const line = options.draftLines.value[lineIndex]
      if (line && line.length > 2) {
        pushHistory()
        line.splice(pointIndex, 1)
        selectedPoint.value = null
        hideContextMenu()
        renderDraftGraphics()
      }
      return
    }
    deleteSelectedPoint()
    hideContextMenu()
  }

  function shouldIgnoreShortcutTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null
    if (!el) return false
    const tag = el.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (el.isContentEditable) return true
    return false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!options.open.value || options.saving.value) return
    if (shouldIgnoreShortcutTarget(event.target)) return

    const key = event.key.toLowerCase()
    const isMod = event.metaKey || event.ctrlKey
    if (isMod && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undoLast()
      return
    }
    if ((isMod && key === 'y') || (isMod && key === 'z' && event.shiftKey)) {
      event.preventDefault()
      redoLast()
      return
    }
    if (key === 'escape') {
      event.preventDefault()
      if (options.requestClose) {
        options.requestClose()
      } else {
        endEditing()
      }
      return
    }
    if (key === 'i') {
      event.preventDefault()
      toggleAddPointMode()
      return
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      deleteSelectedPoint()
      return
    }
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

  function bindMapEvents() {
    if (!viewer || handler) return
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (options.saving.value) return
      const pickedEntity = pickEntity(movement.position)
      const pointMeta = pointMetaOf(pickedEntity)
      if (!pointMeta) return
      if (deletePointMode.value) return
      startDraggingByMeta(pointMeta)
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!dragging.value) {
        handleHoverHint(movement)
        return
      }
      const point = screenToLonLat(movement.endPosition)
      if (!point) return
      const currentLine = options.draftLines.value[dragging.value.lineIndex]
      if (!currentLine) return
      const pointIndex = dragging.value.pointIndex
      const beforePoint = currentLine[pointIndex]
      currentLine[pointIndex] = applyEndpointSnap(point, movement.endPosition, beforePoint)
      renderDraftGraphics()
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => {
      stopDragging()
    }, Cesium.ScreenSpaceEventType.LEFT_UP)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!viewer) return
      hideContextMenu()
      if (ignoreNextClick.value) {
        ignoreNextClick.value = false
        return
      }

      const pickedEntity = pickEntity(movement.position)
      const pointMeta = pointMetaOf(pickedEntity)
      if (pointMeta) {
        if (deletePointMode.value) {
          deletePointByMeta(pointMeta)
          return
        }
        selectPoint(pointMeta.lineIndex, pointMeta.pointIndex)
        return
      }

      const lineMeta = lineMetaOf(pickedEntity)
      if (lineMeta) {
        activeLineIndex.value = lineMeta.lineIndex
        renderDraftGraphics()
        return
      }

      if (!addPointMode.value || options.saving.value || !options.selectedFeature.value) return
      const point = screenToLonLat(movement.position)
      if (!point) return
      const snappedPoint = applyEndpointSnap(point, movement.position)
      insertPointAtBestSegment(snappedPoint)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (options.saving.value) return
      openContextMenu(movement.position)
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  function destroyMap() {
    hideContextMenu()
    hideHoverLengthHint()
    snapHintVisible.value = false
    contextMenuPoint.value = null
    contextMenuPointMeta.value = null
    hoveredLineIndex.value = null
    if (handler) {
      handler.destroy()
      handler = null
    }
    if (viewer) {
      viewer.camera.changed.removeEventListener(syncMapViewFromCamera)
      clearGraphics()
      viewer = null
    }
    if (marsMap && typeof marsMap.destroy === 'function') {
      marsMap.destroy()
    }
    marsMap = null
  }

  async function ensureMapReady() {
    if (typeof window === 'undefined') return
    if (marsMap || !options.mapContainerRef.value) return

    mapError.value = null
    try {
      const mars3d = await loadMars3D() as {
        Map: new (container: HTMLElement, options?: Record<string, unknown>) => any
      }
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
      bindMapEvents()
      renderDraftGraphics()
      fitCurrentPipeView()
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
      renderDraftGraphics()
      fitCurrentPipeView()
    },
  )

  watch(
    () => options.draftLines.value,
    () => {
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
    if (snapHintTimer) {
      clearTimeout(snapHintTimer)
      snapHintTimer = null
    }
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
      hoverHintTimer = null
    }
    destroyMap()
  })

  return {
    mapView,
    activeLineIndex,
    selectedPoint,
    addPointMode,
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
    selectPoint,
    stopDragging,
    toggleAddPointMode,
    toggleDeletePointMode,
    insertPointAtCanvasCenter,
    insertPointAtScreenPosition,
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
  }
}
