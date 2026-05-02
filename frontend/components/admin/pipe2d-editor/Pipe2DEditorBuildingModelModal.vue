<template>
  <div v-if="open" class="model-dialog">
    <div class="model-dialog__mask" @click="emitClose" />
    <div class="model-dialog__panel" @click.stop>
      <div class="model-dialog__header">
        <div>
          <div class="model-dialog__title">建筑模型摆放</div>
          <div class="model-dialog__subtitle">选择建筑后，可直接在地图里可视化调整模型锚点和姿态</div>
        </div>
        <button class="model-dialog__close" type="button" :disabled="saving" @click="emitClose">关闭</button>
      </div>

      <div class="model-dialog__body">
        <div v-if="loading" class="model-dialog__placeholder">正在加载建筑列表...</div>
        <div v-else-if="loadError" class="model-dialog__error">{{ loadError }}</div>
        <div v-else-if="!buildings.length" class="model-dialog__placeholder">暂无可配置的建筑要素</div>
        <template v-else>
          <div class="model-dialog__grid">
            <label class="model-field model-field--block">
              <span class="model-field__label">选择建筑</span>
              <select v-model="selectedBuildingId" class="model-field__input" :disabled="saving">
                <option v-for="item in buildings" :key="item.id" :value="item.id">
                  {{ item.label }}
                </option>
              </select>
            </label>

            <label class="model-field model-field--inline">
              <span class="model-field__label">启用模型</span>
              <input v-model="form.modelEnabled" class="model-field__checkbox" type="checkbox" :disabled="saving">
            </label>

            <label class="model-field">
              <span class="model-field__label">模型文件</span>
              <input
                v-model.trim="form.modelUrl"
                class="model-field__input"
                type="text"
                list="pipe-editor-model-url-options"
                :disabled="saving || !form.modelEnabled"
                placeholder="/models/residential_building.glb"
              >
            </label>

            <label class="model-field">
              <span class="model-field__label">缩放模式</span>
              <select v-model="form.modelScaleMode" class="model-field__input" :disabled="saving || !form.modelEnabled">
                <option value="auto">自动适配</option>
                <option value="fixed">固定倍率</option>
              </select>
            </label>

            <label class="model-field">
              <span class="model-field__label">缩放倍率</span>
              <input
                v-model.trim="form.modelScale"
                class="model-field__input"
                type="text"
                :disabled="saving || !form.modelEnabled"
                placeholder="1"
              >
            </label>

            <label class="model-field">
              <span class="model-field__label">Heading</span>
              <input
                v-model.trim="form.modelHeading"
                class="model-field__input"
                type="text"
                :disabled="saving || !form.modelEnabled"
                placeholder="0"
              >
            </label>

            <label class="model-field">
              <span class="model-field__label">Pitch</span>
              <input
                v-model.trim="form.modelPitch"
                class="model-field__input"
                type="text"
                :disabled="saving || !form.modelEnabled"
                placeholder="0"
              >
            </label>

            <label class="model-field">
              <span class="model-field__label">Roll</span>
              <input
                v-model.trim="form.modelRoll"
                class="model-field__input"
                type="text"
                :disabled="saving || !form.modelEnabled"
                placeholder="0"
              >
            </label>

            <label class="model-field">
              <span class="model-field__label">模型经度</span>
              <input
                v-model.trim="form.modelLongitude"
                class="model-field__input"
                type="text"
                :disabled="saving || !form.modelEnabled"
                placeholder="留空则跟随建筑中心"
              >
            </label>

            <label class="model-field">
              <span class="model-field__label">模型纬度</span>
              <input
                v-model.trim="form.modelLatitude"
                class="model-field__input"
                type="text"
                :disabled="saving || !form.modelEnabled"
                placeholder="留空则跟随建筑中心"
              >
            </label>
          </div>

          <div class="model-dialog__meta">
            <span>建筑中心：{{ geometryCenter ? formatPoint(geometryCenter) : '当前建筑几何无效' }}</span>
            <span>当前锚点：{{ modelCoordinate ? formatPoint(modelCoordinate) : '跟随建筑中心' }}</span>
          </div>

          <div class="model-dialog__actions">
            <button
              class="model-dialog__btn"
              type="button"
              :disabled="saving || !form.modelEnabled"
              @click="modelPickerOpen = true"
            >
              可视化摆放
            </button>
            <button
              class="model-dialog__btn"
              type="button"
              :disabled="saving || !geometryCenter"
              @click="useGeometryCenterAsModelCoordinate"
            >
              使用建筑中心
            </button>
            <button
              class="model-dialog__btn"
              type="button"
              :disabled="saving || !modelCoordinate"
              @click="clearModelCoordinate"
            >
              跟随建筑中心
            </button>
          </div>

          <div v-if="errorText" class="model-dialog__error">{{ errorText }}</div>
        </template>
      </div>

      <div class="model-dialog__footer">
        <button class="model-dialog__btn" type="button" :disabled="saving" @click="emitClose">取消</button>
        <button
          class="model-dialog__btn model-dialog__btn--primary"
          type="button"
          :disabled="saving || !selectedBuilding"
          @click="saveBuilding()"
        >
          {{ saving ? '保存中...' : '保存模型设置' }}
        </button>
      </div>
    </div>

    <ModelCoordinatePickerDialog
      :open="modelPickerOpen"
      :backend-base-url="backendBaseUrl"
      :building-id="selectedBuildingId"
      :current-coordinate="modelCoordinate"
      :fallback-coordinate="geometryCenter"
      :model-enabled="form.modelEnabled"
      :model-url="form.modelUrl"
      :model-scale-mode="form.modelScaleMode"
      :model-scale="toPositiveNumberOrDefault(form.modelScale, 1)"
      :rotation="{
        heading: toNumberOrDefault(form.modelHeading, 0),
        pitch: toNumberOrDefault(form.modelPitch, 0),
        roll: toNumberOrDefault(form.modelRoll, 0),
      }"
      :submitting="saving"
      :save-error="errorText"
      @close="modelPickerOpen = false"
      @save="applyModelPayload"
      @confirm="handleModelPickerConfirm"
      @confirm-and-save="handleModelPickerConfirmAndSave"
    />

    <datalist id="pipe-editor-model-url-options">
      <option value="/models/residential_building.glb" />
      <option value="/models/officeBuild.glb" />
      <option value="/models/glbfile.glb" />
    </datalist>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ModelCoordinatePickerDialog from '~/components/admin/ModelCoordinatePickerDialog.vue'
import { geoFeatureService, type GeoFeaturePayload, type GeoJsonFeature } from '~/services/geo-features'

type LonLatPoint = {
  lon: number
  lat: number
}

type BuildingOption = {
  id: string
  label: string
  feature: GeoJsonFeature
}

type ModelScaleMode = 'auto' | 'fixed'

const props = defineProps<{
  open: boolean
  backendBaseUrl: string
  preferredBuildingIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', payload: { id: string; name: string }): void
}>()

const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const buildings = ref<BuildingOption[]>([])
const selectedBuildingId = ref('')
const modelPickerOpen = ref(false)

const form = reactive({
  modelEnabled: true,
  modelUrl: '/models/residential_building.glb',
  modelScaleMode: 'auto' as ModelScaleMode,
  modelScale: '1',
  modelHeading: '0',
  modelPitch: '0',
  modelRoll: '0',
  modelLongitude: '',
  modelLatitude: '',
})

const selectedBuilding = computed(() => {
  return buildings.value.find(item => item.id === selectedBuildingId.value) ?? null
})

const geometryCenter = computed<LonLatPoint | null>(() => {
  const feature = selectedBuilding.value?.feature
  if (!feature) return null
  return deriveGeometryCenter(
    String(feature.geometry?.type || ''),
    feature.geometry?.coordinates,
  )
})

const modelCoordinate = computed<LonLatPoint | null>(() => {
  const lon = parseLongitude(form.modelLongitude)
  const lat = parseLatitude(form.modelLatitude)
  if (lon == null || lat == null) return null
  return { lon, lat }
})

const errorText = computed(() => {
  return saveError.value || validationError()
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      modelPickerOpen.value = false
      saveError.value = ''
      return
    }
    void loadBuildings()
  },
)

watch(selectedBuilding, (building) => {
  if (!building) return
  hydrateFormFromFeature(building.feature)
})

function emitClose() {
  if (saving.value) return
  emit('close')
}

async function loadBuildings() {
  loading.value = true
  loadError.value = ''
  try {
    const features = await geoFeatureService.list(props.backendBaseUrl, {
      layer: 'buildings',
      limit: 3000,
    })
    buildings.value = features
      .filter(feature => Boolean(feature?.id))
      .map((feature) => {
        const properties = (feature.properties || {}) as Record<string, unknown>
        const name = String(properties.name || properties.ref || feature.id)
        return {
          id: String(feature.id),
          label: `${String(feature.id)} · ${name}`,
          feature,
        }
      })

    const preferredId = (props.preferredBuildingIds || []).find(id => buildings.value.some(item => item.id === id))
    const currentExists = buildings.value.some(item => item.id === selectedBuildingId.value)
    selectedBuildingId.value = preferredId || (currentExists ? selectedBuildingId.value : buildings.value[0]?.id || '')
  } catch (error: any) {
    loadError.value = error?.message || '加载建筑列表失败'
    buildings.value = []
    selectedBuildingId.value = ''
  } finally {
    loading.value = false
  }
}

function hydrateFormFromFeature(feature: GeoJsonFeature) {
  const properties = (feature.properties || {}) as Record<string, unknown>
  form.modelEnabled = Boolean(properties.modelEnabled ?? false)
  form.modelUrl = String(properties.modelUrl || '/models/residential_building.glb')
  form.modelScaleMode = normalizeScaleMode(properties.modelScaleMode)
  form.modelScale = formatNumberString(toPositiveNumberOrDefault(properties.modelScale, 1))
  form.modelHeading = formatNumberString(toNumberOrDefault(properties.modelHeading, 0))
  form.modelPitch = formatNumberString(toNumberOrDefault(properties.modelPitch, 0))
  form.modelRoll = formatNumberString(toNumberOrDefault(properties.modelRoll, 0))

  const coordinate = readModelCoordinate(properties)
  form.modelLongitude = coordinate ? formatCoordinate(coordinate.lon) : ''
  form.modelLatitude = coordinate ? formatCoordinate(coordinate.lat) : ''
  saveError.value = ''
}

function validationError() {
  if (!selectedBuilding.value) return '请先选择一个建筑'
  if (form.modelEnabled && !form.modelUrl.trim()) return '启用模型后必须填写模型地址'
  if (form.modelEnabled && parsePositiveNumber(form.modelScale) == null) return '缩放倍率必须大于 0'
  if (form.modelEnabled && parseFiniteNumber(form.modelHeading) == null) return 'Heading 必须是数字'
  if (form.modelEnabled && parseFiniteNumber(form.modelPitch) == null) return 'Pitch 必须是数字'
  if (form.modelEnabled && parseFiniteNumber(form.modelRoll) == null) return 'Roll 必须是数字'

  const hasLon = form.modelLongitude.trim().length > 0
  const hasLat = form.modelLatitude.trim().length > 0
  if (hasLon !== hasLat) return '模型经纬度需要同时填写'
  if (hasLon && parseLongitude(form.modelLongitude) == null) return '模型经度必须在 -180 到 180 之间'
  if (hasLat && parseLatitude(form.modelLatitude) == null) return '模型纬度必须在 -90 到 90 之间'
  return ''
}

function buildPayload(): GeoFeaturePayload | null {
  const feature = selectedBuilding.value?.feature
  if (!feature) return null

  const properties = {
    ...(feature.properties || {}),
    modelEnabled: form.modelEnabled,
    modelUrl: form.modelUrl.trim(),
    modelScaleMode: form.modelScaleMode,
    modelScale: toPositiveNumberOrDefault(form.modelScale, 1),
    modelHeading: toNumberOrDefault(form.modelHeading, 0),
    modelPitch: toNumberOrDefault(form.modelPitch, 0),
    modelRoll: toNumberOrDefault(form.modelRoll, 0),
  } as Record<string, unknown>
  delete properties.visible

  const lon = parseLongitude(form.modelLongitude)
  const lat = parseLatitude(form.modelLatitude)
  if (lon == null || lat == null) {
    delete properties.modelLongitude
    delete properties.modelLatitude
  } else {
    properties.modelLongitude = lon
    properties.modelLatitude = lat
  }

  return {
    id: String(feature.id),
    layer: 'buildings',
    geometry: {
      type: String(feature.geometry?.type || 'Polygon'),
      coordinates: feature.geometry?.coordinates,
    },
    properties,
    visible: Boolean((feature.properties || {}).visible ?? true),
  }
}

async function saveBuilding(closeAfterSave = true) {
  const error = validationError()
  if (error) {
    saveError.value = error
    return
  }

  const payload = buildPayload()
  if (!payload) {
    saveError.value = '建筑数据无效，无法保存'
    return
  }

  saving.value = true
  saveError.value = ''
  try {
    await geoFeatureService.update(props.backendBaseUrl, payload)
    const index = buildings.value.findIndex(item => item.id === payload.id)
    if (index >= 0) {
      buildings.value[index] = {
        ...buildings.value[index],
        feature: {
          ...buildings.value[index].feature,
          properties: {
            ...payload.properties,
            visible: payload.visible,
          },
        },
      }
    }
    emit('saved', {
      id: payload.id,
      name: String(payload.properties.name || payload.id),
    })
    if (closeAfterSave) {
      modelPickerOpen.value = false
      emit('close')
    }
  } catch (error: any) {
    saveError.value = error?.message || '保存建筑模型失败'
  } finally {
    saving.value = false
  }
}

function applyModelPayload(payload: {
  coordinate: LonLatPoint | null
  heading: number
  pitch: number
  roll: number
}) {
  if (payload.coordinate) {
    form.modelLongitude = formatCoordinate(payload.coordinate.lon)
    form.modelLatitude = formatCoordinate(payload.coordinate.lat)
  } else {
    form.modelLongitude = ''
    form.modelLatitude = ''
  }
  form.modelHeading = formatNumberString(payload.heading)
  form.modelPitch = formatNumberString(payload.pitch)
  form.modelRoll = formatNumberString(payload.roll)
  saveError.value = ''
}

function handleModelPickerConfirm(payload: {
  coordinate: LonLatPoint | null
  heading: number
  pitch: number
  roll: number
}) {
  applyModelPayload(payload)
  modelPickerOpen.value = false
}

async function handleModelPickerConfirmAndSave(payload: {
  coordinate: LonLatPoint | null
  heading: number
  pitch: number
  roll: number
}) {
  applyModelPayload(payload)
  await saveBuilding()
}

function useGeometryCenterAsModelCoordinate() {
  if (!geometryCenter.value) return
  form.modelLongitude = formatCoordinate(geometryCenter.value.lon)
  form.modelLatitude = formatCoordinate(geometryCenter.value.lat)
}

function clearModelCoordinate() {
  form.modelLongitude = ''
  form.modelLatitude = ''
}

function readModelCoordinate(properties: Record<string, unknown>): LonLatPoint | null {
  const lon = parseLongitude(properties.modelLongitude ?? properties.modelLon ?? properties.modelLng)
  const lat = parseLatitude(properties.modelLatitude ?? properties.modelLat)
  if (lon == null || lat == null) return null
  return { lon, lat }
}

function normalizeScaleMode(value: unknown): ModelScaleMode {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 'fixed' || normalized === 'manual' ? 'fixed' : 'auto'
}

function parseFiniteNumber(value: unknown) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  const next = Number.parseFloat(normalized)
  return Number.isFinite(next) ? next : null
}

function parsePositiveNumber(value: unknown) {
  const next = parseFiniteNumber(value)
  return next != null && next > 0 ? next : null
}

function parseLongitude(value: unknown) {
  const next = parseFiniteNumber(value)
  return next != null && next >= -180 && next <= 180 ? next : null
}

function parseLatitude(value: unknown) {
  const next = parseFiniteNumber(value)
  return next != null && next >= -90 && next <= 90 ? next : null
}

function toNumberOrDefault(value: unknown, fallback: number) {
  const next = parseFiniteNumber(value)
  return next == null ? fallback : next
}

function toPositiveNumberOrDefault(value: unknown, fallback: number) {
  const next = parsePositiveNumber(value)
  return next == null ? fallback : next
}

function formatCoordinate(value: number) {
  return value.toFixed(6).replace(/(?:\.0+|(\.\d+?)0+)$/, '$1')
}

function formatNumberString(value: number) {
  return String(Number(value.toFixed(2)))
}

function formatPoint(point: LonLatPoint) {
  return `${formatCoordinate(point.lon)}, ${formatCoordinate(point.lat)}`
}

function isPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
}

function toPoint(value: unknown): LonLatPoint | null {
  if (!isPair(value)) return null
  return {
    lon: Number(value[0]),
    lat: Number(value[1]),
  }
}

function centerFromPoints(points: LonLatPoint[]) {
  if (!points.length) return null
  let minLon = points[0].lon
  let maxLon = points[0].lon
  let minLat = points[0].lat
  let maxLat = points[0].lat
  for (const point of points) {
    if (point.lon < minLon) minLon = point.lon
    if (point.lon > maxLon) maxLon = point.lon
    if (point.lat < minLat) minLat = point.lat
    if (point.lat > maxLat) maxLat = point.lat
  }
  return {
    lon: Number(((minLon + maxLon) / 2).toFixed(6)),
    lat: Number(((minLat + maxLat) / 2).toFixed(6)),
  }
}

function collectPolygonPoints(value: unknown): LonLatPoint[] {
  if (!Array.isArray(value)) return []
  const points: LonLatPoint[] = []
  for (const ring of value) {
    if (!Array.isArray(ring)) continue
    for (const point of ring) {
      const next = toPoint(point)
      if (next) points.push(next)
    }
  }
  return points
}

function deriveGeometryCenter(type: string, coordinates: unknown): LonLatPoint | null {
  if (type === 'Polygon') {
    return centerFromPoints(collectPolygonPoints(coordinates))
  }
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    const points = coordinates.flatMap(polygon => collectPolygonPoints(polygon))
    return centerFromPoints(points)
  }
  return null
}
</script>

<style scoped>
.model-dialog {
  position: fixed;
  inset: 0;
  z-index: 72;
}

.model-dialog__mask {
  position: absolute;
  inset: 0;
  background: rgba(8, 12, 22, 0.52);
}

.model-dialog__panel {
  position: absolute;
  inset: 40px 56px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: #ffffff;
  box-shadow: 0 24px 72px rgba(15, 23, 42, 0.24);
  overflow: hidden;
}

.model-dialog__header,
.model-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e7ebf0;
}

.model-dialog__footer {
  border-top: 1px solid #e7ebf0;
  border-bottom: 0;
  justify-content: flex-end;
}

.model-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.model-dialog__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.model-dialog__body {
  flex: 1;
  padding: 20px;
  overflow: auto;
}

.model-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.model-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-field--block {
  grid-column: 1 / -1;
}

.model-field--inline {
  flex-direction: row;
  align-items: center;
}

.model-field__label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.model-field__input {
  width: 100%;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #d8dee8;
  padding: 0 12px;
  font-size: 13px;
  color: #0f172a;
  background: #ffffff;
}

.model-field__checkbox {
  width: 16px;
  height: 16px;
}

.model-dialog__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 18px;
  font-size: 12px;
  color: #64748b;
}

.model-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.model-dialog__btn,
.model-dialog__close {
  height: 38px;
  border-radius: 12px;
  border: 1px solid #d0d5dd;
  background: #ffffff;
  color: #0f172a;
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
}

.model-dialog__btn--primary {
  border-color: rgba(22, 100, 255, 0.35);
  background: var(--primary);
  color: #ffffff;
}

.model-dialog__placeholder,
.model-dialog__error {
  font-size: 13px;
  color: #475569;
}

.model-dialog__error {
  margin-top: 14px;
  color: #dc2626;
}

@media (max-width: 960px) {
  .model-dialog__panel {
    inset: 20px;
  }

  .model-dialog__grid {
    grid-template-columns: 1fr;
  }
}
</style>
