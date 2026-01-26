<template>
  <div ref="cesiumContainerRef" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import type { PipeNode, Building, GeoJsonFeature } from '~/types'

const DEFAULT_CAMERA = {
  longitude: 119.1895,
  latitude: 26.0254,
  height: 500,
  heading: 30,
  pitch: -35,
}

type SelectItem = PipeNode | Building | GeoJsonFeature | null

type Viewport = { x: number; y: number; scale: number }

type MapLayers = {
  water: boolean
  sewage: boolean
  drain: boolean
  buildings: boolean
  green?: boolean
  roads?: boolean
}

interface Props {
  selectedId: string | null
  viewport: Viewport
  layers: MapLayers
  weatherMode: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [item: SelectItem]
  'update:viewport': [value: Viewport]
}>()

const cesiumContainerRef = ref<HTMLDivElement | null>(null)
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let highlightedEntity: Cesium.Entity | null = null
let highlightedOriginal: {
  polygonMaterial?: Cesium.MaterialProperty
  polylineMaterial?: Cesium.MaterialProperty
  polylineWidth?: number
} | null = null

// Layer data sources
const dataSources = {
  water: new Cesium.CustomDataSource('water'),
  green: new Cesium.CustomDataSource('green'),
  buildings: new Cesium.CustomDataSource('buildings'),
  roads: new Cesium.CustomDataSource('roads'),
  // For other pipelines if needed
  sewage: new Cesium.CustomDataSource('sewage'),
  drain: new Cesium.CustomDataSource('drain'),
}

// 未来主义科技风格样式（参考图片风格）
const styles = {
  water: {
    fill: new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('rgb(10, 37, 81)').withAlpha(0.8)
    ),
    stroke: Cesium.Color.CYAN.withAlpha(0.5),
    strokeWidth: 1,
  },
  green: {
    fill: new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('rgb(10, 43, 49)').withAlpha(0.7)
    ),
    outline: undefined,
  },
  buildings: {
    fill: new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('rgb(100, 180, 255)').withAlpha(0.6)
    ),
    outline: Cesium.Color.fromCssColorString('rgb(100, 180, 255)').withAlpha(0.6), // 发光浅蓝色边缘
    outlineWidth: 2,
    extrudedHeight: 20,
  },
  roads: {
    glowStroke: Cesium.Color.fromCssColorString('rgb(100, 180, 255)'), // 发光浅蓝色
    glowWidth: 3,
  },
}

// Watch for layer visibility changes
watchEffect(() => {
  if (!viewer) return
  for (const key in dataSources) {
    const typedKey = key as keyof typeof dataSources
    const dataSource = dataSources[typedKey]
    const layerProp = props.layers[typedKey as keyof MapLayers]
    if (layerProp !== undefined) {
      dataSource.show = layerProp
    }
  }
})

watch(
  () => props.selectedId,
  () => {
    if (!viewer) return

    // Restore previous highlight
    if (highlightedEntity && highlightedOriginal) {
      if (highlightedEntity.polygon && highlightedOriginal.polygonMaterial) {
        highlightedEntity.polygon.material = highlightedOriginal.polygonMaterial
      }
      if (highlightedEntity.polyline) {
        if (highlightedOriginal.polylineMaterial) {
          highlightedEntity.polyline.material = highlightedOriginal.polylineMaterial
        }
        if (typeof highlightedOriginal.polylineWidth === 'number') {
          highlightedEntity.polyline.width = new Cesium.ConstantProperty(
            highlightedOriginal.polylineWidth
          )
        }
      }
    }

    highlightedEntity = null
    highlightedOriginal = null

    if (!props.selectedId) return

    // Find entity across all datasources
    let target: Cesium.Entity | null = null
    for (const ds of Object.values(dataSources)) {
      const e = ds.entities.getById(props.selectedId)
      if (e) {
        target = e
        break
      }
    }

    if (!target) return

    highlightedEntity = target
    highlightedOriginal = {
      polygonMaterial: target.polygon?.material,
      polylineMaterial: target.polyline?.material,
      polylineWidth: target.polyline?.width?.getValue(viewer.clock.currentTime),
    }

    const highlightColor = new Cesium.ColorMaterialProperty(
      Cesium.Color.YELLOW.withAlpha(0.9)
    )

    if (target.polygon) {
      target.polygon.material = highlightColor
      target.polygon.outline = new Cesium.ConstantProperty(true)
      target.polygon.outlineColor = new Cesium.ConstantProperty(
        Cesium.Color.YELLOW.withAlpha(0.9)
      )
    }

    if (target.polyline) {
      target.polyline.material = highlightColor
      target.polyline.width = new Cesium.ConstantProperty(6)
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (!cesiumContainerRef.value) return

  viewer = new Cesium.Viewer(cesiumContainerRef.value, {
    creditContainer: document.createElement('div'),
    creditViewport: document.createElement('div'),
    // Using a darker base map to match the React example's mood
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: ['a', 'b', 'c', 'd'],
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

  // Remove GeoJSON default labels/billboards (often show as blue markers)
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false

  // Set default camera
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(DEFAULT_CAMERA.heading),
      pitch: Cesium.Math.toRadians(DEFAULT_CAMERA.pitch),
      roll: 0.0,
    },
  })

  // Add all data sources to the viewer
  Object.values(dataSources).forEach(ds => viewer?.dataSources.add(ds))

  // Load and process GeoJSON layers based on visibility
  loadGeoJsonLayers()

  // Setup click handler for selection
  setupClickHandler()
  
  // Setup viewport sync
  setupViewportSync()
})

/**
 * 设置地图点击事件处理器，用于选择地图上的实体
 * 当用户点击地图上的实体时，会触发 select 事件
 */
function setupClickHandler() {
  if (!viewer) return
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const pickedObject = viewer?.scene.pick(movement.position)
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      const entity = pickedObject.id
      const properties = viewer
        ? entity.properties?.getValue(viewer.clock.currentTime)
        : undefined
      
      emit('select', {
        id: entity.id,
        type: 'geojson',
        properties: properties as Record<string, unknown> | undefined,
      } as GeoJsonFeature)
    } else {
      emit('select', null)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/**
 * 设置视口同步功能
 * 1. 当相机移动时，将当前视口信息发送给父组件
 * 2. 当父组件的 viewport prop 变化时，更新相机位置
 * 使用 requestAnimationFrame 节流以避免频繁更新
 */
function setupViewportSync() {
  if (!viewer) return

  // 1) Emit viewport on camera move
  const emitViewport = () => {
    if (!viewer) return
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
    emit('update:viewport', {
      x: Cesium.Math.toDegrees(carto.longitude),
      y: Cesium.Math.toDegrees(carto.latitude),
      scale: carto.height,
    })
  }

  // Throttle via RAF to avoid spamming updates
  let raf = 0
  const onChange = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      emitViewport()
    })
  }

  viewer.camera.changed.addEventListener(onChange)

  onBeforeUnmount(() => {
    viewer?.camera.changed.removeEventListener(onChange)
    if (raf) cancelAnimationFrame(raf)
  })

  // 2) Apply viewport from props
  watch(
    () => props.viewport,
    (vp) => {
      if (!viewer) return
      // Avoid hard loops by only flying if there's a meaningful change
      const current = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
      const lon = Cesium.Math.toDegrees(current.longitude)
      const lat = Cesium.Math.toDegrees(current.latitude)
      const h = current.height

      const eps = 1e-6
      const same =
        Math.abs(lon - vp.x) < eps &&
        Math.abs(lat - vp.y) < eps &&
        Math.abs(h - vp.scale) < 0.5

      if (same) return

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(vp.x, vp.y, vp.scale),
        duration: 0.6,
      })
    },
    { deep: true, immediate: true }
  )
}

/**
 * 图层文件映射
 */
const layerFiles: Record<string, string> = {
  water: '/map/water.geojson',
  green: '/map/green.geojson',
  buildings: '/map/buildings.geojson',
  roads: '/map/roads.geojson',
}

/**
 * 已加载的图层状态
 */
const loadedLayers = ref<Set<string>>(new Set())

/**
 * 加载单个图层数据
 * @param layerName - 图层名称
 */
function loadLayer(layerName: string) {
  if (!viewer || loadedLayers.value.has(layerName)) return

  const dataSource = dataSources[layerName as keyof typeof dataSources]
  if (!dataSource) return

  const fileUrl = layerFiles[layerName]
  if (!fileUrl) return

  const geoJsonUrl = `${fileUrl}?t=${Date.now()}`
  
  Cesium.GeoJsonDataSource.load(geoJsonUrl, { clampToGround: true })
    .then(layerDataSource => {
      if (!viewer) return

      const entities = layerDataSource.entities.values
      for (const entity of entities) {
        // Remove any auto-generated labels/markers/points from GeoJSON features
        entity.label = undefined
        entity.billboard = undefined
        entity.point = undefined
        entity.description = undefined

        // Apply appropriate styling based on layer type
        if (layerName === 'water') {
          styleWaterEntity(entity)
        } else if (layerName === 'green') {
          styleGreenEntity(entity)
        } else if (layerName === 'buildings') {
          styleBuildingEntity(entity)
        } else if (layerName === 'roads') {
          styleRoadEntity(entity)
        }

        dataSource.entities.add(entity)
      }

      loadedLayers.value.add(layerName)
    })
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(`Failed to load ${layerName} layer:`, geoJsonUrl, err)
    })
}

/**
 * 卸载单个图层数据
 * @param layerName - 图层名称
 */
function unloadLayer(layerName: string) {
  if (!viewer) return

  const dataSource = dataSources[layerName as keyof typeof dataSources]
  if (!dataSource) return

  dataSource.entities.removeAll()
  loadedLayers.value.delete(layerName)
}

/**
 * 加载并处理 GeoJSON 图层数据
 * 根据 layers prop 的可见性按需加载各个图层
 */
function loadGeoJsonLayers() {
  // Load visible layers
  if (props.layers.water) loadLayer('water')
  if (props.layers.green) loadLayer('green')
  if (props.layers.buildings) loadLayer('buildings')
  if (props.layers.roads) loadLayer('roads')
}

/**
 * 监听图层可见性变化，动态加载/卸载图层
 */
watch(
  () => props.layers,
  (newLayers) => {
    if (!viewer) return

    // Check each layer and load/unload accordingly
    if (newLayers.water && !loadedLayers.value.has('water')) {
      loadLayer('water')
    } else if (!newLayers.water && loadedLayers.value.has('water')) {
      unloadLayer('water')
    }

    if (newLayers.green && !loadedLayers.value.has('green')) {
      loadLayer('green')
    } else if (!newLayers.green && loadedLayers.value.has('green')) {
      unloadLayer('green')
    }

    if (newLayers.buildings && !loadedLayers.value.has('buildings')) {
      loadLayer('buildings')
    } else if (!newLayers.buildings && loadedLayers.value.has('buildings')) {
      unloadLayer('buildings')
    }

    if (newLayers.roads && !loadedLayers.value.has('roads')) {
      loadLayer('roads')
    } else if (!newLayers.roads && loadedLayers.value.has('roads')) {
      unloadLayer('roads')
    }
  },
  { deep: true, immediate: false }
)

/**
 * 为水体实体应用样式（深色风格）
 * @param entity - Cesium 实体对象
 */
function styleWaterEntity(entity: Cesium.Entity) {
  if (entity.polygon) {
    entity.polygon.material = styles.water.fill
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(styles.water.stroke)
    entity.polygon.outlineWidth = new Cesium.ConstantProperty(1)
  }
}

/**
 * 为绿地实体应用样式（深绿色风格）
 * @param entity - Cesium 实体对象
 */
function styleGreenEntity(entity: Cesium.Entity) {
  if (entity.polygon) {
    entity.polygon.material = styles.green.fill
    entity.polygon.outline = new Cesium.ConstantProperty(false)
  }
}

/**
 * 为建筑实体应用样式，包括拉伸高度和发光边缘（未来主义风格）
 * @param entity - Cesium 实体对象
 */
function styleBuildingEntity(entity: Cesium.Entity) {
  if (entity.polygon) {
    entity.polygon.material = styles.buildings.fill
    entity.polygon.extrudedHeight = new Cesium.ConstantProperty(styles.buildings.extrudedHeight)
    entity.polygon.heightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.CLAMP_TO_GROUND
    )
    entity.polygon.extrudedHeightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.RELATIVE_TO_GROUND
    )
    // 添加发光浅蓝色边缘（模拟图片中的建筑物轮廓）
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(styles.buildings.outline)
    entity.polygon.outlineWidth = new Cesium.ConstantProperty(styles.buildings.outlineWidth)
  }
}

/**
 * 为道路实体应用样式（发光浅蓝色线条，模拟未来主义道路）
 * @param entity - Cesium 实体对象
 */
function styleRoadEntity(entity: Cesium.Entity) {
  if (entity.polyline) {
    // 使用发光材质创建浅蓝色发光道路效果
    entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
      color: styles.roads.glowStroke,
      glowPower: 0.4,
      taperPower: 0.3,
    })
    entity.polyline.width = new Cesium.ConstantProperty(styles.roads.glowWidth)
    entity.polyline.clampToGround = new Cesium.ConstantProperty(true)
  }
}

watch(
  () => props.weatherMode,
  (enabled) => {
    if (!viewer) return

    // A simple "weather" mood: darker atmosphere + fog. (Cesium doesn't ship a full weather system.)
    viewer.scene.fog.enabled = enabled
    viewer.scene.fog.density = enabled ? 0.00015 : 0.0
    viewer.scene.fog.minimumBrightness = enabled ? 0.15 : 0.5

    // Night-ish lighting mood
    viewer.scene.globe.enableLighting = enabled
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true
    }
    if (viewer.scene.skyBox) {
      viewer.scene.skyBox.show = true
    }

    // Dim the base imagery a bit to match the React demo look
    const layer = viewer.imageryLayers.get(0)
    if (layer) {
      layer.brightness = enabled ? 0.6 : 1.0
      layer.contrast = enabled ? 1.2 : 1.0
      layer.saturation = enabled ? 0.8 : 1.0
    }

    // Set a fixed "time" similar to the React demo's clock setting
    if (enabled) {
      const now = Cesium.JulianDate.now()
      // 14:30 local-ish as a stable preview time
      const base = Cesium.JulianDate.toDate(now)
      base.setHours(14, 30, 0, 0)
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(base)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (handler) {
    handler.destroy()
    handler = null
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>
