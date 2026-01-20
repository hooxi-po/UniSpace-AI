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

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(119.1895, 26.0254, 500),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
  })
})

onBeforeUnmount(() => {
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>
