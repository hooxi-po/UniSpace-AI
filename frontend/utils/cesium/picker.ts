/**
 * @file picker.ts
 * @description 点击拾取和信息显示模块
 * 处理用户点击建筑时的信息提取和展示
 */

import * as Cesium from 'cesium'
import { translatePropertyValue, translatePropertyLabel } from './i18n'

/**
 * 属性信息结构
 * 用于在 UI 中显示的键值对
 */
export interface PropertyInfo {
  /** 属性标签（中文） */
  label: string
  /** 属性值 */
  value: string
}

/**
 * 拾取回调函数类型
 * @param info - 属性信息数组，如果点击空白处则为 null
 */
export type PickCallback = (info: PropertyInfo[] | null) => void

/**
 * 设置点击拾取事件处理
 * 当用户点击建筑时，提取并翻译属性信息
 * @param viewer - Cesium Viewer 实例
 * @param callback - 拾取结果回调函数
 * @returns 事件处理器，可用于后续移除事件
 */
export function setupPicker(
  viewer: Cesium.Viewer,
  callback: PickCallback
): Cesium.ScreenSpaceEventHandler {
  // 创建屏幕空间事件处理器
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  
  // 监听左键点击事件
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    // 在点击位置进行拾取
    const pickedObject = viewer.scene.pick(click.position)
    
    // 检查是否拾取到实体
    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id as Cesium.Entity
      const properties = entity.properties
      
      // 如果实体有属性，提取并返回
      if (properties) {
        const infoList = extractProperties(properties)
        if (infoList.length > 0) {
          callback(infoList)
          return
        }
      }
    }
    
    // 点击空白处，返回 null
    callback(null)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  return handler
}

/**
 * 提取并翻译实体属性
 * 将 GeoJSON 属性转换为中文显示格式
 * @param properties - Cesium PropertyBag 属性集合
 * @returns 翻译后的属性信息数组
 */
function extractProperties(properties: Cesium.PropertyBag): PropertyInfo[] {
  const infoList: PropertyInfo[] = []
  const propertyNames = properties.propertyNames
  
  // 遍历所有属性
  for (const propName of propertyNames) {
    // 获取属性值
    let value = properties[propName]?.getValue()
    
    // 跳过空值
    if (value === undefined || value === null || value === '') continue
    
    // 翻译属性值（如建筑类型）
    value = translatePropertyValue(propName, String(value))
    
    // 翻译属性名为中文标签
    const label = translatePropertyLabel(propName)
    
    infoList.push({ label, value: String(value) })
  }
  
  return infoList
}
