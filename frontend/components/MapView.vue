<template>
  <div ref="cesiumContainerRef" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import type { PipeNode, Building } from '~/types'

type SelectItem = PipeNode | Building | null

interface Props {
  selectedId: string | null
  viewport: { x: number; y: number; scale: number }
  layers: {
    water: boolean
    sewage: boolean
    drain: boolean
    buildings: boolean
  }
  weatherMode: boolean
}

defineProps<Props>()

defineEmits<{
  select: [item: SelectItem]
  'update:viewport': [value: { x: number; y: number; scale: number }]
}>()

const cesiumContainerRef = ref<HTMLDivElement | null>(null)
let viewer: Cesium.Viewer | null = null

onMounted(() => {
  if (!cesiumContainerRef.value) return

  viewer = new Cesium.Viewer(cesiumContainerRef.value, {
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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

  // Load and render GeoJSON boundary/area
  const geoJsonUrl = '/map/map.geojson?url=' + Date.now()
  // eslint-disable-next-line no-console
  console.log('Attempting to load GeoJSON from:', geoJsonUrl)

  Cesium.GeoJsonDataSource.load(geoJsonUrl, {
    clampToGround: true,
  })
    .then((dataSource) => {
      // eslint-disable-next-line no-console
      console.log('GeoJSON loaded successfully.', dataSource)
      viewer?.dataSources.add(dataSource)
      // eslint-disable-next-line no-console
      console.log('DataSource added to viewer.')

      // Basic styling (works for Polygon/Polyline; points ignored here)
      for (const entity of dataSource.entities.values) {
        if (entity.polygon) {
          entity.polygon.material = new Cesium.ColorMaterialProperty(
            Cesium.Color.CYAN.withAlpha(0.25)
          )
          entity.polygon.outline = new Cesium.ConstantProperty(true)
          entity.polygon.outlineColor = new Cesium.ConstantProperty(Cesium.Color.CYAN)
        }
        if (entity.polyline) {
          entity.polyline.width = new Cesium.ConstantProperty(3)
          entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.CYAN)
          entity.polyline.clampToGround = new Cesium.ConstantProperty(true)
        }
      }

      // Fly camera to geojson extent
      if (viewer && dataSource.entities.values.length > 0) {
        // eslint-disable-next-line no-console
        console.log('Attempting to flyTo DataSource extent.')
        viewer.flyTo(dataSource, {
          duration: 1.2,
        }).then(() => {
          // eslint-disable-next-line no-console
          console.log('flyTo completed.')
        })
      } else {
        // eslint-disable-next-line no-console
        console.warn('Viewer not available or DataSource is empty, skipping flyTo.')
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load geojson:', geoJsonUrl, err)
    })
})

onBeforeUnmount(() => {
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>
