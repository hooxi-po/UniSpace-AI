/**
 * @file useMapState.ts
 * @description 全局地图状态管理
 * 管理图层显示、建筑信息弹窗、侧边栏状态等
 */

import { ref, readonly } from 'vue'
import type { PropertyInfo } from '../utils/cesium'

// ==================== 图层状态 ====================

/** 图层显示状态 */
const layers = ref({
  pipes: true,
  waterSupply: true,
  pressure: true,
  power: true,
  iotDevices: false,
  buildings: true
})

// ==================== 建筑信息弹窗状态 ====================

/** 是否显示建筑信息弹窗 */
const showBuildingPopup = ref(false)

/** 当前选中建筑的属性信息 */
const buildingInfo = ref<PropertyInfo[]>([])

/** 弹窗位置（屏幕坐标） */
const popupPosition = ref({ x: 0, y: 0 })

// ==================== 侧边栏状态 ====================

/** 左侧边栏是否显示 */
const showLeftSidebar = ref(true)

/** 右侧边栏是否显示 */
const showRightSidebar = ref(true)

// ==================== 底部导航状态 ====================

/** 导航项类型 */
export type NavItemType = '管网类型' | '管网编辑器' | '建筑模型' | '关联模型' | '关联楼宇' | '实时压力'

/** 当前激活的导航项 */
const activeNavItem = ref<NavItemType>('管网类型')

/** 是否为编辑模式（2D视角） */
const isEditorMode = ref(false)

// ==================== 实时数据（模拟） ====================

/** 实时压力值 */
const realtimePressure = ref({
  value: 0.45,
  unit: 'MPa',
  status: '低' as '正常' | '低' | '高'
})

// ==================== 导出 Composable ====================

export const useMapState = () => {
  // 切换图层显示
  const toggleLayer = (layer: keyof typeof layers.value) => {
    layers.value[layer] = !layers.value[layer]
  }

  // 设置建筑信息并显示弹窗
  const showBuildingInfo = (info: PropertyInfo[], position: { x: number; y: number }) => {
    buildingInfo.value = info
    popupPosition.value = position
    showBuildingPopup.value = true
  }

  // 关闭建筑信息弹窗
  const closeBuildingPopup = () => {
    showBuildingPopup.value = false
    buildingInfo.value = []
  }

  // 切换左侧边栏
  const toggleLeftSidebar = () => {
    showLeftSidebar.value = !showLeftSidebar.value
  }

  // 切换右侧边栏
  const toggleRightSidebar = () => {
    showRightSidebar.value = !showRightSidebar.value
  }

  // 设置激活的导航项
  const setActiveNavItem = (item: NavItemType) => {
    activeNavItem.value = item
    // 切换导航时自动打开左侧栏
    showLeftSidebar.value = true
    
    // 管网编辑器模式：隐藏建筑，切换到2D视角
    if (item === '管网编辑器') {
      isEditorMode.value = true
      layers.value.buildings = false
    } else if (isEditorMode.value) {
      // 退出编辑器模式时恢复
      isEditorMode.value = false
      layers.value.buildings = true
    }
  }

  // 更新实时压力（模拟数据更新）
  const updatePressure = (value: number) => {
    realtimePressure.value.value = value
    if (value < 0.3) {
      realtimePressure.value.status = '低'
    } else if (value > 0.6) {
      realtimePressure.value.status = '高'
    } else {
      realtimePressure.value.status = '正常'
    }
  }

  return {
    // 图层
    layers: readonly(layers),
    toggleLayer,
    
    // 建筑弹窗
    showBuildingPopup: readonly(showBuildingPopup),
    buildingInfo: readonly(buildingInfo),
    popupPosition: readonly(popupPosition),
    showBuildingInfo,
    closeBuildingPopup,
    
    // 侧边栏
    showLeftSidebar: readonly(showLeftSidebar),
    showRightSidebar: readonly(showRightSidebar),
    toggleLeftSidebar,
    toggleRightSidebar,
    
    // 导航
    activeNavItem: readonly(activeNavItem),
    setActiveNavItem,
    isEditorMode: readonly(isEditorMode),
    
    // 实时数据
    realtimePressure: readonly(realtimePressure),
    updatePressure
  }
}
