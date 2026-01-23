<template>
  <div ref="cesiumContainerRef" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import type { PipeNode, Building } from '~/types'

const DEFAULT_CAMERA = {
  longitude: 119.1895,
  latitude: 26.0254,
  height: 500,
  heading: 30,
  pitch: -35,
}

type SelectItem = PipeNode | Building | null

type Viewport = { x: number; y: number; scale: number }

type MapLayers = {
    water: boolean
    sewage: boolean
    drain: boolean
    buildings: boolean
  green?: boolean
  roads?: boolean
  }

interface Props {
  selectedId: string | null
  viewport: Viewport
  layers: MapLayers
  weatherMode: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [item: SelectItem]
  'update:viewport': [value: Viewport]
}>()

const cesiumContainerRef = ref<HTMLDivElement | null>(null)
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let highlightedEntity: Cesium.Entity | null = null
let highlightedOriginal: {
  polygonMaterial?: Cesium.MaterialProperty
  polylineMaterial?: Cesium.MaterialProperty
  polylineWidth?: number
} | null = null

// Layer data sources
const dataSources = {
  water: new Cesium.CustomDataSource('water'),
  green: new Cesium.CustomDataSource('green'),
  buildings: new Cesium.CustomDataSource('buildings'),
  roads: new Cesium.CustomDataSource('roads'),
  // For other pipelines if needed
  sewage: new Cesium.CustomDataSource('sewage'),
  drain: new Cesium.CustomDataSource('drain'),
}

// Styling similar to the React example
const styles = {
  water: {
    fill: new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('rgb(10, 37, 81)').withAlpha(0.8)
    ),
    stroke: Cesium.Color.CYAN.withAlpha(0.5),
    strokeWidth: 1,
  },
  green: {
    fill: new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('rgb(10, 43, 49)').withAlpha(0.7)
    ),
  },
  buildings: {
    fill: new Cesium.ColorMaterialProperty(Cesium.Color.GRAY.withAlpha(0.6)),
    extrudedHeight: 20,
  },
  roads: {
    stroke: new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('rgb(62, 64, 74)')
    ),
    strokeWidth: 3,
  },
}

// Watch for layer visibility changes
watchEffect(() => {
  if (!viewer) return
  for (const key in dataSources) {
    const typedKey = key as keyof typeof dataSources
    const dataSource = dataSources[typedKey]
    const layerProp = props.layers[typedKey as keyof MapLayers]
    if (layerProp !== undefined) {
      dataSource.show = layerProp
    }
  }
})

watch(
  () => props.selectedId,
  () => {
    if (!viewer) return

    // Restore previous highlight
    if (highlightedEntity && highlightedOriginal) {
      if (highlightedEntity.polygon && highlightedOriginal.polygonMaterial) {
        highlightedEntity.polygon.material = highlightedOriginal.polygonMaterial
      }
      if (highlightedEntity.polyline) {
        if (highlightedOriginal.polylineMaterial) {
          highlightedEntity.polyline.material = highlightedOriginal.polylineMaterial
        }
        if (typeof highlightedOriginal.polylineWidth === 'number') {
          highlightedEntity.polyline.width = new Cesium.ConstantProperty(
            highlightedOriginal.polylineWidth
          )
        }
      }
    }

    highlightedEntity = null
    highlightedOriginal = null

    if (!props.selectedId) return

    // Find entity across all datasources
    let target: Cesium.Entity | null = null
    for (const ds of Object.values(dataSources)) {
      const e = ds.entities.getById(props.selectedId)
      if (e) {
        target = e
        break
      }
    }

    if (!target) return

    highlightedEntity = target
    highlightedOriginal = {
      polygonMaterial: target.polygon?.material,
      polylineMaterial: target.polyline?.material,
      polylineWidth: target.polyline?.width?.getValue(viewer.clock.currentTime),
    }

    const highlightColor = new Cesium.ColorMaterialProperty(
      Cesium.Color.YELLOW.withAlpha(0.9)
    )

    if (target.polygon) {
      target.polygon.material = highlightColor
      target.polygon.outline = new Cesium.ConstantProperty(true)
      target.polygon.outlineColor = new Cesium.ConstantProperty(
        Cesium.Color.YELLOW.withAlpha(0.9)
      )
    }

    if (target.polyline) {
      target.polyline.material = highlightColor
      target.polyline.width = new Cesium.ConstantProperty(6)
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (!cesiumContainerRef.value) return

  viewer = new Cesium.Viewer(cesiumContainerRef.value, {
    creditContainer: document.createElement('div'),
    creditViewport: document.createElement('div'),
    // Using a darker base map to match the React example's mood
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: ['a', 'b', 'c', 'd'],
      })
    ),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
  })

  viewer.scene.globe.depthTestAgainstTerrain = true

  // Remove GeoJSON default labels/billboards (often show as blue markers)
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false

  // Set default camera
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(DEFAULT_CAMERA.heading),
      pitch: Cesium.Math.toRadians(DEFAULT_CAMERA.pitch),
      roll: 0.0,
    },
  })

  // Add all data sources to the viewer
  Object.values(dataSources).forEach(ds => viewer?.dataSources.add(ds))

  // Load and process the main GeoJSON
  loadAndProcessGeoJson()

  // Setup click handler for selection
  setupClickHandler()
  
  // Setup viewport sync
  setupViewportSync()
})

function setupClickHandler() {
  if (!viewer) return
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const pickedObject = viewer?.scene.pick(movement.position)
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      const entity = pickedObject.id
      emit('select', {
        id: entity.id,
        type: 'geojson',
        properties: viewer
          ? entity.properties?.getValue(viewer.clock.currentTime)
          : undefined,
      } as any)
    } else {
      emit('select', null)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function setupViewportSync() {
  if (!viewer) return

  // 1) Emit viewport on camera move
  const emitViewport = () => {
    if (!viewer) return
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
    emit('update:viewport', {
      x: Cesium.Math.toDegrees(carto.longitude),
      y: Cesium.Math.toDegrees(carto.latitude),
      scale: carto.height,
    })
  }

  // Throttle via RAF to avoid spamming updates
  let raf = 0
  const onChange = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      emitViewport()
    })
  }

  viewer.camera.changed.addEventListener(onChange)

  onBeforeUnmount(() => {
    viewer?.camera.changed.removeEventListener(onChange)
    if (raf) cancelAnimationFrame(raf)
  })

  // 2) Apply viewport from props
  watch(
    () => props.viewport,
    (vp) => {
      if (!viewer) return
      // Avoid hard loops by only flying if there's a meaningful change
      const current = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
      const lon = Cesium.Math.toDegrees(current.longitude)
      const lat = Cesium.Math.toDegrees(current.latitude)
      const h = current.height

      const eps = 1e-6
      const same =
        Math.abs(lon - vp.x) < eps &&
        Math.abs(lat - vp.y) < eps &&
        Math.abs(h - vp.scale) < 0.5

      if (same) return

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(vp.x, vp.y, vp.scale),
        duration: 0.6,
      })
    },
    { deep: true, immediate: true }
  )
}

function loadAndProcessGeoJson() {
  const geoJsonUrl = '/map/map_all.geojson?url=' + Date.now()
  Cesium.GeoJsonDataSource.load(geoJsonUrl, { clampToGround: true })
    .then(fullDataSource => {
      if (!viewer) return

      const entities = fullDataSource.entities.values
      for (const entity of entities) {
        // Remove any auto-generated labels/markers/points from GeoJSON features
        entity.label = undefined
        entity.billboard = undefined
        entity.point = undefined
        entity.description = undefined

        const props = entity.properties?.getValue(viewer.clock.currentTime)

        if (props.natural === 'water' || props.water) {
          styleWaterEntity(entity)
          dataSources.water.entities.add(entity)
        } else if (props.natural === 'wood' || props.landuse === 'cemetery' || props.natural === 'wetland') {
          styleGreenEntity(entity)
          dataSources.green.entities.add(entity)
        } else if (props.building) {
          styleBuildingEntity(entity)
          dataSources.buildings.entities.add(entity)
        } else if (props.highway) {
          styleRoadEntity(entity)
          dataSources.roads.entities.add(entity)
        }
      }

      // Keep camera fixed to DEFAULT_CAMERA; do not auto flyTo loaded data
      // viewer.flyTo(Object.values(dataSources).flatMap(ds => ds.entities.values), { duration: 1.5 })
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error('Failed to load main geojson:', geoJsonUrl, err)
    })
}

function styleWaterEntity(entity: Cesium.Entity) {
  if (entity.polygon) {
    entity.polygon.material = styles.water.fill
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(styles.water.stroke)
  }
}

function styleGreenEntity(entity: Cesium.Entity) {
  if (entity.polygon) {
    entity.polygon.material = styles.green.fill
    entity.polygon.outline = new Cesium.ConstantProperty(false)
  }
}

function styleBuildingEntity(entity: Cesium.Entity) {
  if (entity.polygon) {
    entity.polygon.material = styles.buildings.fill
    entity.polygon.extrudedHeight = new Cesium.ConstantProperty(styles.buildings.extrudedHeight)
    entity.polygon.heightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.CLAMP_TO_GROUND
    )
    entity.polygon.extrudedHeightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.RELATIVE_TO_GROUND
    )
  }
}

function styleRoadEntity(entity: Cesium.Entity) {
  if (entity.polyline) {
    entity.polyline.material = styles.roads.stroke
    entity.polyline.width = new Cesium.ConstantProperty(styles.roads.strokeWidth)
    entity.polyline.clampToGround = new Cesium.ConstantProperty(true)
  }
}

watch(
  () => props.weatherMode,
  (enabled) => {
    if (!viewer) return

    // A simple "weather" mood: darker atmosphere + fog. (Cesium doesn't ship a full weather system.)
    viewer.scene.fog.enabled = enabled
    viewer.scene.fog.density = enabled ? 0.00015 : 0.0
    viewer.scene.fog.minimumBrightness = enabled ? 0.15 : 0.5

    // Night-ish lighting mood
    viewer.scene.globe.enableLighting = enabled
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true
    }
    if (viewer.scene.skyBox) {
      viewer.scene.skyBox.show = true
    }

    // Dim the base imagery a bit to match the React demo look
    const layer = viewer.imageryLayers.get(0)
    if (layer) {
      layer.brightness = enabled ? 0.6 : 1.0
      layer.contrast = enabled ? 1.2 : 1.0
      layer.saturation = enabled ? 0.8 : 1.0
    }

    // Set a fixed "time" similar to the React demo's clock setting
    if (enabled) {
      const now = Cesium.JulianDate.now()
      // 14:30 local-ish as a stable preview time
      const base = Cesium.JulianDate.toDate(now)
      base.setHours(14, 30, 0, 0)
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(base)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (handler) {
    handler.destroy()
    handler = null
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>
