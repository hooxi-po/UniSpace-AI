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
import { usePipeEditorState } from '../composables/usePipeEditorState'
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
  setBuildingsVisibility,
  loadAllModels,
  setModelsVisibility,
  initPipeRenderer,
  renderPipes,
  setPipesVisibility,
  highlightPipe,
  flyToPipe,
  loadRoadsAsPipes,
  type PropertyInfo
} from '../utils/cesium'

// ==================== 状态管理 ====================

const { 
  layers, 
  showBuildingInfo, 
  closeBuildingPopup,
  pipes,
  upsertPipes
} = useMapState()

const {
  pipeEditorMode,
  addDrawingPoint,
  finishPipeDrawing,
  highlightedPipeId,
  highlightPipeById
} = usePipeEditorState()

// ==================== 响应式状态 ====================

const viewerEl = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer | undefined
let buildingsTileset: Cesium.Cesium3DTileset | undefined
let modelEntities: Cesium.Entity[] = []
const isUnderground = ref(false)

// 绘制模式状态
const isDrawingMode = ref(false)
const drawingPoints = ref<number[][]>([])
let drawingEntities: Cesium.Entity[] = []
let drawingHandler: Cesium.ScreenSpaceEventHandler | null = null
let clickHandler: Cesium.ScreenSpaceEventHandler | null = null

// ==================== 配置获取 ====================

const config = useRuntimeConfig()

// ==================== 图层控制 ====================

// 监听建筑图层变化
watch(() => layers.value.buildings, (visible) => {
  setBuildingsVisibility(visible)
  // 模型跟随建筑图层显示/隐藏
  setModelsVisibility(modelEntities, visible)
})

// 监听管道图层变化
watch(() => layers.value.pipes, (visible) => {
  // Master switch controls all sub-layers
  setPipesVisibility(visible && layers.value.water, 'water')
  setPipesVisibility(visible && layers.value.sewage, 'sewage')
  setPipesVisibility(visible && layers.value.drainage, 'drainage')
})

watch(() => layers.value.water, (visible) => {
  setPipesVisibility(layers.value.pipes && visible, 'water')
})

watch(() => layers.value.sewage, (visible) => {
  setPipesVisibility(layers.value.pipes && visible, 'sewage')
})

watch(() => layers.value.drainage, (visible) => {
  setPipesVisibility(layers.value.pipes && visible, 'drainage')
})

// 监听管道数据变化（节流到每帧最多一次全量重绘）
let renderPipesRafId: number | null = null
let pendingPipesSnapshot: typeof pipes.value | null = null

watch(() => pipes.value, (newPipes) => {
  if (!viewer) return

  pendingPipesSnapshot = newPipes

  if (renderPipesRafId !== null) return

  renderPipesRafId = requestAnimationFrame(() => {
    renderPipesRafId = null
    if (!pendingPipesSnapshot) return

    renderPipes([...pendingPipesSnapshot])
    pendingPipesSnapshot = null
  })
}, { deep: true })

// 监听绘制模式变化
watch(() => pipeEditorMode.value, (mode) => {
  if (mode !== 'drawing') {
    stopDrawingMode()
    return
  }

  startDrawingMode()
})

// 监听管道高亮变化
watch(() => highlightedPipeId.value, (pipeId) => {
  highlightPipeById(pipeId)
  if (!pipeId) return

  highlightPipe(pipeId)
  flyToPipe(pipeId)
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

// ==================== 管道绘制功能 ====================

// 开始绘制模式
const startDrawingMode = () => {
  if (!viewer) return
  
  isDrawingMode.value = true
  drawingPoints.value = []
  clearDrawingEntities()
  
  // 创建绘制事件处理器
  drawingHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  
  // 左键点击添加点
  drawingHandler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    if (!viewer) return
    
    const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid)
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      const lon = Cesium.Math.toDegrees(cartographic.longitude)
      const lat = Cesium.Math.toDegrees(cartographic.latitude)
      
      drawingPoints.value.push([lon, lat])
      addDrawingPointEntity(lon, lat)

      // 同步到全局状态，供编辑器表单使用
      addDrawingPoint(lon, lat)
      
      // 更新线
      updateDrawingLine()
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // 双击完成绘制
  drawingHandler.setInputAction(() => {
    if (drawingPoints.value.length >= 2) {
      finishDrawing()
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  
  // 右键取消
  drawingHandler.setInputAction(() => {
    stopDrawingMode()
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

// 添加绘制点标记
const addDrawingPointEntity = (lon: number, lat: number) => {
  if (!viewer) return
  
  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    point: {
      pixelSize: 10,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  })
  drawingEntities.push(entity)
}

// 更新绘制线
const updateDrawingLine = () => {
  if (!viewer || drawingPoints.value.length < 2) return
  
  // 移除旧的线实体
  const lineEntity = drawingEntities.find(e => e.id?.startsWith('drawing_line'))
  if (lineEntity) {
    viewer.entities.remove(lineEntity)
    drawingEntities = drawingEntities.filter(e => e !== lineEntity)
  }
  
  // 创建新的线
  const positions = drawingPoints.value.map(([lon, lat]) => 
    Cesium.Cartesian3.fromDegrees(lon, lat)
  )
  
  const entity = viewer.entities.add({
    id: `drawing_line_${Date.now()}`,
    polyline: {
      positions: positions,
      width: 4,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.CYAN,
        dashLength: 16
      }),
      clampToGround: true
    }
  })
  drawingEntities.push(entity)
}

// 完成绘制
const finishDrawing = () => {
  finishPipeDrawing()
  stopDrawingMode()
}

// 停止绘制模式
const stopDrawingMode = () => {
  isDrawingMode.value = false
  
  if (drawingHandler) {
    drawingHandler.destroy()
    drawingHandler = null
  }
  
  clearDrawingEntities()
}

// 清除绘制实体
const clearDrawingEntities = () => {
  if (!viewer) return
  
  for (const entity of drawingEntities) {
    viewer.entities.remove(entity)
  }
  drawingEntities = []
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

  // 设置点击拾取事件
  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  
  clickHandler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    if (!viewer) return
    
    // 绘制模式下不处理点击
    if (isDrawingMode.value) return
    
    const pickedObject = viewer.scene.pick(click.position)
    
    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id as Cesium.Entity
      const properties = entity.properties
      
      if (properties) {
        const infoList = extractProperties(properties)
        if (infoList.length > 0) {
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

  // 加载建筑
  try {
    buildingsTileset = await loadBuildings(viewer)
    setBuildingsVisibility(layers.value.buildings)
  } catch (e) {
    console.error('加载建筑失败', e)
  }

  setDefaultCamera(viewer)

  try {
    modelEntities = loadAllModels(viewer)
    setModelsVisibility(modelEntities, layers.value.buildings)
  } catch (e) {
    console.error('加载 3D 模型失败', e)
  }

  // 初始化管道渲染器
  initPipeRenderer(viewer)
  
  // 从 GeoJSON 道路数据加载管道
  try {
    const roadPipes = await loadRoadsAsPipes('/map/map.geojson')
    if (roadPipes.length > 0) {
      upsertPipes(roadPipes)
      console.log(`已加载 ${roadPipes.length} 条道路管道数据`)
    }
  } catch (e) {
    console.error('加载道路管道数据失败', e)
  }
  
  // 渲染管道数据
  renderPipes([...pipes.value])
  
  // 绘制/高亮由全局状态驱动（useMapState），不再使用 window 事件总线
})

onBeforeUnmount(() => {
  if (drawingHandler) {
    drawingHandler.destroy()
    drawingHandler = null
  }

  if (clickHandler) {
    clickHandler.destroy()
    clickHandler = null
  }
  
  viewer?.destroy()
  viewer = undefined
})

// ==================== 辅助函数 ====================

function extractProperties(properties: Cesium.PropertyBag): PropertyInfo[] {
  const infoList: PropertyInfo[] = []
  const propertyNames = properties.propertyNames
  
  const labelMap: Record<string, string> = {
    'name': '名称',
    'name:zh': '中文名',
    'building': '建筑类型',
    'building:levels': '楼层数',
    'amenity': '设施类型',
    'addr:street': '街道',
    'addr:housenumber': '门牌号',
    // 管道属性
    'typeName': '管道类型',
    'diameter': '管径(mm)',
    'material': '材质',
    'length': '长度(m)',
    'depth': '埋深(m)',
    'pressure': '压力(MPa)',
    'slope': '坡度(%)',
    'installDate': '安装日期',
    'status': '状态'
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
    
    if (valueMap[propName] && valueMap[propName][String(value)]) {
      value = valueMap[propName][String(value)]
    }
    
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
