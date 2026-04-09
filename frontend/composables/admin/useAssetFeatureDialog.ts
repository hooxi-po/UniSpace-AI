import { computed, reactive, ref, watch } from 'vue'
import type { AssetLayer, GeoFeaturePayload } from '~/services/geo-features'

type EditorMode = 'form' | 'json'
type BuildingModelScaleMode = 'auto' | 'fixed'

const DEFAULT_BUILDING_MODEL_URL = '/models/residential_building.glb'
const BUILDING_TYPE_OPTIONS = [
  'school',
  'university',
  'dormitory',
  'residential',
  'office',
  'commercial',
  'retail',
  'service',
  'public',
]
const AMENITY_OPTIONS = [
  'office',
  'residential',
  'library',
  'classroom',
  'school',
  'dormitory',
  'canteen',
  'hospital',
  'parking',
]
const BUILDING_LEVEL_OPTIONS = ['1', '2', '3', '4', '6', '8', '12']
const MODEL_URL_OPTIONS = [
  '/models/residential_building.glb',
  '/models/officeBuild.glb',
  '/models/glbfile.glb',
]
const MODEL_SCALE_MODE_OPTIONS: Array<{ value: BuildingModelScaleMode, label: string }> = [
  { value: 'auto', label: '自动适配' },
  { value: 'fixed', label: '固定倍率' },
]
const MODEL_SCALE_OPTIONS_AUTO = ['0.5', '0.8', '1', '1.2', '1.5', '2']
const MODEL_SCALE_OPTIONS_FIXED = ['1', '5', '10', '15', '20', '30']
const MODEL_HEADING_OPTIONS = ['0', '45', '90', '135', '180', '225', '270', '315']
const MODEL_PITCH_OPTIONS = ['-30', '-15', '0', '15', '30']
const MODEL_ROLL_OPTIONS = ['-30', '-15', '0', '15', '30']
const FORM_PROPERTY_KEYS = new Set([
  'name',
  'building',
  'amenity',
  'highway',
  'building:levels',
  'modelEnabled',
  'modelUrl',
  'modelScaleMode',
  'modelScale',
  'modelHeading',
  'modelPitch',
  'modelRoll',
])

type FormModel = {
  id: string
  layer: AssetLayer
  visible: boolean
  name: string
  building: string
  amenity: string
  highway: string
  levels: string
  modelEnabled: boolean
  modelUrl: string
  modelScaleMode: BuildingModelScaleMode
  modelScale: string
  modelHeading: string
  modelPitch: string
  modelRoll: string
  geometryType: string
  coordinatesText: string
}

type AssetFeatureDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  layer: AssetLayer
  payload: GeoFeaturePayload | null
  submitting?: boolean
  apiError?: string | null
}

export function useAssetFeatureDialog(
  props: Readonly<AssetFeatureDialogProps>,
  emitSubmit: (payload: GeoFeaturePayload) => void,
) {
  const editorMode = ref<EditorMode>('form')
  const payloadText = ref('')
  const localError = ref<string | null>(null)
  const extraProperties = ref<Record<string, unknown>>({})

  const form = reactive<FormModel>({
    id: '',
    layer: props.layer,
    visible: true,
    name: '',
    building: '',
    amenity: '',
    highway: '',
    levels: '',
    modelEnabled: false,
    modelUrl: DEFAULT_BUILDING_MODEL_URL,
    modelScaleMode: 'auto',
    modelScale: '1',
    modelHeading: '0',
    modelPitch: '0',
    modelRoll: '0',
    geometryType: props.layer === 'buildings' ? 'Polygon' : 'LineString',
    coordinatesText: '[]',
  })

  const title = computed(() => (props.mode === 'create' ? '新增要素' : '编辑要素'))
  const buildingTypeOptions = BUILDING_TYPE_OPTIONS
  const amenityOptions = AMENITY_OPTIONS
  const buildingLevelOptions = BUILDING_LEVEL_OPTIONS
  const modelUrlOptions = MODEL_URL_OPTIONS
  const modelScaleModeOptions = MODEL_SCALE_MODE_OPTIONS
  const modelScaleOptions = computed(() => {
    return form.modelScaleMode === 'fixed' ? MODEL_SCALE_OPTIONS_FIXED : MODEL_SCALE_OPTIONS_AUTO
  })
  const modelHeadingOptions = MODEL_HEADING_OPTIONS
  const modelPitchOptions = MODEL_PITCH_OPTIONS
  const modelRollOptions = MODEL_ROLL_OPTIONS

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

    if (form.layer === 'buildings' && form.levels.trim() && parsePositiveInteger(form.levels) == null) {
      errors.levels = '楼层必须是正整数'
    }

    if (form.layer === 'buildings' && form.modelEnabled) {
      if (!form.modelUrl.trim()) {
        errors.modelUrl = '启用模型后必须提供模型地址'
      }
      if (parsePositiveNumber(form.modelScale) == null) {
        errors.modelScale = '缩放倍率必须是大于 0 的数字'
      }
      if (parseFiniteNumber(form.modelHeading) == null) {
        errors.modelHeading = 'Heading 必须是数字'
      }
      if (parseFiniteNumber(form.modelPitch) == null) {
        errors.modelPitch = 'Pitch 必须是数字'
      }
      if (parseFiniteNumber(form.modelRoll) == null) {
        errors.modelRoll = 'Roll 必须是数字'
      }
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
    { immediate: true },
  )

  watch(
    () => form.layer,
    (layer) => {
      if (!geometryTypeOptions.value.includes(form.geometryType)) {
        form.geometryType = layer === 'buildings' ? 'Polygon' : 'LineString'
        resetGeometry()
      }
      if (layer === 'buildings' && !form.modelUrl.trim()) {
        form.modelUrl = DEFAULT_BUILDING_MODEL_URL
      }
    },
  )

  watch(
    () => form.modelEnabled,
    (enabled) => {
      if (enabled && !form.modelUrl.trim()) {
        form.modelUrl = DEFAULT_BUILDING_MODEL_URL
      }
    },
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
    if (type === 'MultiLineString') {
      return Array.isArray(coordinates) && coordinates.length >= 1 && coordinates.every(isLineStringCoordinates)
    }
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

  function normalizeBoolean(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (!normalized) return fallback
      return !['0', 'false', 'off', 'no'].includes(normalized)
    }
    return fallback
  }

  function normalizeScaleMode(value: unknown): BuildingModelScaleMode {
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

  function parsePositiveInteger(value: unknown) {
    const normalized = String(value ?? '').trim()
    if (!normalized) return null
    const next = Number.parseInt(normalized, 10)
    return String(next) === normalized && next > 0 ? next : null
  }

  function toFiniteNumber(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.trim())
      if (Number.isFinite(parsed)) return parsed
    }
    return fallback
  }

  function toPositiveNumber(value: unknown, fallback: number) {
    const next = toFiniteNumber(value, fallback)
    return next > 0 ? next : fallback
  }

  function toPositiveInteger(value: unknown, fallback: number | null = null) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (!normalized) return fallback
      const parsed = Number.parseInt(normalized, 10)
      if (String(parsed) === normalized && parsed > 0) return parsed
    }
    return fallback
  }

  function pickExtraProperties(properties: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(properties).filter(([key]) => !FORM_PROPERTY_KEYS.has(key)),
    )
  }

  function normalizePayload(input: unknown): GeoFeaturePayload | null {
    if (!input || typeof input !== 'object') return null
    const data = input as Record<string, unknown>

    const id = typeof data.id === 'string' ? data.id.trim() : ''
    if (!id) return null

    const layer = normalizeLayer(data.layer || props.layer)

    const geometry = data.geometry
    if (!geometry || typeof geometry !== 'object' || typeof (geometry as Record<string, unknown>).type !== 'string') {
      return null
    }

    const geometryData = geometry as Record<string, unknown>
    const type = String(geometryData.type)
    const coordinates = geometryData.coordinates
    if (!isGeometryCoordinatesValid(type, coordinates)) {
      return null
    }

    const properties = data.properties && typeof data.properties === 'object'
      ? { ...(data.properties as Record<string, unknown>) }
      : {}
    delete properties.visible

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
    const hasModelUrl = typeof properties.modelUrl === 'string' && properties.modelUrl.trim().length > 0

    form.id = payload.id
    form.layer = layer
    form.visible = payload.visible
    form.name = String(properties.name ?? '')
    form.building = String(properties.building ?? '')
    form.amenity = String(properties.amenity ?? '')
    form.highway = String(properties.highway ?? '')
    form.levels = String(toPositiveInteger(properties['building:levels'], null) ?? '')
    form.modelEnabled = normalizeBoolean(properties.modelEnabled, hasModelUrl)
    form.modelUrl = typeof properties.modelUrl === 'string' && properties.modelUrl.trim()
      ? properties.modelUrl.trim()
      : DEFAULT_BUILDING_MODEL_URL
    form.modelScaleMode = normalizeScaleMode(properties.modelScaleMode)
    form.modelScale = String(toPositiveNumber(properties.modelScale, 1))
    form.modelHeading = String(toFiniteNumber(properties.modelHeading, 0))
    form.modelPitch = String(toFiniteNumber(properties.modelPitch, 0))
    form.modelRoll = String(toFiniteNumber(properties.modelRoll, 0))
    form.geometryType = String(payload.geometry?.type || (layer === 'buildings' ? 'Polygon' : 'LineString'))
    form.coordinatesText = JSON.stringify(
      payload.geometry?.coordinates ?? defaultGeometry(layer, form.geometryType).coordinates,
      null,
      2,
    )
    extraProperties.value = pickExtraProperties(properties)
  }

  function buildPayloadFromForm(): GeoFeaturePayload | null {
    if (Object.keys(formErrors.value).length) return null

    const coordinates = parsedCoordinates.value
    if (!isGeometryCoordinatesValid(form.geometryType, coordinates)) {
      return null
    }

    const properties: Record<string, unknown> = { ...extraProperties.value }
    if (form.name.trim()) properties.name = form.name.trim()

    if (form.layer === 'buildings') {
      if (form.building.trim()) properties.building = form.building.trim()
      if (form.amenity.trim()) properties.amenity = form.amenity.trim()
      const levels = parsePositiveInteger(form.levels)
      if (levels != null) {
        properties['building:levels'] = levels
      }

      properties.modelEnabled = form.modelEnabled
      if (form.modelEnabled) {
        properties.modelUrl = form.modelUrl.trim()
        properties.modelScaleMode = form.modelScaleMode
        properties.modelScale = parsePositiveNumber(form.modelScale) ?? 1
        properties.modelHeading = parseFiniteNumber(form.modelHeading) ?? 0
        properties.modelPitch = parseFiniteNumber(form.modelPitch) ?? 0
        properties.modelRoll = parseFiniteNumber(form.modelRoll) ?? 0
      }
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

      emitSubmit(finalPayload)
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

    emitSubmit(finalPayload)
  }

  return {
    editorMode,
    payloadText,
    localError,
    form,
    title,
    geometryTypeOptions,
    formErrors,
    buildingTypeOptions,
    amenityOptions,
    buildingLevelOptions,
    modelUrlOptions,
    modelScaleModeOptions,
    modelScaleOptions,
    modelHeadingOptions,
    modelPitchOptions,
    modelRollOptions,
    switchMode,
    formatJson,
    fillExampleGeometry,
    resetGeometry,
    clearGeometry,
    submit,
  }
}
