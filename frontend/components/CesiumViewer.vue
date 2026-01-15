<!--
  @file CesiumViewer.vue
  @description Cesium 3D 地图查看器组件
  主要功能：
  - 显示 3D 建筑模型
  - 支持地下视角切换
  - 点击建筑显示中文信息
  - 响应图层控制
-->

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue'
import { useMapState } from '../composables/useMapState'
import { usePipeDrawing } from '../composables/usePipeDrawing'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import {
  DEFAULT_CAMERA,
  UNDERGROUND_CAMERA,
  createViewer,
  addOsmImagery,
  setupUndergroundView,
  setDefaultCamera,
  flyToPosition,
  loadBuildings,
  setupPicker,
  loadAllModels,
  setModelsVisibility,
  initPipeRenderer,
  renderPipes,
  setPipesVisibility,
  type PropertyInfo
} from '../utils/cesium'

// ==================== 状态管理 ====================

const { 
  layers, 
  showBuildingInfo, 
  closeBuildingPopup,
  isEditorMode,
  pipes
} = useMapState()

const {
  initDrawingTool,
  destroyDrawingTool
} = usePipeDrawing()

// ==================== 响应式状态 ====================

const viewerEl = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer | undefined
let buildingDataSource: Cesium.DataSource | undefined
let modelEntities: Cesium.Entity[] = []
const isUnderground = ref(false)

// ==================== 配置获取 ====================

const config = useRuntimeConfig()

// ==================== 图层控制 ====================

// 监听建筑图层变化
watch(() => layers.value.buildings, (visible) => {
  if (buildingDataSource) {
    buildingDataSource.show = visible
  }
  // 模型跟随建筑图层显示/隐藏
  setModelsVisibility(modelEntities, visible)
})

// 监听管道图层变化
watch(() => layers.value.pipes, (visible) => {
  setPipesVisibility(visible)
})

watch(() => layers.value.waterSupply, (visible) => {
  setPipesVisibility(visible, 'water')
})

watch(() => layers.value.pressure, (visible) => {
  setPipesVisibility(visible, 'sewage')
})

watch(() => layers.value.power, (visible) => {
  setPipesVisibility(visible, 'drainage')
})

// 监听管道数据变化，重新渲染
watch(() => pipes.value, (newPipes) => {
  if (viewer) {
    renderPipes([...newPipes])
  }
}, { deep: true })

// 监听编辑模式变化，切换2D/3D视角
watch(() => isEditorMode.value, (editing) => {
  if (!viewer) return
  
  if (editing) {
    // 切换到2D俯视视角，使用 UNDERGROUND_CAMERA 配置
    flyToPosition(
      viewer,
      UNDERGROUND_CAMERA.longitude,
      UNDERGROUND_CAMERA.latitude,
      UNDERGROUND_CAMERA.height,
      UNDERGROUND_CAMERA.heading,
      UNDERGROUND_CAMERA.pitch,
      1.5
    )
  } else {
    // 恢复默认3D视角
    flyToPosition(
      viewer,
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height,
      DEFAULT_CAMERA.heading,
      DEFAULT_CAMERA.pitch,
      1.5
    )
  }
})

// ==================== 事件处理函数 ====================

const toggleUnderground = () => {
  if (!viewer) return

  isUnderground.value = !isUnderground.value

  const cameraPosition = isUnderground.value ? UNDERGROUND_CAMERA : DEFAULT_CAMERA
  flyToPosition(
    viewer,
    cameraPosition.longitude,
    cameraPosition.latitude,
    cameraPosition.height,
    cameraPosition.heading,
    cameraPosition.pitch
  )
}

// ==================== 生命周期钩子 ====================

onMounted(async () => {
  if (!viewerEl.value) return
  
  await nextTick()

  viewer = createViewer({
    container: viewerEl.value,
    token: config.public.cesiumToken as string
  })

  addOsmImagery(viewer)
  setupUndergroundView(viewer)

  // 设置点击拾取事件，传递屏幕坐标
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    if (!viewer) return
    
    const pickedObject = viewer.scene.pick(click.position)
    
    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id as Cesium.Entity
      const properties = entity.properties
      
      if (properties) {
        const infoList = extractProperties(properties)
        if (infoList.length > 0) {
          // 传递点击位置给弹窗
          showBuildingInfo(infoList, {
            x: click.position.x,
            y: click.position.y
          })
          return
        }
      }
    }
    
    closeBuildingPopup()
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  viewer.resize()
  setDefaultCamera(viewer)

  try {
    buildingDataSource = await loadBuildings(viewer, '/map/map.geojson')
    // 根据初始图层状态设置显示
    buildingDataSource.show = layers.value.buildings
  } catch (e) {
    console.error('加载建筑数据失败', e)
  }

  try {
    modelEntities = loadAllModels(viewer)
    setModelsVisibility(modelEntities, layers.value.buildings)
  } catch (e) {
    console.error('加载 3D 模型失败', e)
  }

  // 初始化管道渲染器
  initPipeRenderer(viewer)
  
  // 初始化绘制工具
  initDrawingTool(viewer)
  
  // 渲染初始管道数据
  renderPipes([...pipes.value])
})

onBeforeUnmount(() => {
  destroyDrawingTool()
  viewer?.destroy()
})

// ==================== 辅助函数 ====================

function extractProperties(properties: Cesium.PropertyBag): PropertyInfo[] {
  const infoList: PropertyInfo[] = []
  const propertyNames = properties.propertyNames
  
  // 属性翻译映射
  const labelMap: Record<string, string> = {
    'name': '名称',
    'name:zh': '中文名',
    'building': '建筑类型',
    'building:levels': '楼层数',
    'amenity': '设施类型',
    'addr:street': '街道',
    'addr:housenumber': '门牌号'
  }
  
  const valueMap: Record<string, Record<string, string>> = {
    'building': {
      'dormitory': '宿舍楼',
      'university': '教学楼',
      'school': '学校建筑',
      'restaurant': '餐厅',
      'warehouse': '仓库',
      'yes': '普通建筑'
    }
  }
  
  for (const propName of propertyNames) {
    let value = properties[propName]?.getValue()
    if (value === undefined || value === null || value === '') continue
    
    // 翻译值
    if (valueMap[propName] && valueMap[propName][String(value)]) {
      value = valueMap[propName][String(value)]
    }
    
    // 翻译标签
    const label = labelMap[propName] || propName
    
    infoList.push({ label, value: String(value) })
  }
  
  return infoList
}
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

.cesium-viewer,
.cesium-viewer-cesiumWidgetContainer,
.cesium-widget,
.cesium-widget canvas {
  width: 100% !important;
  height: 100% !important;
}

.cesium-viewer-bottom {
  display: none !important;
}
</style>
