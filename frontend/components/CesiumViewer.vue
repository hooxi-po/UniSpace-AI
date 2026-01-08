<!--
  @file CesiumViewer.vue
  @description Cesium 3D 地图查看器组件
  主要功能：
  - 显示 3D 建筑模型
  - 支持地下视角切换
  - 点击建筑显示中文信息
-->

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// 导入 Cesium 工具模块
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
  type PropertyInfo
} from '../utils/cesium'

// ==================== 响应式状态 ====================

/** Viewer 容器 DOM 引用 */
const viewerEl = ref<HTMLElement | null>(null)

/** Cesium Viewer 实例 */
let viewer: Cesium.Viewer | undefined

/** 建筑数据源，用于控制显示/隐藏 */
let buildingDataSource: Cesium.DataSource | undefined

/** 是否处于地下视角 */
const isUnderground = ref(false)

/** 是否显示建筑信息弹窗 */
const showInfo = ref(false)

/** 当前选中建筑的属性信息 */
const buildingInfo = ref<PropertyInfo[]>([])

// ==================== 配置获取 ====================

/** 获取运行时配置（包含 Cesium Token） */
const config = useRuntimeConfig()

// ==================== 事件处理函数 ====================

/**
 * 关闭建筑信息弹窗
 */
const closeInfo = () => {
  showInfo.value = false
}

/**
 * 切换 2D 俯视图/3D 视角
 * 2D 模式：垂直向下看，隐藏建筑
 * 3D 模式：倾斜视角，显示建筑
 */
const toggleUnderground = () => {
  if (!viewer) return
  
  isUnderground.value = !isUnderground.value
  
  if (isUnderground.value) {
    // 切换到 2D 俯视图
    // 隐藏 3D 建筑
    if (buildingDataSource) {
      buildingDataSource.show = false
    }
    // 飞行到垂直俯视视角
    flyToPosition(
      viewer,
      UNDERGROUND_CAMERA.longitude,
      UNDERGROUND_CAMERA.latitude,
      UNDERGROUND_CAMERA.height,
      UNDERGROUND_CAMERA.heading,
      UNDERGROUND_CAMERA.pitch
    )
  } else {
    // 切换回 3D 视角
    // 显示 3D 建筑
    if (buildingDataSource) {
      buildingDataSource.show = true
    }
    // 飞行回倾斜视角
    flyToPosition(
      viewer,
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height,
      DEFAULT_CAMERA.heading,
      DEFAULT_CAMERA.pitch
    )
  }
}

// ==================== 生命周期钩子 ====================

/**
 * 组件挂载时初始化 Cesium Viewer
 */
onMounted(async () => {
  if (!viewerEl.value) return
  
  // 等待 DOM 完全渲染
  await nextTick()

  // 创建 Viewer 实例
  viewer = createViewer({
    container: viewerEl.value,
    token: config.public.cesiumToken as string
  })

  // 添加 OpenStreetMap 底图
  addOsmImagery(viewer)

  // 配置地下视角功能
  setupUndergroundView(viewer)

  // 设置点击拾取事件
  setupPicker(viewer, (info) => {
    if (info) {
      // 显示建筑信息
      buildingInfo.value = info
      showInfo.value = true
    } else {
      // 点击空白处，关闭弹窗
      showInfo.value = false
    }
  })

  // 调整 Viewer 尺寸
  viewer.resize()

  // 设置默认相机视角
  setDefaultCamera(viewer)

  // 加载建筑数据
  try {
    buildingDataSource = await loadBuildings(viewer, '/map/map.geojson')
  } catch (e) {
    console.error('加载建筑数据失败', e)
  }
})

/**
 * 组件卸载时销毁 Viewer
 * 释放 WebGL 资源，防止内存泄漏
 */
onBeforeUnmount(() => {
  viewer?.destroy()
})
</script>

<template>
  <!-- Cesium 地图容器 -->
  <div ref="viewerEl" class="cesium-container"></div>
  
  <!-- 视角切换按钮 -->
  <button class="underground-btn" @click="toggleUnderground">
    {{ isUnderground ? '3D 视角' : '2D 俯视' }}
  </button>
  
  <!-- 建筑信息弹窗 -->
  <div v-if="showInfo" class="info-panel">
    <div class="info-header">
      <span>建筑信息</span>
      <button class="close-btn" @click="closeInfo">×</button>
    </div>
    <div class="info-content">
      <div v-for="item in buildingInfo" :key="item.label" class="info-row">
        <span class="info-label">{{ item.label }}：</span>
        <span class="info-value">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<style>
/* ==================== 全局样式重置 ==================== */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ==================== 地图容器 ==================== */
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

/* ==================== 地下视角按钮 ==================== */
.underground-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: 1px solid #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.underground-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

/* ==================== 建筑信息弹窗 ==================== */
.info-panel {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border-radius: 8px;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 弹窗标题栏 */
.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: bold;
}

/* 关闭按钮 */
.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #ff6b6b;
}

/* 弹窗内容区 */
.info-content {
  padding: 12px 16px;
  max-height: 400px;
  overflow-y: auto;
}

/* 信息行 */
.info-row {
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

/* 属性标签 */
.info-label {
  color: #aaa;
}

/* 属性值 */
.info-value {
  color: #fff;
}

/* ==================== Cesium 组件样式覆盖 ==================== */
.cesium-viewer,
.cesium-viewer-cesiumWidgetContainer,
.cesium-widget,
.cesium-widget canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>
