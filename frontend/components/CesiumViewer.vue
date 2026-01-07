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
    // 使用 Cesium Ion 默认影像（Bing Maps）
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
      clampToGround: false  // 不贴地，用于 3D 拉伸
    })
    
    // 遍历所有实体，将建筑拉伸成 3D
    const entities = dataSource.entities.values
    for (const entity of entities) {
      const properties = entity.properties
      
      // 隐藏所有标签
      if (entity.label) {
        entity.label.show = false
      }
      // 隐藏点标记
      if (entity.billboard) {
        entity.billboard.show = false
      }
      if (entity.point) {
        entity.point.show = false
      }
      
      // 检查是否是建筑
      if (properties && properties.building) {
        const buildingType = properties.building.getValue()
        if (buildingType) {
          // 获取楼层数，默认 3 层
          let levels = 3
          if (properties['building:levels']) {
            levels = parseInt(properties['building:levels'].getValue()) || 3
          }
          
          // 每层约 3 米，计算建筑高度
          const height = levels * 20
          
          // 设置拉伸高度
          if (entity.polygon) {
            entity.polygon.extrudedHeight = height
            entity.polygon.height = 0
            entity.polygon.material = Cesium.Color.fromCssColorString('#8B9DC3').withAlpha(0.9)
            entity.polygon.outline = true
            entity.polygon.outlineColor = Cesium.Color.BLACK
          }
        }
      }
    }
    
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

