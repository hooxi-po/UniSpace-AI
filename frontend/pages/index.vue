<template>
  <div class="relative w-screen h-screen bg-tech-bg text-white overflow-hidden font-sans select-none">
    <!-- 1. Background / 3D Map Layer -->
    <MapView 
      :selected-id="selectedItem?.id ? String(selectedItem.id) : null"
      :viewport="viewport"
      :layers="layers"
      :weather-mode="weatherMode"
      @select="handleSelection"
      @update:viewport="viewport = $event"
    />

    <!-- 2. UI Overlay Layer -->
    <div class="absolute inset-0 pointer-events-none z-10">
      <!-- Header -->
      <TopNav />

      <!-- Left Panel: Data & Alerts -->
      <SidebarLeft />
      
      <!-- Map Controls (Bottom Center) -->
      <MapControls 
        :scale="viewport.scale"
        :layers="layers"
        :weather-mode="weatherMode"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @reset="resetView"
        @toggle-layer="toggleLayer"
        @toggle-weather="weatherMode = !weatherMode"
      />

      <!-- Right Panel: Detailed Asset Management -->
      <RightSidebar 
        :data="isAssetItem(selectedItem) ? selectedItem : null" 
        @close="selectedItem = null" 
      />

      <!-- AI Chat (Floating) -->
      <div class="pointer-events-auto">
        <ChatInterface />
      </div>
    </div>

    <!-- 3. Vignette Overlay for cinematic feel -->
    <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,11,26,0.45)_100%)] z-20" />
    
    <!-- 4. Scanline effect -->
    <div class="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.08)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.008),rgba(0,0,255,0.02))] z-30 bg-[length:100%_2px,3px_100%] opacity-15" />
  </div>
</template>

<script setup lang="ts">
import type { PipeNode, Building, GeoJsonFeature } from '~/types'
import { BUILDINGS, PIPELINES } from '~/composables/useConstants'

const selectedItem = ref<PipeNode | Building | GeoJsonFeature | null>(null)

// Map Viewport State
const viewport = ref({ x: 119.1895, y: 26.0254, scale: 500 })

// Layer State
const layers = ref({
  water: true,
  sewage: true,
  drain: true,
  buildings: true,
  green: true,
})

// Weather State
const weatherMode = ref(false)

/**
 * 处理地图选择事件
 * 将 GeoJSON 特征转换为对应的资产对象（Building 或 PipeNode）
 * @param item - 选中的项（可能是 GeoJSON 特征、Building 或 PipeNode）
 */
const handleSelection = (item: PipeNode | Building | GeoJsonFeature | null) => {
  if (!item) {
    selectedItem.value = null
    return
  }

  // 如果已经是 Building 或 PipeNode，直接使用
  if ('name' in item || 'diameter' in item) {
    selectedItem.value = item
    return
  }

  // 如果是 GeoJSON 特征，需要查找对应的资产数据
  if ('type' in item && item.type === 'geojson') {
    const feature = item as GeoJsonFeature
    const properties = feature.properties || {}
    const featureId = String(feature.id)
    
    // 检查是否是建筑（通过 properties.building 判断）
    if (properties.building) {
      // 尝试精确匹配 id
      let building = BUILDINGS.find(b => featureId === b.id || featureId.includes(b.id))
      
      // 如果找不到，尝试根据 properties 中的 name 匹配
      if (!building && properties.name) {
        const name = String(properties.name)
        building = BUILDINGS.find(b => name.includes(b.name) || b.name.includes(name))
      }
      
      // 如果还是找不到，从 GeoJSON properties 动态创建 Building 对象
      if (!building) {
        const buildingName = properties.name 
          ? String(properties.name) 
          : properties.short_name
          ? String(properties.short_name)
          : `建筑 ${featureId}`
        
        // 根据 building 类型映射到 Building.type
        const buildingType = String(properties.building || '').toLowerCase()
        let mappedType: Building['type'] = 'admin'
        if (buildingType.includes('dorm') || buildingType.includes('dormitory')) {
          mappedType = 'dorm'
        } else if (buildingType.includes('lab') || buildingType.includes('laboratory')) {
          mappedType = 'lab'
        } else if (buildingType.includes('canteen') || buildingType.includes('restaurant') || properties.amenity === 'restaurant') {
          mappedType = 'canteen'
        } else if (buildingType.includes('school') || buildingType.includes('university')) {
          mappedType = 'admin'
        }
        
        // 估算房间数：如果有楼层信息，每层估算 20-30 个房间
        let estimatedRooms = 0
        if (properties['building:levels']) {
          const levels = parseInt(String(properties['building:levels']), 10)
          if (!isNaN(levels)) {
            estimatedRooms = levels * 25 // 每层估算 25 个房间
          }
        }
        
        // 创建动态 Building 对象
        building = {
          id: featureId,
          name: buildingName,
          type: mappedType,
          status: 'normal',
          coordinates: { x: 0, y: 0 }, // GeoJSON 坐标需要从 geometry 中提取，这里暂时使用默认值
          connectedPipeId: 'P-UNKNOWN',
          rooms: estimatedRooms,
          keyEquipment: [],
          powerConsumption: 0
        }
      }
      
      if (building) {
        selectedItem.value = building
        return
      }
    }
    
    // 检查是否是管道（由道路数据分类生成：pipeType=water|drain|sewage）
    const pipeType = String(properties.pipeType || '').toLowerCase()
    if (pipeType === 'water' || pipeType === 'drain' || pipeType === 'sewage' || properties.highway) {
      // 优先按管道类型匹配 Mock 管线
      let pipeline = PIPELINES.find(p => p.type === pipeType)

      // 兼容兜底：尝试按 id 匹配
      if (!pipeline) {
        pipeline = PIPELINES.find(p => featureId === p.id || featureId.includes(p.id))
      }

      // 最后兜底：选第一条
      if (!pipeline && PIPELINES.length > 0) {
        pipeline = PIPELINES[0]
      }

      if (pipeline) {
        selectedItem.value = {
          ...pipeline,
          id: featureId,
          type: (pipeType === 'water' || pipeType === 'drain' || pipeType === 'sewage')
            ? pipeType
            : pipeline.type,
        }
        return
      }
    }
    
    // 如果找不到对应的资产，保留 GeoJSON 特征（不显示右侧弹窗）
    selectedItem.value = feature
  } else {
    selectedItem.value = item
  }
}

/**
 * 类型守卫：判断选中的项是否为管道或建筑（而非 GeoJSON 特征）
 * @param item - 选中的项
 * @returns 是否为管道或建筑
 */
const isAssetItem = (item: PipeNode | Building | GeoJsonFeature | null): item is PipeNode | Building => {
  if (!item) return false
  return 'name' in item || 'diameter' in item
}

const toggleLayer = (layer: keyof typeof layers.value) => {
  layers.value[layer] = !layers.value[layer]
}

const handleZoomIn = () => {
  viewport.value = { ...viewport.value, scale: Math.min(viewport.value.scale + 0.2, 4) }
}

const handleZoomOut = () => {
  viewport.value = { ...viewport.value, scale: Math.max(viewport.value.scale - 0.2, 0.5) }
}

const resetView = () => {
  viewport.value = { x: 0, y: 0, scale: 1 }
}
</script>
