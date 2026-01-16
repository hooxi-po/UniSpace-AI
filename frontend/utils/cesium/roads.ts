/**
 * @file roads.ts
 * @description 道路数据处理模块
 * 从 GeoJSON 文件中提取道路数据并转换为管道数据
 */

import type { PipeData } from './pipes'

/**
 * GeoJSON Feature 接口
 */
interface GeoJSONFeature {
  type: 'Feature'
  id?: string
  properties: {
    highway?: string
    name?: string
    [key: string]: unknown
  }
  geometry: {
    type: 'LineString' | 'Polygon' | 'MultiPolygon' | 'Point'
    coordinates: number[][] | number[][][] | number[]
  }
}

/**
 * GeoJSON FeatureCollection 接口
 */
interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

/**
 * 道路类型到管道类型的映射
 */
const ROAD_TO_PIPE_TYPE: Record<string, 'water' | 'sewage' | 'drainage'> = {
  // 主要道路 -> 供水管道
  'secondary': 'water',
  'primary': 'water',
  'tertiary': 'water',
  // 次要道路 -> 排水管道
  'unclassified': 'drainage',
  'residential': 'drainage',
  'service': 'drainage',
  // 人行道/小路 -> 污水管道
  'footway': 'sewage',
  'path': 'sewage',
  'pedestrian': 'sewage',
  'track': 'sewage'
}

/**
 * 管道类型配置
 */
const PIPE_TYPE_CONFIG = {
  water: {
    name: '供水管道',
    diameter: 300,
    material: 'PE管',
    depth: 1.2,
    pressure: 0.4
  },
  sewage: {
    name: '污水管道',
    diameter: 400,
    material: 'HDPE管',
    depth: 2.0,
    slope: 0.3
  },
  drainage: {
    name: '排水管道',
    diameter: 500,
    material: '混凝土管',
    depth: 1.5,
    slope: 0.5
  }
}

/**
 * 计算两点之间的距离（米）
 */
function calculateDistance(coord1: number[], coord2: number[]): number {
  const R = 6371000 // 地球半径（米）
  const lat1 = coord1[1] * Math.PI / 180
  const lat2 = coord2[1] * Math.PI / 180
  const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180
  const deltaLon = (coord2[0] - coord1[0]) * Math.PI / 180

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 计算线段总长度
 */
function calculateTotalLength(coordinates: number[][]): number {
  let totalLength = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalLength += calculateDistance(coordinates[i], coordinates[i + 1])
  }
  return Math.round(totalLength)
}

/**
 * 从 GeoJSON 中提取道路数据
 * @param geojson - GeoJSON 数据
 * @returns 道路 Feature 数组
 */
export function extractRoads(geojson: GeoJSONFeatureCollection): GeoJSONFeature[] {
  return geojson.features.filter(feature => {
    // 只提取有 highway 属性的 LineString 类型
    return feature.properties?.highway && 
           feature.geometry?.type === 'LineString'
  })
}

/**
 * 将道路数据转换为管道数据
 * @param roads - 道路 Feature 数组
 * @returns 管道数据数组
 */
export function convertRoadsToPipes(roads: GeoJSONFeature[]): PipeData[] {
  const pipes: PipeData[] = []
  
  roads.forEach((road, index) => {
    const highway = road.properties.highway as string
    const pipeType = ROAD_TO_PIPE_TYPE[highway] || 'drainage'
    const config = PIPE_TYPE_CONFIG[pipeType]
    const coordinates = road.geometry.coordinates as number[][]
    
    // 计算管道长度
    const length = calculateTotalLength(coordinates)
    
    // 生成管道名称
    const roadName = road.properties.name as string || `道路${index + 1}`
    const pipeName = `${roadName}-${config.name}`
    
    const pipe: PipeData = {
      id: `road_pipe_${road.id || index}`,
      type: pipeType,
      name: pipeName,
      diameter: config.diameter + Math.floor(Math.random() * 100), // 添加一些随机变化
      material: config.material,
      length: length,
      depth: config.depth + Math.random() * 0.5,
      installDate: '2020-01-01',
      status: '正常',
      coordinates: coordinates
    }
    
    // 添加类型特定属性
    if (pipeType === 'water' && 'pressure' in config) {
      pipe.pressure = config.pressure + Math.random() * 0.2
    }
    if ((pipeType === 'sewage' || pipeType === 'drainage') && 'slope' in config) {
      pipe.slope = config.slope + Math.random() * 0.2
    }
    
    pipes.push(pipe)
  })
  
  return pipes
}

/**
 * 从 GeoJSON 文件加载道路数据并转换为管道
 * @param url - GeoJSON 文件 URL
 * @returns 管道数据数组
 */
export async function loadRoadsAsPipes(url: string): Promise<PipeData[]> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`加载 GeoJSON 失败: ${response.status}`)
    }
    
    const geojson: GeoJSONFeatureCollection = await response.json()
    const roads = extractRoads(geojson)
    
    console.log(`从 GeoJSON 中提取了 ${roads.length} 条道路`)
    
    const pipes = convertRoadsToPipes(roads)
    
    console.log(`转换为 ${pipes.length} 条管道`)
    
    return pipes
  } catch (error) {
    console.error('加载道路数据失败:', error)
    return []
  }
}

/**
 * 按管道类型过滤
 */
export function filterPipesByType(pipes: PipeData[], type: 'water' | 'sewage' | 'drainage'): PipeData[] {
  return pipes.filter(pipe => pipe.type === type)
}

/**
 * 获取管道统计信息
 */
export function getPipeStatistics(pipes: PipeData[]) {
  const stats = {
    total: pipes.length,
    totalLength: 0,
    byType: {
      water: { count: 0, length: 0 },
      sewage: { count: 0, length: 0 },
      drainage: { count: 0, length: 0 }
    }
  }
  
  pipes.forEach(pipe => {
    stats.totalLength += pipe.length
    stats.byType[pipe.type].count++
    stats.byType[pipe.type].length += pipe.length
  })
  
  return stats
}
