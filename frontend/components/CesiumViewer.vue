<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
// @ts-ignore - cesium types may not be installed yet
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const viewerEl = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer | undefined

onMounted(async () => {
  if (!viewerEl.value) return
  
  // 等待 DOM 完全渲染后再初始化 Cesium
  await nextTick()
  
  viewer = new Cesium.Viewer(viewerEl.value, {
    imageryProvider: new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    }),
    baseLayerPicker: false,
    timeline: false,
    animation: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
  })

  // 强制 resize 以适应容器
  viewer.resize()

  try {
    const dataSource = await Cesium.GeoJsonDataSource.load('/map/map.geojson', {
      clampToGround: true
    })
    viewer.dataSources.add(dataSource)
    viewer.flyTo(dataSource)
  } catch (e) {
    console.error('Failed to load GeoJSON', e)
  }
})

onBeforeUnmount(() => {
  viewer?.destroy()
})
</script>

<template>
  <div ref="viewerEl" class="cesium-container"></div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.cesium-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

.cesium-viewer {
  width: 100% !important;
  height: 100% !important;
}

.cesium-viewer-cesiumWidgetContainer {
  width: 100% !important;
  height: 100% !important;
}

.cesium-widget {
  width: 100% !important;
  height: 100% !important;
}

.cesium-widget canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>

