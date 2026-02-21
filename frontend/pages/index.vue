<template>
  <div class="relative w-screen h-screen bg-tech-bg text-white overflow-hidden font-sans select-none">
    <!-- 1. Background / 3D Map Layer -->
    <MapView 
      :selected-id="selectedItem?.id ? String(selectedItem.id) : null"
      :viewport="viewport"
      :layers="layers"
      :backend-base-url="backendBaseUrl"
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
import { BUILDINGS } from '~/composables/useConstants'
import { twinService } from '~/services/twin'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'
import { classifyRoadToPipeLayer } from '~/utils/pipe-classifier'

const selectedItem = ref<PipeNode | Building | GeoJsonFeature | null>(null)
const runtimeConfig = useRuntimeConfig()
const selectionToken = ref(0)

const DEFAULT_VIEWPORT = {
  x: 119.1895,
  y: 26.0254,
  scale: 500,
}
const MIN_CAMERA_HEIGHT = 80
const MAX_CAMERA_HEIGHT = 5000
const ZOOM_IN_FACTOR = 0.8
const ZOOM_OUT_FACTOR = 1.25

const backendBaseUrl = computed(() => {
  return normalizeBackendBaseUrl(runtimeConfig.public.backendBaseUrl as string | undefined)
})

// Map Viewport State
const viewport = ref({ ...DEFAULT_VIEWPORT })

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

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const next = Number.parseFloat(value)
    if (Number.isFinite(next)) return next
  }
  return null
}

function toText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizePipeType(props: Record<string, unknown>, featureId: string): PipeNode['type'] {
  const pipeType = String(props.pipeType || '').trim().toLowerCase()
  if (pipeType === 'water' || pipeType === 'drain' || pipeType === 'sewage') {
    return pipeType
  }
  return classifyRoadToPipeLayer(props, featureId)
}

function normalizePipeStatus(value: unknown): PipeNode['status'] {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'warning' || raw === 'critical') return raw
  return 'normal'
}

function normalizeDiameter(props: Record<string, unknown>) {
  const raw = toText(props.diameter) || toText(props.diameter_mm)
  if (!raw) return '未知'
  return raw.toUpperCase().startsWith('DN') ? raw.toUpperCase() : `DN${raw}`
}

async function buildPipeAsset(feature: GeoJsonFeature) {
  const featureId = String(feature.id)
  const properties = (feature.properties || {}) as Record<string, unknown>
  const [drilldownResult, telemetryResult] = await Promise.allSettled([
    twinService.drilldown(backendBaseUrl.value, featureId),
    twinService.telemetryLatest(backendBaseUrl.value, [featureId]),
  ])

  const linkedBuildingNames =
    drilldownResult.status === 'fulfilled'
      ? drilldownResult.value.linkedBuildings
          .map((item) => {
            const name = toText((item as Record<string, unknown>).name)
            if (name) return name
            return toText((item as Record<string, unknown>).id)
          })
          .filter((item): item is string => Boolean(item))
      : []

  const telemetry = telemetryResult.status === 'fulfilled' ? telemetryResult.value : []
  const pressure = telemetry.find(item => item.metric === 'pressure')?.value
    ?? toNumber(properties.pressure)
    ?? 0
  const flowRate = telemetry.find(item => item.metric === 'flow')?.value
    ?? toNumber(properties.flowRate)
    ?? toNumber(properties.flow)
    ?? 0

  const depth = toNumber(properties.depth)
    ?? toNumber(properties.depth_m)
    ?? toNumber(properties.buried_depth)
    ?? 0

  const installDate =
    toText(properties.installDate)
    || toText(properties.install_date)
    || toText(properties.start_date)
    || '未知'

  const lastMaintain =
    toText(properties.lastMaintain)
    || toText(properties.last_maintain)
    || toText(properties.maintenance_date)
    || '未知'

  return {
    id: featureId,
    type: normalizePipeType(properties, featureId),
    status: normalizePipeStatus(properties.status),
    pressure,
    flowRate,
    coordinates: [],
    diameter: normalizeDiameter(properties),
    material: toText(properties.material) || '未知',
    depth,
    installDate,
    lastMaintain,
    connectedBuildingIds: linkedBuildingNames,
  } as PipeNode
}

/**
 * 处理地图选择事件
 * 将 GeoJSON 特征转换为对应的资产对象（Building 或 PipeNode）
 * @param item - 选中的项（可能是 GeoJSON 特征、Building 或 PipeNode）
 */
const handleSelection = async (item: PipeNode | Building | GeoJsonFeature | null) => {
  const token = ++selectionToken.value
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
      try {
        const pipeAsset = await buildPipeAsset(feature)
        if (token !== selectionToken.value) return
        selectedItem.value = pipeAsset
      } catch {
        if (token !== selectionToken.value) return
        selectedItem.value = feature
      }
      return
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
  viewport.value = {
    ...viewport.value,
    scale: Math.max(MIN_CAMERA_HEIGHT, viewport.value.scale * ZOOM_IN_FACTOR),
  }
}

const handleZoomOut = () => {
  viewport.value = {
    ...viewport.value,
    scale: Math.min(MAX_CAMERA_HEIGHT, viewport.value.scale * ZOOM_OUT_FACTOR),
  }
}

const resetView = () => {
  viewport.value = { ...DEFAULT_VIEWPORT }
}
</script>
