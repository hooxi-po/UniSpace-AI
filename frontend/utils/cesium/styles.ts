/**
 * @file styles.ts
 * @description 建筑样式配置模块
 * 定义不同类型建筑的颜色和外观样式
 */

import * as Cesium from 'cesium'

/**
 * 建筑类型颜色映射表
 * 根据建筑用途分配不同的显示颜色
 */
export const buildingColors: Record<string, string> = {
  /** 宿舍楼 - 橙色 */
  'dormitory': '#FFB347',
  /** 教学楼/大学建筑 - 天蓝色 */
  'university': '#87CEEB',
  /** 学校建筑 - 天蓝色 */
  'school': '#87CEEB',
  /** 餐厅 - 红色 */
  'restaurant': '#FF6B6B',
  /** 仓库/器材室 - 灰色 */
  'warehouse': '#A0A0A0',
  /** 普通建筑 - 薄荷绿 */
  'yes': '#98D8C8',
  /** 默认颜色 - 灰蓝色 */
  'default': '#8B9DC3'
}

/**
 * 根据建筑类型获取对应的 Cesium 颜色对象
 * @param buildingType - 建筑类型标识
 * @returns Cesium.Color 颜色对象
 */
export function getBuildingColor(buildingType: string): Cesium.Color {
  // 查找对应颜色，找不到则使用默认颜色
  const colorHex = buildingColors[buildingType] || buildingColors['default']
  return Cesium.Color.fromCssColorString(colorHex)
}

/**
 * 建筑透明度
 * 0 为完全透明，1 为完全不透明
 */
export const BUILDING_ALPHA = 0.9

/**
 * 建筑轮廓线颜色
 */
export const OUTLINE_COLOR = Cesium.Color.BLACK
