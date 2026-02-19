import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import {
  buildFittedView,
  cloneLines,
  distanceToSegmentSquared,
  geometryToLines,
  isSamePoint,
  lonLatToWorld,
  worldToLonLat,
  type Lines,
  type PipeEditorMapView,
  type Point,
} from '~/utils/pipe2d-geometry'

type Message = {
  type: 'ok' | 'error'
  text: string
}

type MapTile = {
  key: string
  x: number
  y: number
  url: string
}

type UsePipe2DEditorMapOptions = {
  svgRef: Ref<SVGSVGElement | null>
  pipes: Ref<GeoJsonFeature[]>
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  draftLines: Ref<Lines>
  originalLines: Ref<Lines>
  saving: Ref<boolean>
  actionMessage: Ref<Message | null>
}

const VIEW_WIDTH = 980
const VIEW_HEIGHT = 560
const VIEW_PADDING = 30
const TILE_SIZE = 256
const MIN_ZOOM = 14
const MAX_ZOOM = 20
const SNAP_PIXEL_THRESHOLD = 12
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
  tileSize: TILE_SIZE,
} as const

export function usePipe2DEditorMap(options: UsePipe2DEditorMapOptions) {
  const mapView = ref<PipeEditorMapView>({ ...DEFAULT_VIEW })
  const activeLineIndex = ref(0)
  const selectedPoint = ref<{ lineIndex: number; pointIndex: number } | null>(null)
  const dragging = ref<{ lineIndex: number; pointIndex: number } | null>(null)
  const panning = ref<{
    startX: number
    startY: number
    centerWorldX: number
    centerWorldY: number
    moved: boolean
  } | null>(null)
  const ignoreNextClick = ref(false)
  const addPointMode = ref(false)
  const snapEnabled = ref(true)
  const history = ref<Lines[]>([])

  const projectedLines = computed(() => {
    return options.draftLines.value.map(line => line.map(point => projectPoint(point[0], point[1])))
  })

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

  const mapTiles = computed<MapTile[]>(() => {
    const tiles: MapTile[] = []
    const z = mapView.value.zoom
    const worldLimit = 2 ** z
    const { x: originX, y: originY } = getViewportOrigin()
    const tileStartX = Math.floor(originX / TILE_SIZE)
    const tileEndX = Math.floor((originX + VIEW_WIDTH) / TILE_SIZE)
    const tileStartY = Math.floor(originY / TILE_SIZE)
    const tileEndY = Math.floor((originY + VIEW_HEIGHT) / TILE_SIZE)

    for (let tx = tileStartX; tx <= tileEndX; tx++) {
      for (let ty = tileStartY; ty <= tileEndY; ty++) {
        if (ty < 0 || ty >= worldLimit) continue
        const wrappedX = ((tx % worldLimit) + worldLimit) % worldLimit
        tiles.push({
          key: `${z}-${wrappedX}-${ty}-${tx}`,
          x: tx * TILE_SIZE - originX,
          y: ty * TILE_SIZE - originY,
          url: `https://tile.openstreetmap.org/${z}/${wrappedX}/${ty}.png`,
        })
      }
    }

    return tiles
  })

  const totalPoints = computed(() => {
    return options.draftLines.value.reduce((sum, line) => sum + line.length, 0)
  })

  const isDirty = computed(() => {
    return JSON.stringify(options.draftLines.value) !== JSON.stringify(options.originalLines.value)
  })

  const canDeletePoint = computed(() => {
    if (!selectedPoint.value) return false
    const line = options.draftLines.value[selectedPoint.value.lineIndex]
    return Array.isArray(line) && line.length > 2
  })

  const mapCursorClass = computed(() => {
    if (dragging.value) return 'canvas--editing'
    if (panning.value) return 'canvas--panning'
    return 'canvas--idle'
  })

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
  }

  function getViewportOrigin(view = mapView.value) {
    const center = lonLatToWorld(view.centerLon, view.centerLat, view.zoom, TILE_SIZE)
    return {
      x: center.x - VIEW_WIDTH / 2,
      y: center.y - VIEW_HEIGHT / 2,
    }
  }

  function projectPoint(lon: number, lat: number) {
    const point = lonLatToWorld(lon, lat, mapView.value.zoom, TILE_SIZE)
    const origin = getViewportOrigin()
    return {
      x: point.x - origin.x,
      y: point.y - origin.y,
    }
  }

  function unprojectPoint(x: number, y: number): Point {
    const origin = getViewportOrigin()
    return worldToLonLat(origin.x + x, origin.y + y, mapView.value.zoom, TILE_SIZE)
  }

  function applyEndpointSnap(point: Point, excludePoint?: Point | null): Point {
    if (!snapEnabled.value || !snapEndpointCandidates.value.length) return point

    const source = projectPoint(point[0], point[1])
    let best = point
    let bestDistanceSq = SNAP_PIXEL_THRESHOLD * SNAP_PIXEL_THRESHOLD

    for (const candidate of snapEndpointCandidates.value) {
      if (excludePoint && isSamePoint(candidate, excludePoint)) continue
      const projected = projectPoint(candidate[0], candidate[1])
      const dx = projected.x - source.x
      const dy = projected.y - source.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq <= bestDistanceSq) {
        bestDistanceSq = distanceSq
        best = [candidate[0], candidate[1]]
      }
    }

    return best
  }

  function createFittedView(lines: Lines) {
    return buildFittedView(lines, FITTED_VIEW_OPTIONS)
  }

  function pushHistory() {
    history.value.push(cloneLines(options.draftLines.value))
    if (history.value.length > 40) history.value.shift()
  }

  function undoLast() {
    const prev = history.value.pop()
    if (!prev) return
    options.draftLines.value = cloneLines(prev)
    selectedPoint.value = null
  }

  function resetDraft() {
    options.draftLines.value = cloneLines(options.originalLines.value)
    history.value = []
    selectedPoint.value = null
    options.actionMessage.value = null
  }

  function selectPoint(lineIndex: number, pointIndex: number) {
    activeLineIndex.value = lineIndex
    selectedPoint.value = { lineIndex, pointIndex }
  }

  function startDragging(event: PointerEvent, lineIndex: number, pointIndex: number) {
    if (options.saving.value) return
    pushHistory()
    selectPoint(lineIndex, pointIndex)
    dragging.value = { lineIndex, pointIndex }
    const target = event.target as Element | null
    if (target && typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(event.pointerId)
    }
  }

  function stopDragging() {
    if (panning.value?.moved) {
      ignoreNextClick.value = true
    }
    dragging.value = null
    panning.value = null
  }

  function handlePointerMove(event: PointerEvent) {
    if (!options.svgRef.value) return
    const rect = options.svgRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (dragging.value) {
      const [lon, lat] = unprojectPoint(x, y)
      const current = options.draftLines.value[dragging.value.lineIndex]
      if (!current) return
      const pointIndex = dragging.value.pointIndex
      const beforePoint = current[pointIndex]
      current[pointIndex] = applyEndpointSnap([lon, lat], beforePoint)
      return
    }

    if (!panning.value) return

    const dx = x - panning.value.startX
    const dy = y - panning.value.startY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      panning.value.moved = true
    }

    const nextWorldX = panning.value.centerWorldX - dx
    const nextWorldY = panning.value.centerWorldY - dy
    const [centerLon, centerLat] = worldToLonLat(nextWorldX, nextWorldY, mapView.value.zoom)
    mapView.value = {
      ...mapView.value,
      centerLon,
      centerLat,
    }
  }

  function handleCanvasPointerDown(event: PointerEvent) {
    if (options.saving.value || !options.svgRef.value || dragging.value) return
    const target = event.target as Element | null
    if (target?.classList?.contains('pipe-point') || target?.classList?.contains('pipe-line')) {
      return
    }

    const rect = options.svgRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const centerWorld = lonLatToWorld(mapView.value.centerLon, mapView.value.centerLat, mapView.value.zoom)
    panning.value = {
      startX: x,
      startY: y,
      centerWorldX: centerWorld.x,
      centerWorldY: centerWorld.y,
      moved: false,
    }

    const canvas = event.currentTarget as Element | null
    if (canvas && typeof canvas.setPointerCapture === 'function') {
      canvas.setPointerCapture(event.pointerId)
    }
  }

  function zoomByStep(delta: number, screenX = VIEW_WIDTH / 2, screenY = VIEW_HEIGHT / 2) {
    const nextZoom = clamp(mapView.value.zoom + delta, MIN_ZOOM, MAX_ZOOM)
    if (nextZoom === mapView.value.zoom) return

    const anchorBefore = unprojectPoint(screenX, screenY)
    mapView.value = {
      ...mapView.value,
      zoom: nextZoom,
    }
    const anchorAfter = unprojectPoint(screenX, screenY)
    const beforeWorld = lonLatToWorld(anchorBefore[0], anchorBefore[1], nextZoom)
    const afterWorld = lonLatToWorld(anchorAfter[0], anchorAfter[1], nextZoom)
    const centerWorld = lonLatToWorld(mapView.value.centerLon, mapView.value.centerLat, nextZoom)
    const correctedCenter = worldToLonLat(
      centerWorld.x + (beforeWorld.x - afterWorld.x),
      centerWorld.y + (beforeWorld.y - afterWorld.y),
      nextZoom,
    )
    mapView.value = {
      ...mapView.value,
      centerLon: correctedCenter[0],
      centerLat: correctedCenter[1],
    }
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
  }

  function handleWheel(event: WheelEvent) {
    if (!options.svgRef.value) return
    const rect = options.svgRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (event.deltaY < 0) zoomByStep(1, x, y)
    else if (event.deltaY > 0) zoomByStep(-1, x, y)
  }

  function insertPointOnActiveLine(point: Point) {
    const line = options.draftLines.value[activeLineIndex.value]
    if (!line || line.length < 2) return

    let bestIndex = 0
    let minDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < line.length - 1; i++) {
      const d = distanceToSegmentSquared(point, line[i], line[i + 1])
      if (d < minDistance) {
        minDistance = d
        bestIndex = i
      }
    }

    pushHistory()
    line.splice(bestIndex + 1, 0, point)
    selectedPoint.value = { lineIndex: activeLineIndex.value, pointIndex: bestIndex + 1 }
  }

  function handleCanvasClick(event: MouseEvent) {
    if (ignoreNextClick.value) {
      ignoreNextClick.value = false
      return
    }
    if (!addPointMode.value || options.saving.value || !options.svgRef.value || !options.selectedFeature.value) return
    const rect = options.svgRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const point = applyEndpointSnap(unprojectPoint(x, y))
    insertPointOnActiveLine(point)
  }

  function deleteSelectedPoint() {
    if (!selectedPoint.value) return
    const { lineIndex, pointIndex } = selectedPoint.value
    const line = options.draftLines.value[lineIndex]
    if (!line || line.length <= 2) return
    pushHistory()
    line.splice(pointIndex, 1)
    selectedPoint.value = null
  }

  return {
    VIEW_WIDTH,
    VIEW_HEIGHT,
    TILE_SIZE,
    mapView,
    activeLineIndex,
    selectedPoint,
    addPointMode,
    snapEnabled,
    history,
    projectedLines,
    mapTiles,
    totalPoints,
    isDirty,
    canDeletePoint,
    mapCursorClass,
    createFittedView,
    undoLast,
    resetDraft,
    selectPoint,
    startDragging,
    stopDragging,
    handlePointerMove,
    handleCanvasPointerDown,
    zoomIn,
    zoomOut,
    fitCurrentPipeView,
    handleWheel,
    handleCanvasClick,
    deleteSelectedPoint,
  }
}
