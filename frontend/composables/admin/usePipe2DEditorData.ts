import { computed, ref, type ComputedRef, type Ref } from 'vue'
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
import {
  cloneLines,
  getErrorMessage,
  type Lines,
} from '~/utils/pipe2d-geometry'

type Message = {
  type: 'ok' | 'error'
  text: string
}

type UsePipe2DEditorDataOptions = {
  backendBaseUrl: Ref<string>
  initialFeatureId: Ref<string | null | undefined>
  pipes: Ref<GeoJsonFeature[]>
  selectedFeatureId: Ref<string>
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  draftLines: Ref<Lines>
  originalLines: Ref<Lines>
  history: Ref<Lines[]>
  saving: Ref<boolean>
  actionMessage: Ref<Message | null>
  emitSaved: (id: string) => void
}

export function usePipe2DEditorData(options: UsePipe2DEditorDataOptions) {
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const drilldown = ref<TwinDrilldown | null>(null)
  const traceResult = ref<TwinTrace | null>(null)
  const telemetryList = ref<TwinTelemetryPoint[]>([])
  const auditLogs = ref<TwinAuditItem[]>([])
  const insightError = ref<string | null>(null)

  const telemetryPreview = computed(() => telemetryList.value.slice(0, 5))
  const auditPreview = computed(() => auditLogs.value.slice(0, 5))

  async function loadPipes() {
    loading.value = true
    loadError.value = null
    options.actionMessage.value = null

    try {
      const features = await geoFeatureService.list(options.backendBaseUrl.value, {
        layer: 'pipes',
        limit: 6000,
      })
      options.pipes.value = features.filter(item => {
        const type = String(item.geometry?.type || '')
        return type === 'LineString' || type === 'MultiLineString'
      })

      const preferredId = options.initialFeatureId.value
      const hasPreferred = preferredId
        && options.pipes.value.some(item => String(item.id) === preferredId)
      if (hasPreferred) {
        options.selectedFeatureId.value = String(preferredId)
      } else if (
        !options.selectedFeatureId.value
        || !options.pipes.value.some(item => String(item.id) === options.selectedFeatureId.value)
      ) {
        options.selectedFeatureId.value = options.pipes.value.length
          ? String(options.pipes.value[0].id)
          : ''
      }
    } catch (err: unknown) {
      loadError.value = getErrorMessage(err, '加载管道列表失败')
      options.pipes.value = []
      options.selectedFeatureId.value = ''
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
      twinService.drilldown(options.backendBaseUrl.value, featureId),
      twinService.trace(options.backendBaseUrl.value, featureId, 'down'),
      twinService.telemetryLatest(options.backendBaseUrl.value, [featureId]),
      twinService.listAuditLogs(options.backendBaseUrl.value, featureId, 10),
    ])

    if (drilldownResult.status === 'fulfilled') {
      drilldown.value = drilldownResult.value
    } else {
      insightError.value = getErrorMessage(drilldownResult.reason, '穿透信息获取失败')
    }

    if (traceResultDown.status === 'fulfilled') {
      traceResult.value = traceResultDown.value
    } else if (!insightError.value) {
      insightError.value = getErrorMessage(traceResultDown.reason, '拓扑追踪失败')
    }

    if (telemetryResult.status === 'fulfilled') {
      telemetryList.value = telemetryResult.value
    } else if (!insightError.value) {
      insightError.value = getErrorMessage(telemetryResult.reason, '测点读取失败')
    }

    if (auditResult.status === 'fulfilled') {
      auditLogs.value = auditResult.value
    } else if (!insightError.value) {
      insightError.value = getErrorMessage(auditResult.reason, '审计日志读取失败')
    }
  }

  function buildPayloadForSave(feature: GeoJsonFeature): GeoFeaturePayload {
    const properties = { ...(feature.properties || {}) }
    const visible = Boolean(properties.visible ?? true)
    delete (properties as Record<string, unknown>).visible

    const oldType = String(feature.geometry?.type || 'LineString')
    const shouldUseMulti = oldType === 'MultiLineString' || options.draftLines.value.length > 1

    return {
      id: String(feature.id),
      layer: 'pipes',
      geometry: {
        type: shouldUseMulti ? 'MultiLineString' : 'LineString',
        coordinates: shouldUseMulti ? options.draftLines.value : options.draftLines.value[0],
      },
      properties,
      visible,
    }
  }

  async function saveGeometry() {
    if (!options.selectedFeature.value) return
    if (!options.draftLines.value.length || options.draftLines.value.some(line => line.length < 2)) {
      options.actionMessage.value = { type: 'error', text: '至少保留一条由两个点组成的线' }
      return
    }

    options.saving.value = true
    options.actionMessage.value = null
    try {
      const payload = buildPayloadForSave(options.selectedFeature.value)
      try {
        await twinService.updatePipeGeometry(
          options.backendBaseUrl.value,
          payload.id,
          payload.geometry,
          'admin-2d-editor',
        )
      } catch {
        // Backward compatible fallback when twin write API is unavailable.
        await geoFeatureService.update(options.backendBaseUrl.value, payload)
      }

      const index = options.pipes.value.findIndex(item => String(item.id) === payload.id)
      if (index >= 0) {
        const nextGeometry = {
          type: payload.geometry.type,
          coordinates: payload.geometry.coordinates,
        }
        const nextProperties = {
          ...(options.selectedFeature.value.properties || {}),
          ...payload.properties,
          visible: payload.visible,
        }
        options.pipes.value[index] = {
          ...options.pipes.value[index],
          geometry: nextGeometry,
          properties: nextProperties,
        }
      }

      options.originalLines.value = cloneLines(options.draftLines.value)
      options.history.value = []
      options.actionMessage.value = { type: 'ok', text: `已保存 ${payload.id} 的几何` }
      options.emitSaved(payload.id)
      loadInsights(payload.id)
    } catch (err: unknown) {
      options.actionMessage.value = { type: 'error', text: getErrorMessage(err, '保存失败') }
    } finally {
      options.saving.value = false
    }
  }

  return {
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
  }
}
