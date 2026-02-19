<template>
  <div v-if="open" class="dialog">
    <div class="dialog__mask" @click="emit('close')" />
    <div class="dialog__panel" @click.stop>
      <header class="dialog__header">
        <div>
          <h3 class="dialog__title">管道二维编辑</h3>
          <p class="dialog__subtitle">2D 负责精修几何，保存后可在 3D 主图复核</p>
        </div>
        <div class="dialog__actions">
          <button class="btn" type="button" :disabled="loading" @click="loadPipes">刷新列表</button>
          <button class="btn" type="button" @click="emit('close')">关闭</button>
        </div>
      </header>

      <div class="dialog__body">
        <aside class="pane pane--list">
          <div class="pane__top">
            <input
              v-model.trim="searchTerm"
              class="admin-input"
              type="text"
              placeholder="搜索 ID / 名称 / 道路类型"
            >
          </div>
          <div v-if="loading" class="pane__state">加载中...</div>
          <div v-else-if="loadError" class="pane__state pane__state--error">{{ loadError }}</div>
          <ul v-else class="pipe-list">
            <li
              v-for="item in filteredPipes"
              :key="String(item.id)"
              :class="['pipe-list__item', { 'pipe-list__item--active': selectedFeatureId === String(item.id) }]"
              @click="selectedFeatureId = String(item.id)"
            >
              <div class="pipe-list__id">{{ String(item.id) }}</div>
              <div class="pipe-list__meta">
                <span>{{ pipeName(item) }}</span>
                <span>{{ classifyRoadToPipeCategory(item.properties?.highway) }}</span>
              </div>
            </li>
            <li v-if="!filteredPipes.length" class="pane__state">暂无可编辑管道</li>
          </ul>
        </aside>

        <section class="pane pane--editor">
          <div class="toolbar">
            <div class="toolbar__left">
              <span class="badge">{{ selectedFeature ? String(selectedFeature.id) : '未选择管道' }}</span>
              <span class="badge">{{ selectedFeature ? geometryTypeLabel : '—' }}</span>
              <span class="badge">节点 {{ totalPoints }}</span>
            </div>
            <div class="toolbar__right">
              <button
                class="btn"
                type="button"
                :disabled="!selectedFeature || !history.length || saving"
                @click="undoLast"
              >
                撤销
              </button>
              <button
                class="btn"
                type="button"
                :disabled="!selectedFeature || saving"
                @click="resetDraft"
              >
                还原
              </button>
              <button
                class="btn"
                type="button"
                :disabled="saving"
                @click="zoomOut"
              >
                缩小
              </button>
              <button
                class="btn"
                type="button"
                :disabled="saving"
                @click="zoomIn"
              >
                放大
              </button>
              <button
                class="btn"
                type="button"
                :disabled="!selectedFeature || saving"
                @click="fitCurrentPipeView"
              >
                适配视图
              </button>
              <span class="badge">Z{{ mapView.zoom }}</span>
              <button
                :class="['btn', { 'btn--active': addPointMode }]"
                type="button"
                :disabled="!selectedFeature || saving"
                @click="addPointMode = !addPointMode"
              >
                {{ addPointMode ? '结束插点' : '插点模式' }}
              </button>
              <button
                :class="['btn', { 'btn--active': snapEnabled }]"
                type="button"
                :disabled="saving"
                @click="snapEnabled = !snapEnabled"
              >
                {{ snapEnabled ? '端点吸附: 开' : '端点吸附: 关' }}
              </button>
              <button
                class="btn"
                type="button"
                :disabled="!canDeletePoint || saving"
                @click="deleteSelectedPoint"
              >
                删除选中点
              </button>
              <button
                class="btn btn--primary"
                type="button"
                :disabled="!selectedFeature || !isDirty || saving"
                @click="saveGeometry"
              >
                {{ saving ? '保存中...' : '保存几何' }}
              </button>
            </div>
          </div>

          <div class="canvas-wrap">
            <svg
              ref="svgRef"
              :viewBox="`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`"
              :class="['canvas', mapCursorClass]"
              @click="handleCanvasClick"
              @pointerdown="handleCanvasPointerDown"
              @pointermove="handlePointerMove"
              @pointerup="stopDragging"
              @pointerleave="stopDragging"
              @wheel.prevent="handleWheel"
            >
              <g class="map-tiles">
                <image
                  v-for="tile in mapTiles"
                  :key="tile.key"
                  :x="tile.x"
                  :y="tile.y"
                  :width="TILE_SIZE"
                  :height="TILE_SIZE"
                  :href="tile.url"
                  preserveAspectRatio="none"
                />
              </g>
              <rect class="map-mask" x="0" y="0" :width="VIEW_WIDTH" :height="VIEW_HEIGHT" />

              <g class="grid">
                <line
                  v-for="i in 9"
                  :key="`v-${i}`"
                  :x1="(VIEW_WIDTH / 10) * i"
                  y1="0"
                  :x2="(VIEW_WIDTH / 10) * i"
                  :y2="VIEW_HEIGHT"
                />
                <line
                  v-for="i in 5"
                  :key="`h-${i}`"
                  x1="0"
                  :y1="(VIEW_HEIGHT / 6) * i"
                  :x2="VIEW_WIDTH"
                  :y2="(VIEW_HEIGHT / 6) * i"
                />
              </g>

              <g v-if="projectedLines.length">
                <polyline
                  v-for="(line, lineIndex) in projectedLines"
                  :key="`line-${lineIndex}`"
                  :points="line.map(p => `${p.x},${p.y}`).join(' ')"
                  :class="[
                    'pipe-line',
                    lineIndex === activeLineIndex ? 'pipe-line--active' : '',
                  ]"
                  @click.stop="activeLineIndex = lineIndex"
                />

                <g v-for="(line, lineIndex) in projectedLines" :key="`pts-${lineIndex}`">
                  <circle
                    v-for="(point, pointIndex) in line"
                    :key="`pt-${lineIndex}-${pointIndex}`"
                    :cx="point.x"
                    :cy="point.y"
                    :r="selectedPoint?.lineIndex === lineIndex && selectedPoint?.pointIndex === pointIndex ? 7 : 5"
                    :class="[
                      'pipe-point',
                      selectedPoint?.lineIndex === lineIndex && selectedPoint?.pointIndex === pointIndex
                        ? 'pipe-point--active'
                        : '',
                    ]"
                    @click.stop="selectPoint(lineIndex, pointIndex)"
                    @pointerdown.stop="startDragging($event, lineIndex, pointIndex)"
                  />
                </g>
              </g>

              <text v-else class="canvas-empty" :x="VIEW_WIDTH / 2" :y="VIEW_HEIGHT / 2">
                当前管道缺少线几何数据
              </text>
            </svg>
          </div>
          <div class="canvas-attribution">Map data © OpenStreetMap contributors</div>

          <div class="hint">
            操作提示：鼠标拖动画布可平移，滚轮可缩放；拖拽节点可改线形；开启“插点模式”后点击线段附近可插点；开启“端点吸附”后拖拽/插点会自动贴合邻近端点。
          </div>

          <div v-if="actionMessage" :class="['message', actionMessage.type === 'error' ? 'message--error' : 'message--ok']">
            {{ actionMessage.text }}
          </div>
        </section>

        <aside class="pane pane--insight">
          <div class="insight-card">
            <div class="insight-card__title">穿透信息</div>
            <div class="insight-card__value">
              <span>{{ drilldown?.linkedBuildings?.length ?? 0 }}</span>
              <small>关联楼宇</small>
            </div>
            <div class="insight-card__detail">节点 {{ drilldown?.nodes?.length ?? 0 }} / 关系 {{ drilldown?.relations?.length ?? 0 }}</div>
          </div>

          <div class="insight-card">
            <div class="insight-card__title">下游追踪</div>
            <div class="insight-card__value">
              <span>{{ traceResult?.pathSegmentIds?.length ?? 0 }}</span>
              <small>段</small>
            </div>
            <div class="insight-card__detail">关联楼宇 {{ traceResult?.linkedBuildings?.length ?? 0 }}</div>
          </div>

          <div class="insight-card">
            <div class="insight-card__title">实时测点</div>
            <div class="insight-card__value">
              <span>{{ telemetryList.length }}</span>
              <small>条</small>
            </div>
            <div class="insight-card__detail">
              <div v-for="row in telemetryPreview" :key="`${row.pointId}-${row.metric}`">
                {{ row.metric }}: {{ row.value }} {{ row.unit || '' }}
              </div>
            </div>
          </div>

          <div class="insight-card">
            <div class="insight-card__title">编辑审计</div>
            <div class="insight-card__value">
              <span>{{ auditLogs.length }}</span>
              <small>条</small>
            </div>
            <div class="insight-card__detail">
              <div v-for="item in auditPreview" :key="item.id">
                {{ item.action }} · {{ item.changedBy }}
              </div>
            </div>
          </div>

          <div v-if="insightError" class="pane__state pane__state--error">{{ insightError }}</div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  geoFeatureService,
  type GeoFeaturePayload,
  type GeoJsonFeature,
} from '~/services/geo-features'
import {
  twinService,
  type TwinAuditItem,
  type TwinDrilldown,
  type TwinTelemetryPoint,
  type TwinTrace,
} from '~/services/twin'
import { classifyRoadToPipeCategory } from '~/utils/pipe-classifier'

type Point = [number, number]
type Line = Point[]
type Lines = Line[]

type Message = {
  type: 'ok' | 'error'
  text: string
}

type MapView = {
  centerLon: number
  centerLat: number
  zoom: number
}

type MapTile = {
  key: string
  x: number
  y: number
  url: string
}

const VIEW_WIDTH = 980
const VIEW_HEIGHT = 560
const VIEW_PADDING = 30
const TILE_SIZE = 256
const MIN_ZOOM = 14
const MAX_ZOOM = 20
const SNAP_PIXEL_THRESHOLD = 12
const DEFAULT_VIEW: MapView = {
  centerLon: 119.1895,
  centerLat: 26.0254,
  zoom: 18,
}

const props = defineProps<{
  open: boolean
  backendBaseUrl: string
  initialFeatureId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', id: string): void
}>()

const svgRef = ref<SVGSVGElement | null>(null)

const loading = ref(false)
const loadError = ref<string | null>(null)
const saving = ref(false)
const actionMessage = ref<Message | null>(null)

const pipes = ref<GeoJsonFeature[]>([])
const searchTerm = ref('')
const selectedFeatureId = ref('')

const draftLines = ref<Lines>([])
const originalLines = ref<Lines>([])
const mapView = ref<MapView>({ ...DEFAULT_VIEW })
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

const drilldown = ref<TwinDrilldown | null>(null)
const traceResult = ref<TwinTrace | null>(null)
const telemetryList = ref<TwinTelemetryPoint[]>([])
const auditLogs = ref<TwinAuditItem[]>([])
const insightError = ref<string | null>(null)

const selectedFeature = computed(() => {
  return pipes.value.find(item => String(item.id) === selectedFeatureId.value) || null
})

const filteredPipes = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  if (!q) return pipes.value
  return pipes.value.filter(item => {
    const id = String(item.id).toLowerCase()
    const name = pipeName(item).toLowerCase()
    const highway = String(item.properties?.highway || '').toLowerCase()
    return id.includes(q) || name.includes(q) || highway.includes(q)
  })
})

const projectedLines = computed(() => {
  return draftLines.value.map(line => line.map(point => projectPoint(point[0], point[1])))
})

const snapEndpointCandidates = computed<Point[]>(() => {
  const candidates: Point[] = []
  const seen = new Set<string>()
  for (const feature of pipes.value) {
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
  return draftLines.value.reduce((sum, line) => sum + line.length, 0)
})

const isDirty = computed(() => {
  return JSON.stringify(draftLines.value) !== JSON.stringify(originalLines.value)
})

const canDeletePoint = computed(() => {
  if (!selectedPoint.value) return false
  const line = draftLines.value[selectedPoint.value.lineIndex]
  return Array.isArray(line) && line.length > 2
})

const geometryTypeLabel = computed(() => {
  const t = selectedFeature.value?.geometry?.type
  if (t === 'MultiLineString') return '多线'
  if (t === 'LineString') return '单线'
  return String(t || '未知')
})

const telemetryPreview = computed(() => telemetryList.value.slice(0, 5))
const auditPreview = computed(() => auditLogs.value.slice(0, 5))
const mapCursorClass = computed(() => {
  if (dragging.value) return 'canvas--editing'
  if (panning.value) return 'canvas--panning'
  return 'canvas--idle'
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    loadPipes()
  }
)

watch(
  () => props.initialFeatureId,
  (id) => {
    if (!props.open || !id) return
    if (pipes.value.some(item => String(item.id) === id)) {
      selectedFeatureId.value = id
    }
  }
)

watch(selectedFeature, (feature) => {
  if (!feature) {
    draftLines.value = []
    originalLines.value = []
    selectedPoint.value = null
    history.value = []
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
  activeLineIndex.value = 0
  selectedPoint.value = null
  history.value = []
  addPointMode.value = false
  actionMessage.value = null
  const fitted = buildFittedView(draftLines.value)
  mapView.value = { ...fitted }
  loadInsights(String(feature.id))
})

function pipeName(feature: GeoJsonFeature) {
  return String(feature.properties?.name || feature.properties?.ref || '未命名')
}

function isPoint(input: unknown): input is Point {
  return Array.isArray(input)
    && input.length >= 2
    && Number.isFinite(Number(input[0]))
    && Number.isFinite(Number(input[1]))
}

function geometryToLines(geometry: GeoJsonFeature['geometry']): Lines {
  if (!geometry || typeof geometry !== 'object') return []
  const type = String(geometry.type || '')
  const coordinates = geometry.coordinates

  if (type === 'LineString' && Array.isArray(coordinates)) {
    const line = (coordinates as unknown[]).filter(isPoint).map(pair => [Number(pair[0]), Number(pair[1])] as Point)
    return line.length >= 2 ? [line] : []
  }

  if (type === 'MultiLineString' && Array.isArray(coordinates)) {
    return (coordinates as unknown[])
      .map(rawLine => Array.isArray(rawLine)
        ? rawLine.filter(isPoint).map(pair => [Number(pair[0]), Number(pair[1])] as Point)
        : [])
      .filter(line => line.length >= 2)
  }

  return []
}

function cloneLines(lines: Lines) {
  return lines.map(line => line.map(pair => [pair[0], pair[1]] as Point))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clampLatitude(lat: number) {
  return clamp(lat, -85.05112878, 85.05112878)
}

function isSamePoint(a: Point, b: Point, epsilon = 1e-9) {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

function lonLatToWorld(lon: number, lat: number, zoom: number) {
  const worldSize = TILE_SIZE * (2 ** zoom)
  const safeLat = clampLatitude(lat)
  const sin = Math.sin((safeLat * Math.PI) / 180)
  const x = ((lon + 180) / 360) * worldSize
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize
  return { x, y }
}

function worldToLonLat(x: number, y: number, zoom: number): Point {
  const worldSize = TILE_SIZE * (2 ** zoom)
  const lon = (x / worldSize) * 360 - 180
  const merc = Math.PI - (2 * Math.PI * y) / worldSize
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(merc))
  return [Number(lon.toFixed(8)), Number(clampLatitude(lat).toFixed(8))]
}

function getViewportOrigin(view = mapView.value) {
  const center = lonLatToWorld(view.centerLon, view.centerLat, view.zoom)
  return {
    x: center.x - VIEW_WIDTH / 2,
    y: center.y - VIEW_HEIGHT / 2,
  }
}

function projectPoint(lon: number, lat: number) {
  const point = lonLatToWorld(lon, lat, mapView.value.zoom)
  const origin = getViewportOrigin()
  return {
    x: point.x - origin.x,
    y: point.y - origin.y,
  }
}

function unprojectPoint(x: number, y: number): Point {
  const origin = getViewportOrigin()
  return worldToLonLat(origin.x + x, origin.y + y, mapView.value.zoom)
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

function buildFittedView(lines: Lines): MapView {
  const points = lines.flat()
  if (!points.length) return { ...DEFAULT_VIEW }

  let minLon = points[0][0]
  let maxLon = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]

  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const lonPad = Math.max((maxLon - minLon) * 0.15, 0.0002)
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.0002)
  minLon -= lonPad
  maxLon += lonPad
  minLat -= latPad
  maxLat += latPad

  let zoom = MIN_ZOOM
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const topLeft = lonLatToWorld(minLon, maxLat, z)
    const bottomRight = lonLatToWorld(maxLon, minLat, z)
    const spanX = Math.abs(bottomRight.x - topLeft.x)
    const spanY = Math.abs(bottomRight.y - topLeft.y)
    if (spanX <= VIEW_WIDTH - VIEW_PADDING * 2 && spanY <= VIEW_HEIGHT - VIEW_PADDING * 2) {
      zoom = z
      break
    }
  }

  return {
    centerLon: Number(((minLon + maxLon) / 2).toFixed(8)),
    centerLat: Number(((minLat + maxLat) / 2).toFixed(8)),
    zoom,
  }
}

function pushHistory() {
  history.value.push(cloneLines(draftLines.value))
  if (history.value.length > 40) history.value.shift()
}

function undoLast() {
  const prev = history.value.pop()
  if (!prev) return
  draftLines.value = cloneLines(prev)
  selectedPoint.value = null
}

function resetDraft() {
  draftLines.value = cloneLines(originalLines.value)
  history.value = []
  selectedPoint.value = null
  actionMessage.value = null
}

function selectPoint(lineIndex: number, pointIndex: number) {
  activeLineIndex.value = lineIndex
  selectedPoint.value = { lineIndex, pointIndex }
}

function startDragging(event: PointerEvent, lineIndex: number, pointIndex: number) {
  if (saving.value) return
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
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  if (dragging.value) {
    const [lon, lat] = unprojectPoint(x, y)
    const current = draftLines.value[dragging.value.lineIndex]
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
  if (saving.value || !svgRef.value || dragging.value) return
  const target = event.target as Element | null
  if (target?.classList?.contains('pipe-point') || target?.classList?.contains('pipe-line')) {
    return
  }

  const rect = svgRef.value.getBoundingClientRect()
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
    nextZoom
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
  if (!draftLines.value.length) return
  const fitted = buildFittedView(draftLines.value)
  mapView.value = { ...fitted }
}

function handleWheel(event: WheelEvent) {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (event.deltaY < 0) zoomByStep(1, x, y)
  else if (event.deltaY > 0) zoomByStep(-1, x, y)
}

function distanceToSegmentSquared(point: Point, a: Point, b: Point) {
  const ax = a[0]
  const ay = a[1]
  const bx = b[0]
  const by = b[1]
  const px = point[0]
  const py = point[1]

  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLenSq = abx * abx + aby * aby
  if (abLenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
  const cx = ax + abx * t
  const cy = ay + aby * t
  return (px - cx) ** 2 + (py - cy) ** 2
}

function insertPointOnActiveLine(point: Point) {
  const line = draftLines.value[activeLineIndex.value]
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
  if (!addPointMode.value || saving.value || !svgRef.value || !selectedFeature.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const point = applyEndpointSnap(unprojectPoint(x, y))
  insertPointOnActiveLine(point)
}

function deleteSelectedPoint() {
  if (!selectedPoint.value) return
  const { lineIndex, pointIndex } = selectedPoint.value
  const line = draftLines.value[lineIndex]
  if (!line || line.length <= 2) return
  pushHistory()
  line.splice(pointIndex, 1)
  selectedPoint.value = null
}

async function loadPipes() {
  loading.value = true
  loadError.value = null
  actionMessage.value = null

  try {
    const features = await geoFeatureService.list(props.backendBaseUrl, {
      layer: 'pipes',
      limit: 6000,
    })
    pipes.value = features.filter(item => {
      const type = String(item.geometry?.type || '')
      return type === 'LineString' || type === 'MultiLineString'
    })

    const preferredId = props.initialFeatureId
    const hasPreferred = preferredId
      && pipes.value.some(item => String(item.id) === preferredId)
    if (hasPreferred) {
      selectedFeatureId.value = String(preferredId)
    } else if (!selectedFeatureId.value || !pipes.value.some(i => String(i.id) === selectedFeatureId.value)) {
      selectedFeatureId.value = pipes.value.length ? String(pipes.value[0].id) : ''
    }
  } catch (err: any) {
    loadError.value = err?.message || '加载管道列表失败'
    pipes.value = []
    selectedFeatureId.value = ''
  } finally {
    loading.value = false
  }
}

async function loadInsights(featureId: string) {
  insightError.value = null
  drilldown.value = null
  traceResult.value = null
  telemetryList.value = []
  auditLogs.value = []

  const [drilldownResult, traceResultDown, telemetryResult, auditResult] = await Promise.allSettled([
    twinService.drilldown(props.backendBaseUrl, featureId),
    twinService.trace(props.backendBaseUrl, featureId, 'down'),
    twinService.telemetryLatest(props.backendBaseUrl, [featureId]),
    twinService.listAuditLogs(props.backendBaseUrl, featureId, 10),
  ])

  if (drilldownResult.status === 'fulfilled') {
    drilldown.value = drilldownResult.value
  } else {
    insightError.value = drilldownResult.reason?.message || '穿透信息获取失败'
  }

  if (traceResultDown.status === 'fulfilled') {
    traceResult.value = traceResultDown.value
  } else if (!insightError.value) {
    insightError.value = traceResultDown.reason?.message || '拓扑追踪失败'
  }

  if (telemetryResult.status === 'fulfilled') {
    telemetryList.value = telemetryResult.value
  } else if (!insightError.value) {
    insightError.value = telemetryResult.reason?.message || '测点读取失败'
  }

  if (auditResult.status === 'fulfilled') {
    auditLogs.value = auditResult.value
  } else if (!insightError.value) {
    insightError.value = auditResult.reason?.message || '审计日志读取失败'
  }
}

function buildPayloadForSave(feature: GeoJsonFeature): GeoFeaturePayload {
  const properties = { ...(feature.properties || {}) }
  const visible = Boolean(properties.visible ?? true)
  delete (properties as Record<string, unknown>).visible

  const oldType = String(feature.geometry?.type || 'LineString')
  const shouldUseMulti = oldType === 'MultiLineString' || draftLines.value.length > 1

  return {
    id: String(feature.id),
    layer: 'pipes',
    geometry: {
      type: shouldUseMulti ? 'MultiLineString' : 'LineString',
      coordinates: shouldUseMulti ? draftLines.value : draftLines.value[0],
    },
    properties,
    visible,
  }
}

async function saveGeometry() {
  if (!selectedFeature.value) return
  if (!draftLines.value.length || draftLines.value.some(line => line.length < 2)) {
    actionMessage.value = { type: 'error', text: '至少保留一条由两个点组成的线' }
    return
  }

  saving.value = true
  actionMessage.value = null
  try {
    const payload = buildPayloadForSave(selectedFeature.value)
    try {
      await twinService.updatePipeGeometry(
        props.backendBaseUrl,
        payload.id,
        payload.geometry,
        'admin-2d-editor'
      )
    } catch {
      // Backward compatible fallback when twin write API is unavailable.
      await geoFeatureService.update(props.backendBaseUrl, payload)
    }

    const index = pipes.value.findIndex(item => String(item.id) === payload.id)
    if (index >= 0) {
      const nextGeometry = {
        type: payload.geometry.type,
        coordinates: payload.geometry.coordinates,
      }
      const nextProperties = {
        ...(selectedFeature.value.properties || {}),
        ...payload.properties,
        visible: payload.visible,
      }
      pipes.value[index] = {
        ...pipes.value[index],
        geometry: nextGeometry,
        properties: nextProperties,
      }
    }

    originalLines.value = cloneLines(draftLines.value)
    history.value = []
    actionMessage.value = { type: 'ok', text: `已保存 ${payload.id} 的几何` }
    emit('saved', payload.id)
    loadInsights(payload.id)
  } catch (err: any) {
    actionMessage.value = { type: 'error', text: err?.message || '保存失败' }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: 1600;
}

.dialog__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
}

.dialog__panel {
  position: absolute;
  inset: 3vh 2vw;
  background: #f8fafc;
  border: 1px solid #dbe3f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #dbe3f0;
  background: #ffffff;
}

.dialog__title {
  margin: 0;
  font-size: 16px;
  color: #10213d;
}

.dialog__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #60708a;
}

.dialog__actions {
  display: inline-flex;
  gap: 8px;
}

.dialog__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr 280px;
  gap: 12px;
  padding: 12px;
}

.pane {
  border: 1px solid #dbe3f0;
  background: #ffffff;
  border-radius: 10px;
  min-height: 0;
}

.pane--list {
  display: flex;
  flex-direction: column;
}

.pane__top {
  padding: 10px;
  border-bottom: 1px solid #eef2f8;
}

.admin-input {
  width: 100%;
  height: 34px;
  border: 1px solid #dbe3f0;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 13px;
  color: #1f2f49;
}

.pipe-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pipe-list__item {
  border: 1px solid #e5edf8;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}

.pipe-list__item--active {
  border-color: rgba(22, 100, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(22, 100, 255, 0.08);
}

.pipe-list__id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: #1b3c74;
}

.pipe-list__meta {
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #5d708d;
  gap: 8px;
}

.pane__state {
  margin: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #4b5d78;
  background: #f5f8fc;
}

.pane__state--error {
  color: #a22d2d;
  background: #ffeaea;
}

.pane--editor {
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar__left,
.toolbar__right {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eff4fb;
  color: #34517c;
  font-size: 12px;
  line-height: 28px;
}

.btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid #d3dfef;
  background: #ffffff;
  color: #263a5b;
  cursor: pointer;
  font-size: 12px;
}

.btn:disabled {
  cursor: not-allowed;
  color: #9aa8bf;
  background: #f4f6fa;
}

.btn--active {
  border-color: rgba(22, 100, 255, 0.5);
  color: #1257e3;
  background: #eef4ff;
}

.btn--primary {
  border-color: rgba(22, 100, 255, 0.35);
  color: #ffffff;
  background: #1664ff;
}

.canvas-wrap {
  flex: 1;
  min-height: 0;
  border: 1px solid #dbe3f0;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #fbfdff 0%, #f3f7fd 100%);
}

.canvas {
  width: 100%;
  height: 100%;
  touch-action: none;
}

.canvas--idle {
  cursor: grab;
}

.canvas--panning {
  cursor: grabbing;
}

.canvas--editing {
  cursor: default;
}

.map-tiles image {
  image-rendering: auto;
}

.map-mask {
  fill: rgba(245, 249, 255, 0.18);
}

.grid line {
  stroke: #e6edf8;
  stroke-width: 1;
}

.pipe-line {
  fill: none;
  stroke: #2f7ce3;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  cursor: pointer;
}

.pipe-line--active {
  stroke: #0f5be8;
  stroke-width: 5;
}

.pipe-point {
  fill: #ffffff;
  stroke: #0f5be8;
  stroke-width: 2;
  cursor: grab;
}

.pipe-point--active {
  fill: #0f5be8;
  stroke: #ffffff;
}

.canvas-empty {
  fill: #7086aa;
  font-size: 14px;
  text-anchor: middle;
}

.canvas-attribution {
  margin-top: -4px;
  font-size: 11px;
  color: #7688a4;
}

.hint {
  font-size: 12px;
  color: #60708a;
}

.message {
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
}

.message--ok {
  color: #15532e;
  background: #e8f8ef;
}

.message--error {
  color: #9b2222;
  background: #ffeded;
}

.pane--insight {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.insight-card {
  border: 1px solid #e4ecf8;
  border-radius: 8px;
  padding: 10px;
  background: #f9fbff;
}

.insight-card__title {
  font-size: 12px;
  color: #5c6f8f;
}

.insight-card__value {
  margin-top: 6px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.insight-card__value span {
  font-size: 24px;
  font-weight: 700;
  color: #174489;
}

.insight-card__value small {
  font-size: 12px;
  color: #60708a;
}

.insight-card__detail {
  margin-top: 6px;
  font-size: 12px;
  color: #60708a;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (max-width: 1380px) {
  .dialog__panel {
    inset: 2vh 1vw;
  }

  .dialog__body {
    grid-template-columns: 250px 1fr;
  }

  .pane--insight {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .insight-card {
    width: calc(33.333% - 8px);
    min-width: 220px;
  }
}
</style>
