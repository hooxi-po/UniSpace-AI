import * as Cesium from 'cesium'
import type { Ref } from 'vue'
import {
  PIPE_LAYER_NAMES,
  classifyRoadToPipeLayer,
  type PipeLayerName,
} from '~/utils/pipe-classifier'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'

export { PIPE_LAYER_NAMES }
export type { PipeLayerName }

type PipeDataSources = Record<PipeLayerName, Cesium.CustomDataSource>

type PipeStyle = {
  glowStroke: Cesium.Color
  glowWidth: number
}

type PipeStyles = Record<PipeLayerName, PipeStyle>

type PipeQueryParams = Record<string, string | number | boolean | null | undefined>

type UsePipeLayerLoaderOptions = {
  getViewer: () => Cesium.Viewer | null
  dataSources: PipeDataSources
  loadedLayers: Ref<Set<string>>
  sourceUrl?: string
  getQueryParams?: () => PipeQueryParams
  pageSize?: number
  maxPages?: number
}

const PIPE_STYLES: PipeStyles = {
  water: {
    glowStroke: Cesium.Color.fromCssColorString('#119A61'),
    glowWidth: 5,
  },
  drain: {
    glowStroke: Cesium.Color.fromCssColorString('#3F86EA'),
    glowWidth: 5,
  },
  sewage: {
    glowStroke: Cesium.Color.fromCssColorString('#A16AEE'),
    glowWidth: 5,
  },
}

function stylePipeEntity(entity: Cesium.Entity, pipeLayer: PipeLayerName) {
  const pipeStyle = PIPE_STYLES[pipeLayer]
  if (entity.polyline) {
    entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
      color: pipeStyle.glowStroke,
      glowPower: 0.4,
      taperPower: 1,
    })
    entity.polyline.width = new Cesium.ConstantProperty(pipeStyle.glowWidth)
    entity.polyline.clampToGround = new Cesium.ConstantProperty(true)
  }

  if (entity.polygon) {
    entity.polygon.material = new Cesium.ColorMaterialProperty(pipeStyle.glowStroke.withAlpha(0.15))
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(pipeStyle.glowStroke.withAlpha(0.8))
    entity.polygon.outlineWidth = new Cesium.ConstantProperty(1)
  }
}

function appendQuery(url: string, query: PipeQueryParams) {
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      u.searchParams.delete(key)
      continue
    }
    u.searchParams.set(key, String(value))
  }
  return u.toString()
}

function serializeQuery(query: PipeQueryParams) {
  return JSON.stringify(
    Object.keys(query)
      .sort()
      .reduce<Record<string, string | number | boolean | null | undefined>>((acc, key) => {
        acc[key] = query[key]
        return acc
      }, {})
  )
}

function splitMultiBbox(rawBbox: unknown) {
  if (typeof rawBbox !== 'string') return []
  return rawBbox
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

function getFeatureDedupKey(feature: Record<string, unknown>) {
  const id = feature.id
  if (id !== undefined && id !== null) {
    return `id:${String(id)}`
  }

  return `raw:${JSON.stringify(feature.geometry)}|${JSON.stringify(feature.properties)}`
}

export function usePipeLayerLoader(options: UsePipeLayerLoaderOptions) {
  const runtimeConfig = useRuntimeConfig()
  const backendBaseUrl = normalizeBackendBaseUrl(runtimeConfig.public.backendBaseUrl as string | undefined)
  const sourceUrl = options.sourceUrl || `${backendBaseUrl}/api/v1/features?layers=pipes&visible=true`
  const pageSize = Math.max(200, Math.min(options.pageSize ?? 800, 2000))
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 5, 20))

  let pipeLoadPromise: Promise<void> | null = null
  let inflightQueryKey = ''
  let lastQueryKey = ''
  let currentLoadSeq = 0

  function isPipeLayer(layerName: string): layerName is PipeLayerName {
    return PIPE_LAYER_NAMES.includes(layerName as PipeLayerName)
  }

  async function fetchPipeFeatures(baseQuery: PipeQueryParams) {
    const features: Record<string, unknown>[] = []
    const featureKeys = new Set<string>()
    const bboxes = splitMultiBbox(baseQuery.bbox)
    const querySegments: PipeQueryParams[] = bboxes.length
      ? bboxes.map(bbox => ({ ...baseQuery, bbox }))
      : [baseQuery]

    for (const segmentQuery of querySegments) {
      for (let page = 1; page <= maxPages; page++) {
        const pageQuery: PipeQueryParams = {
          ...segmentQuery,
          page,
          limit: pageSize,
        }
        const requestUrl = appendQuery(sourceUrl, pageQuery)
        const res = await fetch(requestUrl)
        if (!res.ok) {
          throw new Error(`load_pipes_failed_http_${res.status}`)
        }

        const fc = (await res.json()) as { features?: Record<string, unknown>[] }
        const pageFeatures = Array.isArray(fc.features) ? fc.features : []
        for (const feature of pageFeatures) {
          const featureKey = getFeatureDedupKey(feature)
          if (featureKeys.has(featureKey)) continue
          featureKeys.add(featureKey)
          features.push(feature)
        }

        if (pageFeatures.length < pageSize) {
          break
        }
      }
    }

    return {
      type: 'FeatureCollection',
      features,
    }
  }

  function loadPipeLayers(force = false) {
    const viewer = options.getViewer()
    if (!viewer) return Promise.resolve()

    const baseQuery: PipeQueryParams = options.getQueryParams ? options.getQueryParams() : {}
    const queryKey = serializeQuery(baseQuery)
    if (pipeLoadPromise && inflightQueryKey === queryKey) {
      return pipeLoadPromise
    }
    if (pipeLoadPromise && !force) return pipeLoadPromise
    if (!force && queryKey === lastQueryKey) {
      return Promise.resolve()
    }

    const loadSeq = ++currentLoadSeq
    inflightQueryKey = queryKey
    pipeLoadPromise = fetchPipeFeatures(baseQuery)
      .then(fc => Cesium.GeoJsonDataSource.load(fc, { clampToGround: true }))
      .then(layerDataSource => {
        if (loadSeq !== currentLoadSeq) return

        const currentViewer = options.getViewer()
        if (!currentViewer) return

        for (const layer of PIPE_LAYER_NAMES) {
          options.dataSources[layer].entities.removeAll()
        }

        const currentTime = currentViewer.clock.currentTime
        for (const entity of layerDataSource.entities.values) {
          entity.label = undefined
          entity.billboard = undefined
          entity.point = undefined
          entity.description = undefined

          const rawProps = (entity.properties?.getValue(currentTime) || {}) as Record<string, unknown>
          const pipeLayer = classifyRoadToPipeLayer(rawProps, String(entity.id))

          entity.properties = new Cesium.PropertyBag({
            ...rawProps,
            pipeType: pipeLayer,
          })

          stylePipeEntity(entity, pipeLayer)
          options.dataSources[pipeLayer].entities.add(entity)
        }

        for (const layer of PIPE_LAYER_NAMES) {
          options.loadedLayers.value.add(layer)
        }
        lastQueryKey = queryKey
      })
      .catch(err => {
        console.error('Failed to load pipe layers from pipes:', err)
      })
      .finally(() => {
        if (loadSeq === currentLoadSeq) {
          pipeLoadPromise = null
          inflightQueryKey = ''
        }
      })

    return pipeLoadPromise
  }

  return {
    isPipeLayer,
    loadPipeLayers,
  }
}
