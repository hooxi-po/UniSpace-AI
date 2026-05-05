<template>
  <div class="relative w-screen h-screen bg-tech-bg text-white overflow-hidden font-sans select-none">
    <!-- 1. Background / 3D Map Layer -->
    <MapView 
      :selected-id="selectedItem?.id ? String(selectedItem.id) : null"
      :selected-targets="selectedTargets"
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

      <!-- Right Dashboard Panel (shown when no asset selected) -->
      <SidebarRight v-if="!isAssetItem(selectedItem)" />

      <!-- AI Chat (Floating) -->
      <div class="pointer-events-auto">
        <ChatInterface :context="chatContext" @action="handleChatAction" />
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
import { twinService } from '~/services/twin'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'
import { classifyRoadToPipeLayer } from '~/utils/pipe-classifier'

const selectedItem = ref<PipeNode | Building | GeoJsonFeature | null>(null)
const runtimeConfig = useRuntimeConfig()
const selectionToken = ref(0)
const route = useRoute()
const selectedTargets = computed(() => {
  if (!selectedItem.value) {
    return emptySelectedTargets()
  }

  if ('diameter' in selectedItem.value) {
    if (selectedItem.value.status === 'normal') {
      return emptySelectedTargets()
    }
    return {
      pipes: [],
      buildings: toStringArray(selectedItem.value.connectedBuildingIds || []),
      rooms: toStringArray((selectedItem.value.impactedRooms || []).map(room => room.id)),
    }
  }

  if (!('type' in selectedItem.value) || selectedItem.value.type !== 'geojson') {
    return emptySelectedTargets()
  }

  const props = toRecord(selectedItem.value.properties)
  const focusTargets = toRecord(props.focusTargets)
  return {
    pipes: toStringArray(Array.isArray(focusTargets.pipes) ? focusTargets.pipes : []),
    buildings: toStringArray(Array.isArray(focusTargets.buildings) ? focusTargets.buildings : []),
    rooms: toStringArray(Array.isArray(focusTargets.rooms) ? focusTargets.rooms : []),
  }
})

const chatContext = computed<Record<string, unknown> | null>(() => {
  const item = selectedItem.value
  if (!item) return null

  if ('diameter' in item) {
    return {
      selectionType: 'pipe',
      assetId: item.id,
      pipelineMedium: item.type,
      status: item.status,
      pressure: item.pressure,
      flowRate: item.flowRate,
      diameter: item.diameter,
      material: item.material,
      depth: item.depth,
      installDate: item.installDate,
      lastMaintain: item.lastMaintain,
      topologyNodeIds: item.topologyNodeIds || [],
      linkedValves: item.linkedValves || [],
      connectedBuildingIds: item.connectedBuildingIds || [],
      impactedRoomCount: item.impactedRooms?.length || 0,
      impactedEquipmentCount: item.linkedEquipments?.length || 0,
      healthScore: item.healthScore ?? null,
      healthSummary: item.healthSummary || null,
      faultImpactScope: item.faultImpactScope || null,
    }
  }

  if ('name' in item) {
    return {
      selectionType: 'building',
      assetId: item.id,
      buildingName: item.name,
      buildingType: item.type,
      status: item.status,
      connectedPipeId: item.connectedPipeId,
      rooms: item.rooms,
      keyEquipment: item.keyEquipment || [],
      powerConsumption: item.powerConsumption,
    }
  }

  if ('type' in item && item.type === 'geojson') {
    const properties = toRecord(item.properties)
    return {
      selectionType: 'feature',
      assetId: String(item.id),
      featureProperties: properties,
    }
  }

  return null
})

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
  pipeNodes: true,
  buildings: true,
  green: true,
})

// Weather State
const weatherMode = ref(false)
const router = useRouter()

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

function toRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function toStringArray(values: unknown[]) {
  return values
    .map((value) => {
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (value !== undefined && value !== null) return String(value)
      return ''
    })
    .filter(Boolean)
}

function emptySelectedTargets() {
  return {
    pipes: [] as string[],
    buildings: [] as string[],
    rooms: [] as string[],
  }
}

function summarizeHealth(score: number): PipeNode['healthSummary'] {
  if (score >= 85) return 'healthy'
  if (score >= 65) return 'attention'
  return 'risk'
}

function computePipeHealthScore(
  status: PipeNode['status'],
  pressure: number,
  flowRate: number,
  valveCount: number
) {
  let score = 100
  if (status === 'warning') score -= 20
  if (status === 'critical') score -= 40
  if (pressure < 1.2 || pressure > 4.5) score -= 15
  if (flowRate <= 0) score -= 20
  if (valveCount === 0) score -= 5
  return Math.max(0, Math.min(100, score))
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

function normalizeBuildingType(props: Record<string, unknown>): Building['type'] {
  const buildingType = String(props.building || '').toLowerCase()
  const amenity = String(props.amenity || '').toLowerCase()
  if (buildingType.includes('dorm') || buildingType.includes('dormitory')) return 'dorm'
  if (buildingType.includes('lab') || buildingType.includes('laboratory')) return 'lab'
  if (
    buildingType.includes('canteen') ||
    buildingType.includes('restaurant') ||
    amenity === 'restaurant'
  ) {
    return 'canteen'
  }
  return 'admin'
}

async function buildPipeAsset(feature: GeoJsonFeature) {
  const featureId = String(feature.id)
  const properties = (feature.properties || {}) as Record<string, unknown>
  const drilldown = await twinService
    .drilldown(backendBaseUrl.value, featureId)
    .catch(() => null)

  const drilldownSegment = drilldown ? toRecord(drilldown.segment) : {}
  const telemetryFeatureId = toText(drilldownSegment.featureId) || featureId
  const telemetry = await twinService
    .telemetryLatest(backendBaseUrl.value, [telemetryFeatureId])
    .catch(() => [])

  const linkedBuildingNames = drilldown
    ? drilldown.linkedBuildings
        .map((item) => {
          const row = toRecord(item)
          return toText(row.name) || toText(row.id)
        })
        .filter((item): item is string => Boolean(item))
    : []

  const linkedBuildingIds = drilldown
    ? toStringArray(
        drilldown.linkedBuildings.map((item) => {
          const row = toRecord(item)
          return row.id
        })
      )
    : []

  const impactedRooms = drilldown
    ? drilldown.impactedRooms.map((item) => {
        const row = toRecord(item)
        return {
          id: toText(row.id) || '',
          buildingId: toText(row.buildingId) || '',
          floorId: toText(row.floorId) || '',
          floorNo: toNumber(row.floorNo),
          roomNo: toText(row.roomNo) || '',
          roomName: toText(row.roomName) || '',
          roomType: toText(row.roomType) || '',
          status: toText(row.status) || 'unknown',
          areaM2: toNumber(row.areaM2),
        }
      })
    : []

  const linkedEquipments = drilldown
    ? drilldown.equipments.map((item) => {
        const row = toRecord(item)
        return {
          id: toText(row.id) || '',
          equipmentType: toText(row.equipmentType) || 'unknown',
          name: toText(row.name) || toText(row.id) || 'unknown-equipment',
          status: toText(row.status) || 'unknown',
          featureId: toText(row.featureId) || undefined,
          nodeId: toText(row.nodeId) || undefined,
          buildingId: toText(row.buildingId) || undefined,
        }
      })
    : []

  const linkedValves = drilldown
    ? toStringArray(
        drilldown.valves.map((item) => {
          const row = toRecord(item)
          return row.id
        })
      )
    : []

  const topologyNodeIds = drilldown
    ? toStringArray(
        drilldown.nodes.map((item) => {
          const row = toRecord(item)
          return row.id
        })
      )
    : []

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

  const status = normalizePipeStatus(properties.status)
  const healthScore = computePipeHealthScore(status, pressure, flowRate, linkedValves.length)

  return {
    id: featureId,
    type: normalizePipeType(properties, featureId),
    status,
    pressure,
    flowRate,
    coordinates: [],
    diameter: normalizeDiameter(properties),
    material: toText(properties.material) || '未知',
    depth,
    installDate,
    lastMaintain,
    connectedBuildingIds: linkedBuildingIds,
    topologyNodeIds,
    linkedValves,
    impactedRooms,
    linkedEquipments,
    healthScore,
    healthSummary: summarizeHealth(healthScore),
    faultImpactScope: {
      impactedBuildingCount: linkedBuildingIds.length,
      impactedRoomCount: impactedRooms.length,
      impactedEquipmentCount: linkedEquipments.length,
      keyBuildingIds: linkedBuildingIds.slice(0, 6),
    },
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
    
    // 建筑资产：直接基于真实 GeoJSON 属性构建，不再走本地 Mock BUILDINGS 映射
    if (properties.building) {
      let estimatedRooms = 0
      if (properties['building:levels']) {
        const levels = Number.parseInt(String(properties['building:levels']), 10)
        if (!Number.isNaN(levels)) {
          estimatedRooms = levels * 25
        }
      }

      selectedItem.value = {
        id: featureId,
        name: toText(properties.name) || toText(properties.short_name) || `建筑 ${featureId}`,
        type: normalizeBuildingType(properties as Record<string, unknown>),
        status: 'normal',
        coordinates: { x: 0, y: 0 },
        connectedPipeId: toText(properties.connectedPipeId) || toText(properties.connected_pipe_id) || 'UNKNOWN',
        rooms: estimatedRooms,
        keyEquipment: [],
        powerConsumption: 0,
      }
      return
    }
    
    // 检查是否是管道或管网节点（节点同样支持一键穿透）
    const pipeType = String(properties.pipeType || '').toLowerCase()
    const isPipeNode =
      typeof properties.nodeType === 'string'
      || typeof properties.nodeId === 'string'
      || properties.assetType === 'pipe_node'
    if (pipeType === 'water' || pipeType === 'drain' || pipeType === 'sewage' || properties.highway || isPipeNode) {
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

function firstString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const found = value.find(item => typeof item === 'string' && item.trim())
    return typeof found === 'string' ? found.trim() : ''
  }
  return ''
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function handleChatAction(action: { type?: string; payload?: Record<string, unknown> }) {
  const type = String(action.type || '').trim()
  const payload = action.payload || {}
  const featureId = firstString(payload.featureId)
  const workorderId = firstString(payload.workorderId)
  const buildingId = firstString(payload.buildingIds)
  const nodeId = firstString(payload.nodeIds)
  const segmentId = firstString(payload.segmentIds)

  if (type === 'open_pipe_editor' && featureId) {
    void router.push({
      path: '/admin/pipe-editor',
      query: { featureId },
    })
    return
  }

  if (type === 'open_workorder' && workorderId) {
    void router.push({
      path: '/admin',
      query: {
        tab: 'ops',
        sub: 'ops_linkage',
        third: 'ops_linkage_board',
        workorderId,
      },
    })
    return
  }

  if (type === 'open_workorder_board') {
    void router.push({
      path: '/admin',
      query: {
        tab: 'ops',
        sub: 'ops_linkage',
        third: 'ops_linkage_board',
        workorderId: workorderId || undefined,
      },
    })
    return
  }

  if (type === 'locate_on_map') {
    const focusId = buildingId || nodeId || segmentId || featureId
    if (!focusId) return
    const query = {
      focusId,
      focusBuilding: buildingId || undefined,
      focusNode: nodeId || undefined,
      focusSegment: segmentId || undefined,
    }
    void router.replace({ path: '/', query })
    return
  }
}

watch(
  () => [
    route.query.focusId,
    route.query.focusBuilding,
    route.query.focusNode,
    route.query.focusSegment,
    route.query.focusRooms,
    route.query.fromWorkorder,
  ],
  ([focusId, focusBuildingQuery, focusNodeQuery, focusSegmentQuery, focusRoomsQuery, fromWorkorderQuery]) => {
    const id = typeof focusId === 'string' ? focusId.trim() : ''
    if (!id) {
      selectedItem.value = null
      return
    }
    const focusBuilding = typeof focusBuildingQuery === 'string' ? focusBuildingQuery.trim() : ''
    const focusNode = typeof focusNodeQuery === 'string' ? focusNodeQuery.trim() : ''
    const focusSegment = typeof focusSegmentQuery === 'string' ? focusSegmentQuery.trim() : ''
    const focusRooms = typeof focusRoomsQuery === 'string'
      ? focusRoomsQuery.split(',').map(v => v.trim()).filter(Boolean)
      : []
    // Allow admin workorder module to deep-link and highlight an entity on the map.
    selectedItem.value = {
      id,
      type: 'geojson',
      properties: {
        fromWorkorder: typeof fromWorkorderQuery === 'string' ? fromWorkorderQuery : '',
        focusTargets: {
          pipes: [focusNode, focusSegment].filter(Boolean),
          buildings: [focusBuilding].filter(Boolean),
          rooms: focusRooms,
        },
      },
    }
  },
  { immediate: true }
)
</script>
