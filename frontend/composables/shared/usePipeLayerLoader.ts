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

type UsePipeLayerLoaderOptions = {
  getViewer: () => Cesium.Viewer | null
  dataSources: PipeDataSources
  loadedLayers: Ref<Set<string>>
  sourceUrl?: string
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

export function usePipeLayerLoader(options: UsePipeLayerLoaderOptions) {
  const runtimeConfig = useRuntimeConfig()
  const backendBaseUrl = normalizeBackendBaseUrl(runtimeConfig.public.backendBaseUrl as string | undefined)
  const sourceUrl = options.sourceUrl || `${backendBaseUrl}/api/v1/features?layers=pipes&visible=true`
  let pipeLoadPromise: Promise<void> | null = null

  function isPipeLayer(layerName: string): layerName is PipeLayerName {
    return PIPE_LAYER_NAMES.includes(layerName as PipeLayerName)
  }

  function loadPipeLayers() {
    const viewer = options.getViewer()
    if (!viewer) return Promise.resolve()
    if (pipeLoadPromise) return pipeLoadPromise

    const requestUrl = `${sourceUrl}&t=${Date.now()}`
    pipeLoadPromise = Cesium.GeoJsonDataSource.load(requestUrl, { clampToGround: true })
      .then(layerDataSource => {
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
      })
      .catch(err => {
        console.error('Failed to load pipe layers from pipes:', requestUrl, err)
      })
      .finally(() => {
        pipeLoadPromise = null
      })

    return pipeLoadPromise
  }

  return {
    isPipeLayer,
    loadPipeLayers,
  }
}
