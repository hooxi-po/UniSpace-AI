/**
 * @file viewer.ts
 * @description Cesium Viewer 初始化和相机控制模块
 * 提供 Viewer 创建、底图配置、相机视角控制等功能
 */

import * as Cesium from 'cesium'
import { DEFAULT_CAMERA, GLOBE_TRANSLUCENCY } from './config'

/**
 * Viewer 初始化选项
 */
export interface ViewerOptions {
  /** 挂载 Viewer 的 DOM 容器 */
  container: HTMLElement
  /** Cesium Ion 访问令牌 */
  token: string
}

/**
 * 创建并初始化 Cesium Viewer
 * @param options - Viewer 配置选项
 * @returns 初始化完成的 Cesium.Viewer 实例
 */
export function createViewer(options: ViewerOptions): Cesium.Viewer {
  const { container, token } = options
  
  // 设置 Cesium Ion 访问令牌，用于加载地形等资源
  Cesium.Ion.defaultAccessToken = token
  
  // 创建 Viewer，禁用不需要的 UI 组件
  const viewer = new Cesium.Viewer(container, {
    baseLayerPicker: false,      // 禁用底图选择器
    imageryProvider: false,       // 不使用默认底图
    terrain: Cesium.Terrain.fromWorldTerrain(), // 使用世界地形
    timeline: false,              // 禁用时间轴
    animation: false,             // 禁用动画控件
    geocoder: false,              // 禁用地理编码搜索
    homeButton: false,            // 禁用主页按钮
    sceneModePicker: false,       // 禁用场景模式选择器
    navigationHelpButton: false,  // 禁用导航帮助按钮
    fullscreenButton: false,      // 禁用全屏按钮
    infoBox: false,               // 禁用默认信息框
    selectionIndicator: false,    // 禁用选择指示器
  })
  
  return viewer
}

/**
 * 添加 OpenStreetMap 底图图层
 * @param viewer - Cesium Viewer 实例
 */
export function addOsmImagery(viewer: Cesium.Viewer): void {
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    })
  )
}

/**
 * 配置地下视角功能
 * 允许相机进入地下，并设置地球半透明
 * @param viewer - Cesium Viewer 实例
 */
export function setupUndergroundView(viewer: Cesium.Viewer): void {
  // 禁用碰撞检测，允许相机穿透地面
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false
  
  // 启用地球半透明效果
  viewer.scene.globe.translucency.enabled = true
  viewer.scene.globe.translucency.frontFaceAlpha = GLOBE_TRANSLUCENCY.frontFaceAlpha
  viewer.scene.globe.translucency.backFaceAlpha = GLOBE_TRANSLUCENCY.backFaceAlpha
  
  // 启用深度检测，确保建筑正确遮挡
  viewer.scene.globe.depthTestAgainstTerrain = true
}

/**
 * 设置默认相机视角
 * 将相机移动到配置的默认位置
 * @param viewer - Cesium Viewer 实例
 */
export function setDefaultCamera(viewer: Cesium.Viewer): void {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      DEFAULT_CAMERA.longitude,
      DEFAULT_CAMERA.latitude,
      DEFAULT_CAMERA.height
    ),
    orientation: {
      heading: Cesium.Math.toRadians(DEFAULT_CAMERA.heading),
      pitch: Cesium.Math.toRadians(DEFAULT_CAMERA.pitch),
      roll: 0
    }
  })
}

/**
 * 相机飞行到指定位置
 * 带有平滑过渡动画
 * @param viewer - Cesium Viewer 实例
 * @param longitude - 目标经度
 * @param latitude - 目标纬度
 * @param height - 目标高度（米）
 * @param heading - 方向角（度）
 * @param pitch - 俯仰角（度）
 * @param duration - 飞行动画时长（秒），默认 2 秒
 */
export function flyToPosition(
  viewer: Cesium.Viewer,
  longitude: number,
  latitude: number,
  height: number,
  heading: number,
  pitch: number,
  duration: number = 2
): void {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0
    },
    duration
  })
}
