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

  const title = computed(() => (props.mode === 'create' ? '新增要素' : '编辑要素'))

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
    { immediate: true },
  )

  watch(
    () => form.layer,
    (layer) => {
      if (!geometryTypeOptions.value.includes(form.geometryType)) {
        form.geometryType = layer === 'buildings' ? 'Polygon' : 'LineString'
        resetGeometry()
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

    form.id = payload.id
    form.layer = layer
    form.visible = payload.visible
    form.name = String(properties.name ?? '')
    form.building = String(properties.building ?? '')
    form.amenity = String(properties.amenity ?? '')
    form.highway = String(properties.highway ?? '')
    form.geometryType = String(payload.geometry?.type || (layer === 'buildings' ? 'Polygon' : 'LineString'))
    form.coordinatesText = JSON.stringify(
      payload.geometry?.coordinates ?? defaultGeometry(layer, form.geometryType).coordinates,
      null,
      2,
    )
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
    switchMode,
    formatJson,
    fillExampleGeometry,
    resetGeometry,
    clearGeometry,
    submit,
  }
}
