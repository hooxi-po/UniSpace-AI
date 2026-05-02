<template>
  <div v-if="open" class="picker">
    <div class="picker__mask" @click="$emit('close')" />
    <div class="picker__panel" @click.stop>
      <div class="picker__header">
        <div>
          <div class="picker__title">设置模型坐标与姿态</div>
          <div class="picker__subtitle">点击地图调整锚点，拖动滑杆预览旋转；留空坐标时继续跟随建筑中心</div>
        </div>
        <div class="picker__header-actions">
          <button
            class="picker__btn picker__btn--primary"
            type="button"
            :disabled="submitting"
            @click="saveSelection"
          >
            保存设置
          </button>
          <button class="picker__close" type="button" @click="$emit('close')">关闭</button>
        </div>
      </div>

      <div class="picker__body">
        <aside class="picker__sidebar">
          <div class="picker__card">
            <div class="picker__card-title">当前锚点</div>
            <div class="picker__value">
              {{ selectedCoordinate ? formatPoint(selectedCoordinate) : '未设置，保存时将跟随建筑中心' }}
            </div>
          </div>

          <div class="picker__card">
            <div class="picker__card-title">建筑中心</div>
            <div class="picker__value">
              {{ fallbackCoordinate ? formatPoint(fallbackCoordinate) : '当前表单几何无效，无法计算中心点' }}
            </div>
          </div>

          <div class="picker__card">
            <div class="picker__card-title">操作说明</div>
            <div class="picker__text">1. 拖动或缩放地图定位到目标建筑。</div>
            <div class="picker__text">2. 点击地图放置模型锚点，也可以直接拖动蓝色锚点或模型。</div>
            <div class="picker__text">3. 拖动下方滑杆可实时预览模型旋转。</div>
            <div class="picker__text">4. 确认后会把坐标和姿态写回建筑表单。</div>
          </div>

          <div class="picker__card">
            <div class="picker__card-title">姿态预览</div>

            <label class="picker__control">
              <span class="picker__control-label">Heading</span>
              <input
                v-model.number="draftHeading"
                class="picker__range"
                type="range"
                min="-180"
                max="180"
                step="1"
              >
              <span class="picker__control-value">{{ draftHeading }}°</span>
            </label>

            <label class="picker__control">
              <span class="picker__control-label">Pitch</span>
              <input
                v-model.number="draftPitch"
                class="picker__range"
                type="range"
                min="-90"
                max="90"
                step="1"
              >
              <span class="picker__control-value">{{ draftPitch }}°</span>
            </label>

            <label class="picker__control">
              <span class="picker__control-label">Roll</span>
              <input
                v-model.number="draftRoll"
                class="picker__range"
                type="range"
                min="-90"
                max="90"
                step="1"
              >
              <span class="picker__control-value">{{ draftRoll }}°</span>
            </label>

            <div class="picker__actions">
              <button class="picker__btn" type="button" @click="resetRotation">
                重置姿态
              </button>
            </div>
          </div>

          <div class="picker__actions">
            <button
              class="picker__btn"
              type="button"
              :disabled="!fallbackCoordinate"
              @click="useFallbackCoordinate"
            >
              使用建筑中心
            </button>
            <button class="picker__btn" type="button" @click="clearCoordinateOverride">
              跟随建筑中心
            </button>
          </div>

          <div v-if="saveError" class="picker__error">
            {{ saveError }}
          </div>
        </aside>

        <div class="picker__stage">
          <div class="picker__hint">点击地图即可选择模型锚点</div>
          <div class="picker__map">
            <MapView
              :selected-id="null"
              :selected-targets="selectedTargets"
              :viewport="viewport"
              :layers="mapLayers"
              :backend-base-url="backendBaseUrl"
              :weather-mode="false"
              :picker-marker="pickerMarker"
              :building-model-preview="buildingModelPreview"
              :coordinate-drag-target-id="buildingId"
              @pick-coordinate="handleMapPick"
              @update:viewport="viewport = $event"
            />
          </div>
        </div>
      </div>

      <div class="picker__footer">
        <button class="picker__btn" type="button" @click="$emit('close')">取消</button>
        <button
          class="picker__btn picker__btn--primary"
          type="button"
          :disabled="submitting"
          @click="confirmSelection"
        >
          保存并关闭
        </button>
        <button
          class="picker__btn picker__btn--primary"
          type="button"
          :disabled="submitting"
          @click="confirmAndSave"
        >
          保存并提交
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MapView from '~/components/MapView.vue'

type LonLatPoint = {
  lon: number
  lat: number
}

type RotationDraft = {
  heading: number
  pitch: number
  roll: number
}

const DEFAULT_VIEWPORT = {
  x: 119.1895,
  y: 26.0254,
  scale: 500,
}

const FOCUSED_VIEWPORT_SCALE = 260
const DEFAULT_ROTATION = {
  heading: 0,
  pitch: 0,
  roll: 0,
}

const props = defineProps<{
  open: boolean
  backendBaseUrl: string
  buildingId: string
  currentCoordinate: LonLatPoint | null
  fallbackCoordinate: LonLatPoint | null
  modelEnabled: boolean
  modelUrl: string
  modelScaleMode: 'auto' | 'fixed'
  modelScale: number
  rotation: RotationDraft
  submitting?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { coordinate: LonLatPoint | null; heading: number; pitch: number; roll: number }): void
  (e: 'confirm', payload: { coordinate: LonLatPoint | null; heading: number; pitch: number; roll: number }): void
  (e: 'confirm-and-save', payload: { coordinate: LonLatPoint | null; heading: number; pitch: number; roll: number }): void
}>()

const selectedCoordinate = ref<LonLatPoint | null>(null)
const viewport = ref({ ...DEFAULT_VIEWPORT })
const draftHeading = ref(DEFAULT_ROTATION.heading)
const draftPitch = ref(DEFAULT_ROTATION.pitch)
const draftRoll = ref(DEFAULT_ROTATION.roll)

const mapLayers = {
  water: false,
  sewage: false,
  drain: false,
  pipeNodes: false,
  buildings: true,
  green: false,
}

const selectedTargets = computed(() => {
  const buildingId = props.buildingId.trim()
  return {
    pipes: [] as string[],
    rooms: [] as string[],
    buildings: buildingId ? [buildingId] : [],
  }
})

const pickerMarker = computed(() => {
  const point = selectedCoordinate.value || props.fallbackCoordinate
  if (!point) return null
  return {
    lon: point.lon,
    lat: point.lat,
    label: selectedCoordinate.value ? '模型锚点' : '建筑中心',
  }
})

const buildingModelPreview = computed(() => {
  if (!props.modelEnabled || !props.modelUrl.trim() || !props.buildingId.trim()) return null
  return {
    id: props.buildingId.trim(),
    url: props.modelUrl.trim(),
    heading: draftHeading.value,
    pitch: draftPitch.value,
    roll: draftRoll.value,
    scaleMode: props.modelScaleMode,
    scale: props.modelScale,
    position: selectedCoordinate.value,
  }
})

watch(
  () => [props.open, props.currentCoordinate, props.fallbackCoordinate, props.rotation],
  () => {
    if (!props.open) return
    const nextPoint = props.currentCoordinate || props.fallbackCoordinate
    selectedCoordinate.value = props.currentCoordinate
      ? { ...props.currentCoordinate }
      : null
    draftHeading.value = props.rotation.heading
    draftPitch.value = props.rotation.pitch
    draftRoll.value = props.rotation.roll
    viewport.value = buildViewport(nextPoint)
  },
  { immediate: true, deep: true },
)

function buildViewport(point: LonLatPoint | null) {
  if (!point) return { ...DEFAULT_VIEWPORT }
  return {
    x: point.lon,
    y: point.lat,
    scale: FOCUSED_VIEWPORT_SCALE,
  }
}

function formatPoint(point: LonLatPoint) {
  return `${point.lon.toFixed(6)}, ${point.lat.toFixed(6)}`
}

function handleMapPick(point: LonLatPoint) {
  selectedCoordinate.value = { ...point }
}

function useFallbackCoordinate() {
  if (!props.fallbackCoordinate) return
  selectedCoordinate.value = { ...props.fallbackCoordinate }
  viewport.value = buildViewport(selectedCoordinate.value)
}

function clearCoordinateOverride() {
  selectedCoordinate.value = null
}

function resetRotation() {
  draftHeading.value = DEFAULT_ROTATION.heading
  draftPitch.value = DEFAULT_ROTATION.pitch
  draftRoll.value = DEFAULT_ROTATION.roll
}

function confirmSelection() {
  const payload = {
    coordinate: selectedCoordinate.value,
    heading: draftHeading.value,
    pitch: draftPitch.value,
    roll: draftRoll.value,
  }
  emit('confirm', payload)
}

function saveSelection() {
  emit('save', {
    coordinate: selectedCoordinate.value,
    heading: draftHeading.value,
    pitch: draftPitch.value,
    roll: draftRoll.value,
  })
}

function confirmAndSave() {
  const payload = {
    coordinate: selectedCoordinate.value,
    heading: draftHeading.value,
    pitch: draftPitch.value,
    roll: draftRoll.value,
  }
  emit('confirm-and-save', payload)
}
</script>

<style scoped>
.picker {
  position: fixed;
  inset: 0;
  z-index: 70;
}

.picker__mask {
  position: absolute;
  inset: 0;
  background: rgba(8, 12, 22, 0.52);
}

.picker__panel {
  position: absolute;
  inset: 24px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(18, 24, 38, 0.08);
  box-shadow: 0 20px 60px rgba(18, 24, 38, 0.26);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid #e7ebf0;
}

.picker__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker__title {
  font-size: 16px;
  font-weight: 600;
  color: #101828;
}

.picker__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #667085;
}

.picker__close,
.picker__btn {
  height: 34px;
  border-radius: 10px;
  border: 1px solid #d0d5dd;
  background: #ffffff;
  color: #101828;
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
}

.picker__close:hover,
.picker__btn:hover {
  background: #f8fafc;
}

.picker__close:disabled,
.picker__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.picker__btn--primary {
  border-color: rgba(22, 100, 255, 0.35);
  background: var(--primary);
  color: #ffffff;
}

.picker__btn--primary:hover {
  background: #0f55e6;
}

.picker__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
}

.picker__sidebar {
  border-right: 1px solid #e7ebf0;
  background: #f8fafc;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.picker__card {
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  background: #ffffff;
  padding: 12px;
}

.picker__card-title {
  font-size: 12px;
  font-weight: 600;
  color: #344054;
}

.picker__value,
.picker__text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #667085;
}

.picker__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.picker__error {
  border: 1px solid rgba(245, 74, 69, 0.24);
  border-radius: 10px;
  background: rgba(245, 74, 69, 0.08);
  color: #b42318;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
}

.picker__control {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.picker__control-label {
  font-size: 12px;
  color: #344054;
  font-weight: 600;
}

.picker__range {
  width: 100%;
}

.picker__control-value {
  font-size: 12px;
  color: #667085;
}

.picker__stage {
  min-width: 0;
  position: relative;
  background:
    radial-gradient(circle at top left, rgba(22, 100, 255, 0.18), transparent 28%),
    linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%);
  padding: 16px;
}

.picker__hint {
  margin-bottom: 10px;
  font-size: 12px;
  color: #475467;
}

.picker__map {
  position: relative;
  height: 100%;
  min-height: 420px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(22, 100, 255, 0.12);
  background: #dbe5f0;
}

.picker__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px 18px;
  border-top: 1px solid #e7ebf0;
}

@media (max-width: 980px) {
  .picker__panel {
    inset: 12px;
  }

  .picker__body {
    grid-template-columns: 1fr;
  }

  .picker__sidebar {
    border-right: 0;
    border-bottom: 1px solid #e7ebf0;
  }

  .picker__map {
    min-height: 320px;
  }
}
</style>
