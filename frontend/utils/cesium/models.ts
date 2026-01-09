/**
 * @file models.ts
 * @description 3D 模型加载模块
 * 负责加载 glTF/GLB 格式的 3D 模型
 */

import * as Cesium from 'cesium'

/**
 * 模型配置接口
 */
export interface ModelConfig {
  /** 模型名称 */
  name: string
  /** 模型文件路径 */
  uri: string
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 高度（米） */
  height?: number
  /** 缩放比例 */
  scale?: number
  /** 朝向角度（度） */
  heading?: number
  /** 俯仰角度（度） */
  pitch?: number
  /** 翻滚角度（度） */
  roll?: number
}

/**
 * 预定义的模型配置
 */
export const MODEL_CONFIGS: ModelConfig[] = [
  {
    // 生化实验楼 - way/1372826600
    name: '生化实验楼',
    uri: '/model/Untitled.glb',
    // 建筑中心点坐标（根据 GeoJSON 多边形计算）
    longitude: 119.1943277,
    latitude: 26.0286408,
    height: 0,
    scale: 1,
    heading: 0,
    pitch: 0,
    roll: 0
  }
]

/**
 * 加载单个 glTF/GLB 模型
 * @param viewer - Cesium Viewer 实例
 * @param config - 模型配置
 * @returns 创建的 Entity 对象
 */
export function loadModel(
  viewer: Cesium.Viewer,
  config: ModelConfig
): Cesium.Entity {
  // 计算模型位置
  const position = Cesium.Cartesian3.fromDegrees(
    config.longitude,
    config.latitude,
    config.height ?? 0
  )

  // 计算模型朝向
  const heading = Cesium.Math.toRadians(config.heading ?? 0)
  const pitch = Cesium.Math.toRadians(config.pitch ?? 0)
  const roll = Cesium.Math.toRadians(config.roll ?? 0)
  const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll)
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr)

  // 创建模型实体
  const entity = viewer.entities.add({
    name: config.name,
    position: position,
    orientation: orientation,
    model: {
      uri: config.uri,
      scale: config.scale ?? 1,
      // 不设置 minimumPixelSize，让模型随地图缩放
      // 不设置 maximumScale，保持真实世界尺寸
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
    }
  })

  return entity
}

/**
 * 加载所有预定义的模型
 * @param viewer - Cesium Viewer 实例
 * @returns 所有创建的 Entity 对象数组
 */
export function loadAllModels(viewer: Cesium.Viewer): Cesium.Entity[] {
  const entities: Cesium.Entity[] = []
  
  for (const config of MODEL_CONFIGS) {
    try {
      const entity = loadModel(viewer, config)
      entities.push(entity)
      console.log(`模型加载成功: ${config.name}`)
    } catch (error) {
      console.error(`模型加载失败: ${config.name}`, error)
    }
  }
  
  return entities
}

/**
 * 设置模型的显示/隐藏状态
 * @param entities - 模型实体数组
 * @param show - 是否显示
 */
export function setModelsVisibility(entities: Cesium.Entity[], show: boolean): void {
  for (const entity of entities) {
    entity.show = show
  }
}
