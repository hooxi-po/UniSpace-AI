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
import { computed, ref, toRef, watch } from 'vue'
import { usePipe2DEditorData } from '~/composables/admin/usePipe2DEditorData'
import { usePipe2DEditorMap } from '~/composables/admin/usePipe2DEditorMap'
import { type GeoJsonFeature } from '~/services/geo-features'
import { classifyRoadToPipeCategory } from '~/utils/pipe-classifier'
import {
  cloneLines,
  geometryToLines,
  type Lines,
} from '~/utils/pipe2d-geometry'

type Message = {
  type: 'ok' | 'error'
  text: string
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

const saving = ref(false)
const actionMessage = ref<Message | null>(null)

const pipes = ref<GeoJsonFeature[]>([])
const searchTerm = ref('')
const selectedFeatureId = ref('')

const draftLines = ref<Lines>([])
const originalLines = ref<Lines>([])

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

const {
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
} = usePipe2DEditorMap({
  svgRef,
  pipes,
  selectedFeature,
  draftLines,
  originalLines,
  saving,
  actionMessage,
})

const {
  loading,
  loadError,
  drilldown,
  traceResult,
  telemetryList,
  auditLogs,
  insightError,
  telemetryPreview,
  auditPreview,
  loadPipes,
  loadInsights,
  saveGeometry,
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

const geometryTypeLabel = computed(() => {
  const t = selectedFeature.value?.geometry?.type
  if (t === 'MultiLineString') return '多线'
  if (t === 'LineString') return '单线'
  return String(t || '未知')
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
  const fitted = createFittedView(draftLines.value)
  mapView.value = { ...fitted }
  loadInsights(String(feature.id))
})

function pipeName(feature: GeoJsonFeature) {
  return String(feature.properties?.name || feature.properties?.ref || '未命名')
}
</script>

<style scoped src="./Pipe2DEditorDialog.css"></style>
