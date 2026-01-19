/**
 * @file pipes.ts
 * @description 管道渲染模块
 * 负责在 Cesium 地图上绘制和管理管道网络
 */

import * as Cesium from 'cesium'

/**
 * 管道数据接口
 */
export interface PipeData {
  id: string
  type: 'water' | 'sewage' | 'drainage'
  name: string
  diameter: number
  material: string
  length: number
  depth: number
  pressure?: number
  slope?: number
  installDate: string
  status: string
  // 管道路径坐标 [经度, 纬度]
  coordinates?: number[][]
}

/**
 * 管道类型配置
 */
const PIPE_TYPE_CONFIG = {
  water: {
    color: Cesium.Color.fromCssColorString('#00ff7f'),
    name: '供水管道'
  },
  sewage: {
    color: Cesium.Color.fromCssColorString('#8b4513'),
    name: '污水管道'
  },
  drainage: {
    color: Cesium.Color.fromCssColorString('#4169e1'),
    name: '排水管道'
  }
}

/**
 * 管道实体集合
 */
let pipeEntities: Cesium.Entity[] = []
let pipeEntityById: Map<string, Cesium.Entity> = new Map()
let viewer: Cesium.Viewer | null = null

/**
 * 初始化管道渲染器
 * @param cesiumViewer - Cesium Viewer 实例
 */
export function initPipeRenderer(cesiumViewer: Cesium.Viewer): void {
  viewer = cesiumViewer
}

/**
 * 生成模拟管道坐标
 * 在校园区域内生成随机但合理的管道路径
 * @param baseCoords - 基准坐标 [经度, 纬度]
 * @param length - 管道长度（米）
 * @returns 管道坐标数组
 */
function generatePipeCoordinates(baseCoords: [number, number], length: number): number[][] {
  const [baseLon, baseLat] = baseCoords
  const coordinates: number[][] = []
  
  // 起点
  coordinates.push([baseLon, baseLat])
  
  // 根据长度生成中间点（每50米一个点）
  const segments = Math.max(2, Math.floor(length / 50))
  
  // 每度经度约111km，每度纬度约111km
  const meterToDegree = 1 / 111000
  
  let currentLon = baseLon
  let currentLat = baseLat
  
  for (let i = 1; i < segments; i++) {
    // 随机方向，但偏向东西走向（更符合管道布局）
    const angle = (Math.random() - 0.5) * Math.PI / 3 // ±30度范围
    const segmentLength = length / segments
    
    const deltaLon = Math.cos(angle) * segmentLength * meterToDegree
    const deltaLat = Math.sin(angle) * segmentLength * meterToDegree
    
    currentLon += deltaLon
    currentLat += deltaLat
    
    coordinates.push([currentLon, currentLat])
  }
  
  return coordinates
}

/**
 * 获取校园区域的基准坐标
 * 根据管道ID分配不同的起始位置
 * 坐标基于福州区域（与 config.ts 中的相机位置一致）
 */
function getBaseCoordinates(pipeId: string): [number, number] {
  // 校园中心坐标（福州区域，与 config.ts DEFAULT_CAMERA 一致）
  const centerLon = 119.1895
  const centerLat = 26.0254
  
  // 根据管道ID的最后一位数字分配不同区域
  const lastDigit = parseInt(pipeId.slice(-1)) || 0
  const offset = 0.002 // 约200米
  
  const positions: [number, number][] = [
    [centerLon - offset, centerLat],           // 西
    [centerLon + offset, centerLat],           // 东
    [centerLon, centerLat + offset],           // 北
    [centerLon, centerLat - offset],           // 南
    [centerLon - offset/2, centerLat + offset/2], // 西北
    [centerLon + offset/2, centerLat + offset/2], // 东北
    [centerLon - offset/2, centerLat - offset/2], // 西南
    [centerLon + offset/2, centerLat - offset/2], // 东南
    [centerLon - offset*0.7, centerLat],       // 中西
    [centerLon + offset*0.7, centerLat],       // 中东
  ]
  
  return positions[lastDigit % positions.length]
}

/**
 * 渲染单个管道
 * @param pipe - 管道数据
 * @returns 创建的 Cesium Entity
 */
export function renderPipe(pipe: PipeData): Cesium.Entity | null {
  if (!viewer) {
    console.error('管道渲染器未初始化')
    return null
  }
  
  // 如果没有坐标，生成模拟坐标
  let coordinates = pipe.coordinates
  if (!coordinates || coordinates.length === 0) {
    const baseCoords = getBaseCoordinates(pipe.id)
    coordinates = generatePipeCoordinates(baseCoords, pipe.length)
  }
  
  if (coordinates.length < 2) {
    console.warn(`管道 ${pipe.id} 坐标点不足`)
    return null
  }
  
  // 转换为 Cartesian3 数组（地表管道不需要高度）
  const positions: Cesium.Cartesian3[] = []
  for (const coord of coordinates) {
    positions.push(
      Cesium.Cartesian3.fromDegrees(coord[0], coord[1])
    )
  }
  
  // 获取管道类型配置
  const typeConfig = PIPE_TYPE_CONFIG[pipe.type]
  
  // 根据管道直径计算显示宽度（像素）
  const width = Math.max(4, Math.min(12, pipe.diameter / 40))
  
  // 根据状态调整颜色
  let color = typeConfig.color.clone()
  if (pipe.status === '维修中') {
    color = Cesium.Color.YELLOW
  } else if (pipe.status === '待检修') {
    color = Cesium.Color.ORANGE
  } else if (pipe.status === '报废') {
    color = Cesium.Color.RED
  }
  
  // 创建地表管道实体（贴合地形）
  const entity = viewer.entities.add({
    id: `pipe_${pipe.id}`,
    name: pipe.name,
    polyline: {
      positions: positions,
      width: width,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: color
      }),
      clampToGround: true // 贴合地形
    },
    properties: {
      id: pipe.id,
      type: pipe.type,
      typeName: typeConfig.name,
      name: pipe.name,
      diameter: pipe.diameter,
      material: pipe.material,
      length: pipe.length,
      depth: pipe.depth,
      pressure: pipe.pressure,
      slope: pipe.slope,
      installDate: pipe.installDate,
      status: pipe.status
    }
  })
  
  pipeEntities.push(entity)
  pipeEntityById.set(pipe.id, entity)
  return entity
}

/**
 * 渲染多个管道
 * @param pipes - 管道数据数组
 */
export function renderPipes(pipes: PipeData[]): void {
  if (!viewer) {
    console.error('管道渲染器未初始化')
    return
  }

  // 增量同步：
  // - 新增/更新：对输入列表中的每条管道执行 upsert
  // - 删除：移除当前已渲染但输入列表不存在的管道

  const nextIds = new Set<string>()

  for (const pipe of pipes) {
    nextIds.add(pipe.id)

    const oldEntity = pipeEntityById.get(pipe.id)
    if (oldEntity) {
      // 简单策略：存在则替换（避免手动 diff polyline/material/properties）
      viewer.entities.remove(oldEntity)
      pipeEntities = pipeEntities.filter(e => e.id !== oldEntity.id)
      pipeEntityById.delete(pipe.id)
    }

    renderPipe(pipe)
  }

  for (const [pipeId, entity] of pipeEntityById.entries()) {
    if (nextIds.has(pipeId)) continue

    viewer.entities.remove(entity)
    pipeEntities = pipeEntities.filter(e => e.id !== entity.id)
    pipeEntityById.delete(pipeId)
  }
}

/**
 * 更新单个管道
 * @param pipe - 更新后的管道数据
 */
export function updatePipe(pipe: PipeData): void {
  if (!viewer) return

  const oldEntity = pipeEntityById.get(pipe.id)
  if (oldEntity) {
    viewer.entities.remove(oldEntity)
    pipeEntities = pipeEntities.filter(e => e.id !== oldEntity.id)
    pipeEntityById.delete(pipe.id)
  }

  renderPipe(pipe)
}

/**
 * 删除单个管道
 * @param pipeId - 管道ID
 */
export function removePipe(pipeId: string): void {
  if (!viewer) return

  const entity = pipeEntityById.get(pipeId)
  if (entity) {
    viewer.entities.remove(entity)
    pipeEntities = pipeEntities.filter(e => e.id !== entity.id)
    pipeEntityById.delete(pipeId)
  }
}

/**
 * 清除所有管道
 */
export function clearPipes(): void {
  if (!viewer) return

  for (const entity of pipeEntities) {
    viewer.entities.remove(entity)
  }

  pipeEntities = []
  pipeEntityById = new Map()
}

/**
 * 设置管道可见性
 * @param visible - 是否可见
 * @param pipeType - 管道类型（可选，不指定则应用到所有管道）
 */
export function setPipesVisibility(visible: boolean, pipeType?: 'water' | 'sewage' | 'drainage'): void {
  for (const entity of pipeEntities) {
    if (pipeType) {
      const entityType = entity.properties?.getValue(Cesium.JulianDate.now()).type
      if (entityType === pipeType) {
        entity.show = visible
      }
    } else {
      entity.show = visible
    }
  }
}

/**
 * 高亮显示指定管道
 * @param pipeId - 管道ID
 */
let activeHighlightTimer: ReturnType<typeof setTimeout> | null = null
let activeHighlightedPipeId: string | null = null
let activeHighlightOriginal: { material: any; width: any } | null = null

export function highlightPipe(pipeId: string): void {
  if (!viewer) return

  // 先取消上一次高亮，避免叠加导致样式错乱
  if (activeHighlightTimer) {
    clearTimeout(activeHighlightTimer)
    activeHighlightTimer = null
  }

  if (activeHighlightedPipeId && activeHighlightOriginal) {
    const prev = pipeEntityById.get(activeHighlightedPipeId)
    if (prev?.polyline) {
      prev.polyline.material = activeHighlightOriginal.material
      prev.polyline.width = activeHighlightOriginal.width
    }
  }

  activeHighlightedPipeId = pipeId

  const entity = pipeEntityById.get(pipeId)
  if (entity && entity.polyline) {
    // 保存原始样式
    activeHighlightOriginal = {
      material: entity.polyline.material,
      width: entity.polyline.width
    }

    // 设置高亮样式
    entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.WHITE)
    entity.polyline.width = new Cesium.ConstantProperty(8)

    // 2秒后恢复（若期间又高亮了别的管道，会在上面被取消）
    activeHighlightTimer = setTimeout(() => {
      activeHighlightTimer = null
      const current = pipeEntityById.get(pipeId)
      if (current?.polyline && activeHighlightOriginal) {
        current.polyline.material = activeHighlightOriginal.material
        current.polyline.width = activeHighlightOriginal.width
      }
      activeHighlightedPipeId = null
      activeHighlightOriginal = null
    }, 2000)
  }
}

/**
 * 飞行到指定管道
 * @param pipeId - 管道ID
 */
export function flyToPipe(pipeId: string): void {
  if (!viewer) return
  
  const entity = viewer.entities.getById(`pipe_${pipeId}`)
  if (entity) {
    viewer.flyTo(entity, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 500)
    })
  }
}

/**
 * 获取所有管道实体
 */
export function getAllPipeEntities(): Cesium.Entity[] {
  return pipeEntities
}

/**
 * 获取管道实体（按 pipeId）
 */
export function getPipeEntity(pipeId: string): Cesium.Entity | undefined {
  return pipeEntityById.get(pipeId)
}
