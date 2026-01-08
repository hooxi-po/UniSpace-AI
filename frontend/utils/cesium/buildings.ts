/**
 * @file buildings.ts
 * @description 建筑数据加载和处理模块
 * 负责加载 GeoJSON 数据并将建筑轮廓拉伸为 3D 模型
 */

import * as Cesium from 'cesium'
import { FLOOR_HEIGHT, DEFAULT_FLOORS } from './config'
import { getBuildingColor, BUILDING_ALPHA, OUTLINE_COLOR } from './styles'

/**
 * 加载并处理 GeoJSON 建筑数据
 * 将 2D 建筑轮廓转换为 3D 拉伸建筑
 * @param viewer - Cesium Viewer 实例
 * @param url - GeoJSON 文件 URL
 * @returns 加载完成的 DataSource 对象
 */
export async function loadBuildings(
  viewer: Cesium.Viewer,
  url: string
): Promise<Cesium.DataSource> {
  // 加载 GeoJSON 数据，不贴地以便进行 3D 拉伸
  const dataSource = await Cesium.GeoJsonDataSource.load(url, {
    clampToGround: false
  })
  
  // 遍历所有实体进行样式处理
  const entities = dataSource.entities.values
  for (const entity of entities) {
    processEntity(entity)
  }
  
  // 将数据源添加到 Viewer
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 处理单个实体
 * 根据实体类型应用不同的样式
 * @param entity - Cesium Entity 对象
 */
function processEntity(entity: Cesium.Entity): void {
  const properties = entity.properties
  
  // 隐藏所有标签和标记点
  hideLabelsAndMarkers(entity)
  
  // 检查是否是建筑类型
  if (properties && properties.building) {
    const buildingType = properties.building.getValue()
    if (buildingType) {
      // 应用建筑样式
      styleBuildingEntity(entity, properties, buildingType)
    }
  } else {
    // 隐藏非建筑要素（如道路、水域等）
    hideNonBuildingEntity(entity)
  }
}

/**
 * 隐藏实体的标签和标记
 * 避免地图上显示过多文字和图标
 * @param entity - Cesium Entity 对象
 */
function hideLabelsAndMarkers(entity: Cesium.Entity): void {
  // 隐藏文字标签
  if (entity.label) {
    entity.label.show = new Cesium.ConstantProperty(false)
  }
  // 隐藏图标标记
  if (entity.billboard) {
    entity.billboard.show = new Cesium.ConstantProperty(false)
  }
  // 隐藏点标记
  if (entity.point) {
    entity.point.show = new Cesium.ConstantProperty(false)
  }
}

/**
 * 设置建筑实体的 3D 样式
 * 根据楼层数拉伸建筑，并应用对应颜色
 * @param entity - Cesium Entity 对象
 * @param properties - 实体属性集合
 * @param buildingType - 建筑类型标识
 */
function styleBuildingEntity(
  entity: Cesium.Entity,
  properties: Cesium.PropertyBag,
  buildingType: string
): void {
  // 获取楼层数，如果没有则使用默认值
  let levels = DEFAULT_FLOORS
  if (properties['building:levels']) {
    levels = parseInt(properties['building:levels'].getValue()) || DEFAULT_FLOORS
  }
  
  // 根据楼层数计算建筑总高度
  const height = levels * FLOOR_HEIGHT
  
  // 根据建筑类型获取对应颜色
  const color = getBuildingColor(buildingType)
  
  // 设置多边形的 3D 拉伸样式
  if (entity.polygon) {
    // 设置高度参考为相对于地形，使建筑贴合地面
    entity.polygon.heightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.RELATIVE_TO_GROUND
    )
    entity.polygon.extrudedHeightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.RELATIVE_TO_GROUND
    )
    // 底部高度为 0（地面）
    entity.polygon.height = new Cesium.ConstantProperty(0)
    // 拉伸高度为计算出的建筑高度
    entity.polygon.extrudedHeight = new Cesium.ConstantProperty(height)
    // 设置建筑颜色和透明度
    entity.polygon.material = color.withAlpha(BUILDING_ALPHA)
    // 显示黑色轮廓线
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(OUTLINE_COLOR)
  }
}

/**
 * 隐藏非建筑类型的实体
 * 如道路、水域、区域边界等
 * @param entity - Cesium Entity 对象
 */
function hideNonBuildingEntity(entity: Cesium.Entity): void {
  // 隐藏多边形（如区域边界）
  if (entity.polygon) {
    entity.polygon.show = new Cesium.ConstantProperty(false)
  }
  // 隐藏线条（如道路）
  if (entity.polyline) {
    entity.polyline.show = new Cesium.ConstantProperty(false)
  }
}
