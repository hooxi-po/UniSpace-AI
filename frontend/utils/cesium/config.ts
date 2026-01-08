/**
 * @file config.ts
 * @description Cesium 地图配置常量
 * 包含相机位置、建筑高度、地球透明度等全局配置参数
 */

/**
 * 默认相机位置配置
 * 用于初始化地图视角
 */
export const DEFAULT_CAMERA = {
  /** 经度 */
  longitude: 119.1895,
  /** 纬度 */
  latitude: 26.0254,
  /** 相机高度（米） */
  height: 500,
  /** 方向角（度），0 为正北 */
  heading: 30,
  /** 俯仰角（度），负值为向下看 */
  pitch: -35
}

/**
 * 地下视角相机配置
 * 用于切换到地下视角时的相机位置
 */
export const UNDERGROUND_CAMERA = {
  /** 经度 */
  longitude: 119.1895,
  /** 纬度 */
  latitude: 26.0254,
  /** 相机高度（米），负值表示地下 */
  height: -50,
  /** 方向角（度） */
  heading: 0,
  /** 俯仰角（度），正值为向上看 */
  pitch: 10
}

/**
 * 建筑每层高度（米）
 * 用于根据楼层数计算建筑总高度
 */
export const FLOOR_HEIGHT = 20

/**
 * 默认楼层数
 * 当 GeoJSON 数据中没有楼层信息时使用
 */
export const DEFAULT_FLOORS = 3

/**
 * 地球透明度配置
 * 用于地下视角时显示半透明地表
 */
export const GLOBE_TRANSLUCENCY = {
  /** 地表正面透明度（0-1） */
  frontFaceAlpha: 0.5,
  /** 地表背面透明度（0-1），从地下看地表时使用 */
  backFaceAlpha: 0.5
}
