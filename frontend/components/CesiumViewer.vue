<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
// @ts-ignore - cesium types may not be installed yet
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const viewerEl = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer | undefined

// 获取 Cesium Ion Token
const config = useRuntimeConfig()

onMounted(async () => {
  if (!viewerEl.value) return
  
  await nextTick()

  // 设置 Cesium Ion Token
  Cesium.Ion.defaultAccessToken = config.public.cesiumToken as string
  
  viewer = new Cesium.Viewer(viewerEl.value, {
    imageryProvider: new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    }),
    // 添加 Cesium World Terrain 地形数据
    terrain: Cesium.Terrain.fromWorldTerrain(),
    baseLayerPicker: false,
    timeline: false,
    animation: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
  })

  // 添加 Cesium OSM 3D 建筑
  try {
    const osmBuildings = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(osmBuildings)
  } catch (e) {
    console.error('Failed to load OSM Buildings', e)
  }

  // 启用深度检测
  viewer.scene.globe.depthTestAgainstTerrain = true

  viewer.resize()

  // 设置 3D 视角（倾斜观看建筑）
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      119.1935,  // 经度
      26.0253,   // 纬度
      800        // 高度（米）- 降低高度看清建筑
    ),
    orientation: {
      heading: Cesium.Math.toRadians(30),   // 稍微偏转
      pitch: Cesium.Math.toRadians(-35),    // 倾斜看
      roll: 0
    }
  })

  try {
    const dataSource = await Cesium.GeoJsonDataSource.load('/map/map.geojson', {
      clampToGround: true
    })
    viewer.dataSources.add(dataSource)
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

