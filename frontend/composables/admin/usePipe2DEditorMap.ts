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
const SELECT_POINT_THRESHOLD = 12
const SELECT_LINE_THRESHOLD = 16
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
  let mars3dLib: any | null = null
  let viewer: Cesium.Viewer | null = null
  let graphicLayer: any | null = null
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let snapHintTimer: ReturnType<typeof setTimeout> | null = null
  let hoverHintTimer: ReturnType<typeof setTimeout> | null = null
  let hoverRafId: number | null = null
  let pendingHoverPosition: Cesium.Cartesian2 | null = null
  let dragReleaseFallback: ((event: PointerEvent) => void) | null = null
  let skipDraftLinesWatch = false
  let layerEventsBound = false
  let dragEditHistoryPushed = false
  let dragEditStartLines: Lines | null = null
  const lineGraphicMap = new Map<number, any>()
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

  function syncHoveredLine(nextLineIndex: number | null) {
    if (hoveredLineIndex.value === nextLineIndex) return
    hoveredLineIndex.value = nextLineIndex
    // In Mars3D edit mode, full redraw on hover is expensive and can freeze interaction.
    if (!graphicLayer) {
      renderDraftGraphics()
    }
  }

  function clearGraphics() {
    if (graphicLayer && typeof graphicLayer.clear === 'function') {
      graphicLayer.clear(true)
      lineGraphicMap.clear()
    }
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

  function lineIndexOfGraphic(graphic: any): number {
    if (!graphic) return -1
    const attrLineIndex = Number(graphic?.attr?.lineIndex)
    if (Number.isInteger(attrLineIndex) && attrLineIndex >= 0) return attrLineIndex
    const metaLineIndex = Number(graphic?.__pipeLineMeta?.lineIndex)
    if (Number.isInteger(metaLineIndex) && metaLineIndex >= 0) return metaLineIndex
    return -1
  }

  function toLineFromGraphic(graphic: any): Line {
    const positions = (graphic?.positions || graphic?.positionsShow || []) as Array<Cesium.Cartesian3 | number[]>
    const line: Line = []
    for (const item of positions) {
      if (Array.isArray(item)) {
        if (item.length >= 2 && Number.isFinite(item[0]) && Number.isFinite(item[1])) {
          line.push([Number(item[0]), Number(item[1])])
        }
        continue
      }
      if (item && typeof item === 'object') {
        line.push(toLonLat(item as Cesium.Cartesian3))
      }
    }
    return line
  }

  function syncDraftLinesFromLayer() {
    if (!graphicLayer) return
    const nextLines: Lines = []
    for (const [lineIndex, graphic] of lineGraphicMap.entries()) {
      if (!graphic) continue
      const line = toLineFromGraphic(graphic)
      if (line.length >= 2) {
        nextLines[lineIndex] = line
      }
    }
    const normalized = nextLines.filter((line): line is Line => Array.isArray(line) && line.length >= 2)
    if (!normalized.length) return
    skipDraftLinesWatch = true
    options.draftLines.value = cloneLines(normalized)
  }

  function getNearestPointIndex(line: Line, target: Point) {
    if (!line.length) return -1
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < line.length; i += 1) {
      const dx = line[i][0] - target[0]
      const dy = line[i][1] - target[1]
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    return bestIndex
  }

  function getChangedPointIndex(beforeLine: Line | undefined, afterLine: Line | undefined) {
    if (!beforeLine?.length || !afterLine?.length) return -1
    const limit = Math.min(beforeLine.length, afterLine.length)
    if (!limit) return -1
    let bestIndex = 0
    let bestDistance = -1
    for (let i = 0; i < limit; i += 1) {
      const dx = afterLine[i][0] - beforeLine[i][0]
      const dy = afterLine[i][1] - beforeLine[i][1]
      const distance = dx * dx + dy * dy
      if (distance > bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    if (afterLine.length > beforeLine.length) {
      return Math.min(afterLine.length - 1, bestIndex + 1)
    }
    return bestIndex
  }

  function startEditingActiveLine() {
    const activeGraphic = lineGraphicMap.get(activeLineIndex.value)
    if (graphicLayer && activeGraphic && typeof graphicLayer.startEditing === 'function') {
      graphicLayer.startEditing(activeGraphic)
    }
  }

  function bindLayerEvents() {
    if (!graphicLayer || !mars3dLib || layerEventsBound) return
    layerEventsBound = true
    const eventType = mars3dLib.EventType as Record<string, string>

    graphicLayer.on(eventType.click, (event: any) => {
      const lineIndex = lineIndexOfGraphic(event?.graphic)
      if (lineIndex < 0) return
      activeLineIndex.value = lineIndex
      const clickedPoint = event?.cartesian ? toLonLat(event.cartesian as Cesium.Cartesian3) : null
      if (clickedPoint) {
        const line = options.draftLines.value[lineIndex]
        if (line?.length) {
          const pointIndex = getNearestPointIndex(line, clickedPoint)
          if (pointIndex >= 0) {
            selectedPoint.value = { lineIndex, pointIndex }
          }
        }
      }
      if (typeof graphicLayer.startEditing === 'function' && event?.graphic) {
        graphicLayer.startEditing(event.graphic)
      }
      renderDraftGraphics()
    })

    const syncHandler = (event: any) => {
      const lineIndex = lineIndexOfGraphic(event?.graphic)
      if (lineIndex >= 0) {
        activeLineIndex.value = lineIndex
      }
      syncDraftLinesFromLayer()
      const currentLine = options.draftLines.value[activeLineIndex.value]
      if (currentLine?.length) {
        let pointIndex = currentLine.length - 1
        if (event?.cartesian) {
          pointIndex = getNearestPointIndex(currentLine, toLonLat(event.cartesian as Cesium.Cartesian3))
        } else if (dragEditStartLines) {
          const changedIndex = getChangedPointIndex(
            dragEditStartLines[activeLineIndex.value],
            currentLine,
          )
          if (changedIndex >= 0) pointIndex = changedIndex
        }
        selectedPoint.value = { lineIndex: activeLineIndex.value, pointIndex }
      }
    }

    if (eventType.editMovePoint) graphicLayer.on(eventType.editMovePoint, (event: any) => {
      syncHandler(event)
      dragging.value = null
      setCameraControlsEnabled(true)
      clearDragReleaseFallback()
    })
    if (eventType.editAddPoint) graphicLayer.on(eventType.editAddPoint, syncHandler)
    if (eventType.editRemovePoint) graphicLayer.on(eventType.editRemovePoint, syncHandler)
    if (eventType.editStop) graphicLayer.on(eventType.editStop, () => {
      syncDraftLinesFromLayer()
      dragging.value = null
      dragEditHistoryPushed = false
      dragEditStartLines = null
      setCameraControlsEnabled(true)
      clearDragReleaseFallback()
    })
    if (eventType.editMouseUp) graphicLayer.on(eventType.editMouseUp, () => {
      dragging.value = null
      setCameraControlsEnabled(true)
      clearDragReleaseFallback()
    })
    if (eventType.editMouseDown) graphicLayer.on(eventType.editMouseDown, () => {
      if (!dragEditHistoryPushed) {
        pushHistory()
        dragEditHistoryPushed = true
        dragEditStartLines = cloneLines(options.draftLines.value)
      }
      dragging.value = selectedPoint.value || { lineIndex: activeLineIndex.value, pointIndex: 0 }
      setCameraControlsEnabled(false)
      installDragReleaseFallback()
    })
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
    dragEditHistoryPushed = false
    dragEditStartLines = null
    clearGraphics()
    const baseColor = resolvePipeBaseColor()

    if (graphicLayer && mars3dLib) {
      options.draftLines.value.forEach((line, lineIndex) => {
        if (line.length < 2) return
        const activeLine = lineIndex === activeLineIndex.value
        const hoveredLine = hoveredLineIndex.value === lineIndex
        const graphic = new mars3dLib.graphic.PolylineEntity({
          positions: line.map((point) => [point[0], point[1], 0]),
          style: {
            width: activeLine || hoveredLine ? 4 : 3,
            color: activeLine || hoveredLine ? '#6366f1' : baseColor,
            opacity: 0.95,
            clampToGround: true,
          },
          attr: { lineIndex },
          hasEdit: true,
          hasMoveEdit: true,
          hasMidPoint: true,
        })
        ;(graphic as any).__pipeLineMeta = { lineIndex }
        if (graphic.entity) {
          ;(graphic.entity as any).__pipeLineMeta = { lineIndex }
        }
        graphicLayer.addGraphic(graphic)
        lineGraphicMap.set(lineIndex, graphic)
      })

      if (viewer && selectedPoint.value) {
        const line = options.draftLines.value[selectedPoint.value.lineIndex]
        const point = line?.[selectedPoint.value.pointIndex]
        if (point) {
          const halo = viewer.entities.add({
            position: toCartesian(point),
            point: {
              pixelSize: 18,
              color: Cesium.Color.fromCssColorString('#6366f1').withAlpha(0.3),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
          const core = viewer.entities.add({
            position: toCartesian(point),
            point: {
              pixelSize: 10,
              color: Cesium.Color.fromCssColorString('#6366f1'),
              outlineColor: Cesium.Color.fromCssColorString('#e2e8f0'),
              outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
          currentPointEntities.push(halo, core)
        }
      }

      startEditingActiveLine()
      return
    }

    if (!viewer) return
    const currentViewer = viewer

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
      // Add an invisible-but-pickable wider line to improve click hit area.
      const lineHitEntity = currentViewer.entities.add({
        polyline: {
          positions: line.map(toCartesian),
          width: activeLine || hoveredLine ? 14 : 12,
          clampToGround: true,
          material: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.01),
        },
      })
      ;(lineHitEntity as any).__pipeLineMeta = { lineIndex }
      currentLineEntities.push(lineHitEntity)

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
        // Add a larger transparent point so selecting nodes is easier.
        const pointHitEntity = currentViewer.entities.add({
          position: toCartesian(point),
          point: {
            pixelSize: active ? 20 : 18,
            color: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.01),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
        ;(pointHitEntity as any).__pipePointMeta = { lineIndex, pointIndex }
        currentPointEntities.push(pointHitEntity)
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

  function toWindowPosition(point: Point) {
    if (!viewer) return null
    const screen = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, toCartesian(point))
    if (!screen) return null
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null
    return screen
  }

  function findNearestPointMeta(screenPosition: Cesium.Cartesian2, thresholdPx = 16): PipePointMeta | null {
    let bestMeta: PipePointMeta | null = null
    let bestDistSq = thresholdPx * thresholdPx
    for (let lineIndex = 0; lineIndex < options.draftLines.value.length; lineIndex += 1) {
      const line = options.draftLines.value[lineIndex]
      for (let pointIndex = 0; pointIndex < line.length; pointIndex += 1) {
        const win = toWindowPosition(line[pointIndex])
        if (!win) continue
        const dx = win.x - screenPosition.x
        const dy = win.y - screenPosition.y
        const distSq = dx * dx + dy * dy
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          bestMeta = { lineIndex, pointIndex }
        }
      }
    }
    return bestMeta
  }

  function pointToSegmentDistanceSquared(p: Cesium.Cartesian2, a: Cesium.Cartesian2, b: Cesium.Cartesian2) {
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = p.x - a.x
    const apy = p.y - a.y
    const abLenSq = abx * abx + aby * aby
    if (abLenSq <= 1e-6) {
      return apx * apx + apy * apy
    }
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
    const cx = a.x + abx * t
    const cy = a.y + aby * t
    const dx = p.x - cx
    const dy = p.y - cy
    return dx * dx + dy * dy
  }

  function findNearestLineMeta(screenPosition: Cesium.Cartesian2, thresholdPx = 12): PipeLineMeta | null {
    let bestMeta: PipeLineMeta | null = null
    let bestDistSq = thresholdPx * thresholdPx
    for (let lineIndex = 0; lineIndex < options.draftLines.value.length; lineIndex += 1) {
      const line = options.draftLines.value[lineIndex]
      for (let segmentIndex = 0; segmentIndex < line.length - 1; segmentIndex += 1) {
        const a = toWindowPosition(line[segmentIndex])
        const b = toWindowPosition(line[segmentIndex + 1])
        if (!a || !b) continue
        const distSq = pointToSegmentDistanceSquared(screenPosition, a, b)
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          bestMeta = { lineIndex }
        }
      }
    }
    return bestMeta
  }

  function selectPoint(lineIndex: number, pointIndex: number) {
    activeLineIndex.value = lineIndex
    selectedPoint.value = { lineIndex, pointIndex }
    renderDraftGraphics()
    startEditingActiveLine()
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
    clearDragReleaseFallback()
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
    startEditingActiveLine()
  }

  function toggleAddPointMode() {
    if (!addPointMode.value) {
      deletePointMode.value = false
    }
    addPointMode.value = !addPointMode.value
    startEditingActiveLine()
  }

  function handleHoverHint(screenPosition: Cesium.Cartesian2) {
    if (!viewer) return
    if (dragging.value) {
      hideHoverLengthHint()
      return
    }
    const pickedEntity = pickEntity(screenPosition)
    const pointMeta = findNearestPointMeta(screenPosition, SELECT_POINT_THRESHOLD)
    if (pointMeta) {
      syncHoveredLine(pointMeta.lineIndex)
      showHoverLengthHint(screenPosition, pointMeta.lineIndex)
      return
    }
    const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(screenPosition, SELECT_LINE_THRESHOLD)
    if (lineMeta) {
      syncHoveredLine(lineMeta.lineIndex)
      showHoverLengthHint(screenPosition, lineMeta.lineIndex)
      return
    }
    syncHoveredLine(null)
    hideHoverLengthHint()
  }

  function queueHoverHint(screenPosition: Cesium.Cartesian2) {
    if (typeof window === 'undefined') return
    pendingHoverPosition = new Cesium.Cartesian2(screenPosition.x, screenPosition.y)
    if (hoverRafId !== null) return
    hoverRafId = window.requestAnimationFrame(() => {
      hoverRafId = null
      const next = pendingHoverPosition
      pendingHoverPosition = null
      if (!next) return
      handleHoverHint(next)
    })
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
    const pointMeta = findNearestPointMeta(screenPosition, SELECT_POINT_THRESHOLD)
    const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(screenPosition, SELECT_LINE_THRESHOLD)
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

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      queueHoverHint(movement.endPosition)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => {
      if (dragging.value) {
        stopDragging()
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!viewer) return
      hideContextMenu()
      if (ignoreNextClick.value) {
        ignoreNextClick.value = false
        return
      }

      const pickedEntity = pickEntity(movement.position)
      const pointMeta = findNearestPointMeta(movement.position, SELECT_POINT_THRESHOLD)

      if (deletePointMode.value) {
        if (pointMeta) {
          deletePointByMeta(pointMeta)
        }
        return
      }

      if (addPointMode.value && !options.saving.value && options.selectedFeature.value) {
        const point = screenToLonLat(movement.position)
        if (!point) return
        const snappedPoint = applyEndpointSnap(point, movement.position)
        insertPointAtBestSegment(snappedPoint)
        return
      }

      if (pointMeta) {
        selectPoint(pointMeta.lineIndex, pointMeta.pointIndex)
        return
      }

      const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(movement.position, SELECT_LINE_THRESHOLD)
      if (lineMeta) {
        activeLineIndex.value = lineMeta.lineIndex
        startEditingActiveLine()
        renderDraftGraphics()
        return
      }

      selectedPoint.value = null
      renderDraftGraphics()
      return
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
    clearDragReleaseFallback()
    if (hoverRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(hoverRafId)
      hoverRafId = null
    }
    pendingHoverPosition = null
    layerEventsBound = false
    if (handler) {
      handler.destroy()
      handler = null
    }
    if (graphicLayer && typeof graphicLayer.remove === 'function') {
      graphicLayer.remove(true)
    }
    graphicLayer = null
    lineGraphicMap.clear()
    if (viewer) {
      viewer.camera.changed.removeEventListener(syncMapViewFromCamera)
      clearGraphics()
      viewer = null
    }
    if (marsMap && typeof marsMap.destroy === 'function') {
      marsMap.destroy()
    }
    marsMap = null
    mars3dLib = null
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
    if (snapHintTimer) {
      clearTimeout(snapHintTimer)
      snapHintTimer = null
    }
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
      hoverHintTimer = null
    }
    clearDragReleaseFallback()
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
