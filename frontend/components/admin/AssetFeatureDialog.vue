<template>
  <div v-if="open" class="dialog">
    <div class="dialog__mask" @click="$emit('close')" />
    <div class="dialog__panel" @click.stop>
      <div class="dialog__header">
        <div>
          <div class="dialog__title">{{ title }}</div>
          <div class="dialog__subtitle">推荐先用表单模式，复杂场景再切高级 JSON</div>
        </div>
        <button class="btn btn--text" type="button" @click="$emit('close')">关闭</button>
      </div>

      <div class="dialog__mode-tabs">
        <button
          type="button"
          :class="['mode-tab', { 'mode-tab--active': editorMode === 'form' }]"
          :disabled="submitting"
          @click="switchMode('form')"
        >
          表单模式（推荐）
        </button>
        <button
          type="button"
          :class="['mode-tab', { 'mode-tab--active': editorMode === 'json' }]"
          :disabled="submitting"
          @click="switchMode('json')"
        >
          高级 JSON
        </button>
      </div>

      <div class="dialog__body">
        <div class="tips">
          <span>图层：{{ form.layer }}</span>
          <span>字段要求：id / layer / geometry</span>
          <span>上手建议：先填基础信息，再生成几何</span>
        </div>

        <template v-if="editorMode === 'form'">
          <div class="form-grid">
            <label class="field">
              <span class="field__label">ID</span>
              <input
                v-model.trim="form.id"
                class="field__input"
                type="text"
                :disabled="submitting || mode === 'edit'"
                placeholder="例如 building_001"
              >
              <span v-if="mode === 'edit'" class="field__hint">编辑模式下 ID 不可修改</span>
              <span v-if="formErrors.id" class="field__error">{{ formErrors.id }}</span>
            </label>

            <label class="field">
              <span class="field__label">图层</span>
              <select v-model="form.layer" class="field__input" :disabled="submitting">
                <option value="buildings">buildings</option>
                <option value="pipes">pipes</option>
              </select>
            </label>

            <label class="field field--inline">
              <span class="field__label">可见性</span>
              <input v-model="form.visible" class="field__checkbox" type="checkbox" :disabled="submitting">
            </label>

            <label class="field">
              <span class="field__label">名称</span>
              <input
                v-model.trim="form.name"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 1号教学楼 / 北区主管"
              >
            </label>

            <label v-if="form.layer === 'buildings'" class="field">
              <span class="field__label">建筑类型</span>
              <input
                v-model.trim="form.building"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 school / dormitory"
              >
            </label>

            <label v-if="form.layer === 'buildings'" class="field">
              <span class="field__label">用途</span>
              <input
                v-model.trim="form.amenity"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 office / library"
              >
            </label>

            <label v-if="form.layer === 'pipes'" class="field">
              <span class="field__label">道路类型（highway）</span>
              <input
                v-model.trim="form.highway"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 service / primary"
              >
            </label>
          </div>

          <div class="geometry-card">
            <div class="geometry-card__header">
              <div>
                <div class="geometry-card__title">几何信息</div>
                <div class="geometry-card__desc">先选几何类型，再填坐标 JSON 数组</div>
              </div>
              <div class="geometry-card__actions">
                <button class="btn btn--small" type="button" :disabled="submitting" @click="fillExampleGeometry">填入示例</button>
                <button class="btn btn--small" type="button" :disabled="submitting" @click="resetGeometry">重置默认</button>
                <button class="btn btn--small" type="button" :disabled="submitting" @click="clearGeometry">清空</button>
              </div>
            </div>

            <label class="field">
              <span class="field__label">几何类型</span>
              <select v-model="form.geometryType" class="field__input" :disabled="submitting">
                <option v-for="type in geometryTypeOptions" :key="type" :value="type">{{ type }}</option>
              </select>
              <span v-if="formErrors.geometryType" class="field__error">{{ formErrors.geometryType }}</span>
            </label>

            <label class="field field--block">
              <span class="field__label">坐标（JSON）</span>
              <textarea
                v-model="form.coordinatesText"
                class="editor"
                spellcheck="false"
                :disabled="submitting"
              />
              <span v-if="formErrors.coordinates" class="field__error">{{ formErrors.coordinates }}</span>
            </label>
          </div>
        </template>

        <template v-else>
          <textarea v-model="payloadText" class="editor" spellcheck="false" :disabled="submitting" />
        </template>

        <div v-if="localError || apiError" class="error">{{ localError || apiError }}</div>
      </div>

      <div class="dialog__footer">
        <button
          v-if="editorMode === 'json'"
          class="btn"
          type="button"
          :disabled="submitting"
          @click="formatJson"
        >
          格式化 JSON
        </button>
        <button class="btn" type="button" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中...' : mode === 'create' ? '确认新增' : '确认保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { AssetLayer, GeoFeaturePayload } from '~/services/geo-features'

type EditorMode = 'form' | 'json'

type FormModel = {
  id: string
  layer: AssetLayer
  visible: boolean
  name: string
  building: string
  amenity: string
  highway: string
  geometryType: string
  coordinatesText: string
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  layer: AssetLayer
  payload: GeoFeaturePayload | null
  submitting?: boolean
  apiError?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: GeoFeaturePayload): void
}>()

const editorMode = ref<EditorMode>('form')
const payloadText = ref('')
const localError = ref<string | null>(null)

const form = reactive<FormModel>({
  id: '',
  layer: props.layer,
  visible: true,
  name: '',
  building: '',
  amenity: '',
  highway: '',
  geometryType: props.layer === 'buildings' ? 'Polygon' : 'LineString',
  coordinatesText: '[]',
})

const title = computed(() => props.mode === 'create' ? '新增要素' : '编辑要素')

const geometryTypeOptions = computed(() => {
  return form.layer === 'buildings'
    ? ['Polygon', 'MultiPolygon']
    : ['LineString', 'MultiLineString']
})

const parsedCoordinates = computed(() => {
  try {
    return JSON.parse(form.coordinatesText)
  } catch {
    return null
  }
})

const formErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {}

  if (!form.id.trim()) {
    errors.id = 'ID 不能为空'
  }

  if (!form.geometryType.trim()) {
    errors.geometryType = '请选择几何类型'
  }

  if (parsedCoordinates.value == null) {
    errors.coordinates = '坐标必须是合法 JSON'
  } else if (!isGeometryCoordinatesValid(form.geometryType, parsedCoordinates.value)) {
    errors.coordinates = '坐标结构与几何类型不匹配'
  }

  return errors
})

watch(
  () => [props.open, props.payload, props.layer],
  () => {
    if (!props.open) return
    localError.value = null
    editorMode.value = 'form'
    hydrateFromPayload(props.payload)
  },
  { immediate: true }
)

watch(
  () => form.layer,
  (layer) => {
    if (!geometryTypeOptions.value.includes(form.geometryType)) {
      form.geometryType = layer === 'buildings' ? 'Polygon' : 'LineString'
      resetGeometry()
    }
  }
)

function defaultGeometry(layer: AssetLayer, geometryType?: string) {
  const type = geometryType || (layer === 'buildings' ? 'Polygon' : 'LineString')

  if (type === 'LineString') {
    return {
      type,
      coordinates: [
        [119.1888, 26.0252],
        [119.1894, 26.0255],
      ],
    }
  }

  if (type === 'MultiLineString') {
    return {
      type,
      coordinates: [
        [
          [119.1888, 26.0252],
          [119.1894, 26.0255],
        ],
      ],
    }
  }

  if (type === 'MultiPolygon') {
    return {
      type,
      coordinates: [
        [
          [
            [119.1889, 26.0252],
            [119.1891, 26.0252],
            [119.1891, 26.0254],
            [119.1889, 26.0254],
            [119.1889, 26.0252],
          ],
        ],
      ],
    }
  }

  return {
    type: 'Polygon',
    coordinates: [
      [
        [119.1889, 26.0252],
        [119.1891, 26.0252],
        [119.1891, 26.0254],
        [119.1889, 26.0254],
        [119.1889, 26.0252],
      ],
    ],
  }
}

function isPair(value: unknown) {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
}

function isLineStringCoordinates(value: unknown) {
  return Array.isArray(value) && value.length >= 2 && value.every(isPair)
}

function isPolygonCoordinates(value: unknown) {
  return Array.isArray(value)
    && value.length >= 1
    && value.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(isPair))
}

function isGeometryCoordinatesValid(type: string, coordinates: unknown) {
  if (type === 'LineString') return isLineStringCoordinates(coordinates)
  if (type === 'MultiLineString') return Array.isArray(coordinates) && coordinates.length >= 1 && coordinates.every(isLineStringCoordinates)
  if (type === 'Polygon') return isPolygonCoordinates(coordinates)
  if (type === 'MultiPolygon') {
    return Array.isArray(coordinates)
      && coordinates.length >= 1
      && coordinates.every(isPolygonCoordinates)
  }
  return false
}

function normalizeLayer(layer: unknown): AssetLayer {
  return String(layer || '').toLowerCase() === 'buildings' ? 'buildings' : 'pipes'
}

function normalizePayload(input: unknown): GeoFeaturePayload | null {
  if (!input || typeof input !== 'object') return null
  const data = input as Record<string, any>

  const id = typeof data.id === 'string' ? data.id.trim() : ''
  if (!id) return null

  const layer = normalizeLayer(data.layer || props.layer)

  const geometry = data.geometry
  if (!geometry || typeof geometry !== 'object' || typeof geometry.type !== 'string') {
    return null
  }

  const type = String((geometry as any).type)
  const coordinates = (geometry as any).coordinates
  if (!isGeometryCoordinatesValid(type, coordinates)) {
    return null
  }

  const properties = data.properties && typeof data.properties === 'object'
    ? { ...(data.properties as Record<string, unknown>) }
    : {}
  delete (properties as any).visible

  const visible = typeof data.visible === 'boolean' ? data.visible : true

  return {
    id,
    layer,
    geometry: {
      type,
      coordinates,
    },
    properties,
    visible,
  }
}

function applyPayloadToForm(payload: GeoFeaturePayload) {
  const layer = normalizeLayer(payload.layer)
  const properties = payload.properties || {}

  form.id = payload.id
  form.layer = layer
  form.visible = payload.visible
  form.name = String(properties.name ?? '')
  form.building = String(properties.building ?? '')
  form.amenity = String(properties.amenity ?? '')
  form.highway = String(properties.highway ?? '')
  form.geometryType = String(payload.geometry?.type || (layer === 'buildings' ? 'Polygon' : 'LineString'))
  form.coordinatesText = JSON.stringify(payload.geometry?.coordinates ?? defaultGeometry(layer, form.geometryType).coordinates, null, 2)
}

function buildPayloadFromForm(): GeoFeaturePayload | null {
  if (Object.keys(formErrors.value).length) return null

  const coordinates = parsedCoordinates.value
  if (!isGeometryCoordinatesValid(form.geometryType, coordinates)) {
    return null
  }

  const properties: Record<string, unknown> = {}
  if (form.name.trim()) properties.name = form.name.trim()

  if (form.layer === 'buildings') {
    if (form.building.trim()) properties.building = form.building.trim()
    if (form.amenity.trim()) properties.amenity = form.amenity.trim()
  } else {
    if (form.highway.trim()) properties.highway = form.highway.trim()
  }

  return {
    id: form.id.trim(),
    layer: form.layer,
    geometry: {
      type: form.geometryType,
      coordinates,
    },
    properties,
    visible: form.visible,
  }
}

function hydrateFromPayload(payload: GeoFeaturePayload | null) {
  const base = payload || {
    id: '',
    layer: props.layer,
    visible: true,
    geometry: defaultGeometry(props.layer),
    properties: {},
  }

  applyPayloadToForm({
    id: base.id,
    layer: normalizeLayer(base.layer),
    visible: base.visible,
    geometry: base.geometry,
    properties: base.properties,
  })

  payloadText.value = JSON.stringify(buildPayloadFromForm() || base, null, 2)
}

function switchMode(mode: EditorMode) {
  if (mode === editorMode.value) return
  localError.value = null

  if (mode === 'json') {
    const payload = buildPayloadFromForm()
    if (!payload) {
      localError.value = '表单中仍有错误，请先修正后再切换到 JSON'
      return
    }
    payloadText.value = JSON.stringify(payload, null, 2)
    editorMode.value = 'json'
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(payloadText.value || '{}')
  } catch {
    localError.value = 'JSON 解析失败，无法切回表单'
    return
  }

  const payload = normalizePayload(parsed)
  if (!payload) {
    localError.value = 'JSON 字段不完整或几何结构非法，无法切回表单'
    return
  }

  applyPayloadToForm(payload)
  editorMode.value = 'form'
}

function formatJson() {
  localError.value = null
  try {
    const parsed = JSON.parse(payloadText.value || '{}')
    payloadText.value = JSON.stringify(parsed, null, 2)
  } catch {
    localError.value = 'JSON 格式错误，无法格式化'
  }
}

function fillExampleGeometry() {
  const geometry = defaultGeometry(form.layer, form.geometryType)
  form.coordinatesText = JSON.stringify(geometry.coordinates, null, 2)
}

function resetGeometry() {
  const geometry = defaultGeometry(form.layer, form.geometryType)
  form.geometryType = geometry.type
  form.coordinatesText = JSON.stringify(geometry.coordinates, null, 2)
}

function clearGeometry() {
  form.coordinatesText = '[]'
}

function enforceEditPayloadId(payload: GeoFeaturePayload) {
  if (props.mode !== 'edit') return payload

  const originalId = typeof props.payload?.id === 'string' ? props.payload.id.trim() : ''
  if (!originalId) return payload

  if (payload.id !== originalId) {
    localError.value = `编辑模式下不支持修改 ID（应为 ${originalId}）`
    return null
  }

  return payload
}

function submit() {
  localError.value = null

  if (editorMode.value === 'form') {
    if (Object.keys(formErrors.value).length) {
      localError.value = '请先修正表单错误后再提交'
      return
    }

    const payload = buildPayloadFromForm()
    if (!payload) {
      localError.value = '表单数据无效，请检查几何结构'
      return
    }

    const finalPayload = enforceEditPayloadId(payload)
    if (!finalPayload) return

    emit('submit', finalPayload)
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(payloadText.value)
  } catch {
    localError.value = 'JSON 格式错误'
    return
  }

  const payload = normalizePayload(parsed)
  if (!payload) {
    localError.value = '字段不完整或几何结构非法，至少需要 id / layer / geometry'
    return
  }

  const finalPayload = enforceEditPayloadId(payload)
  if (!finalPayload) return

  emit('submit', finalPayload)
}
</script>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: 60;
}

.dialog__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .35);
}

.dialog__panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(920px, calc(100vw - 24px));
  max-height: calc(100vh - 40px);
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(18, 24, 38, .2);
  display: flex;
  flex-direction: column;
}

.dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.dialog__title {
  font-size: 15px;
  font-weight: 600;
}

.dialog__subtitle {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.dialog__mode-tabs {
  display: flex;
  gap: 8px;
  padding: 10px 12px 0;
}

.mode-tab {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--muted);
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
}

.mode-tab--active {
  border-color: rgba(22, 100, 255, .35);
  color: var(--primary);
  background: rgba(22, 100, 255, .08);
}

.mode-tab:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.dialog__body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.tips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field--inline {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.field--block {
  grid-column: 1 / -1;
}

.field__label {
  font-size: 12px;
  color: var(--muted);
}

.field__input {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  outline: none;
  font-size: 13px;
  background: #ffffff;
  color: var(--text);
}

.field__checkbox {
  width: 16px;
  height: 16px;
}

.field__hint {
  font-size: 12px;
  color: var(--muted);
}

.field__error {
  font-size: 12px;
  color: #c03631;
}

.geometry-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.geometry-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.geometry-card__title {
  font-size: 13px;
  font-weight: 600;
}

.geometry-card__desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.geometry-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.editor {
  width: 100%;
  min-height: 240px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  resize: vertical;
  font-size: 12px;
  line-height: 18px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.error {
  font-size: 12px;
  color: #c03631;
}

.dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border);
}

.btn {
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text);
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
}

.btn:hover {
  background: #f8f9fa;
}

.btn:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.btn--small {
  height: 28px;
  font-size: 12px;
  padding: 0 8px;
}

.btn--primary {
  background: var(--primary);
  color: #ffffff;
  border-color: rgba(22, 100, 255, .35);
}

.btn--primary:hover {
  background: #0f55e6;
}

.btn--text {
  border-color: transparent;
  color: var(--muted);
  padding: 0 6px;
}

.btn--text:hover {
  background: rgba(22, 100, 255, .08);
}

@media (max-width: 860px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
