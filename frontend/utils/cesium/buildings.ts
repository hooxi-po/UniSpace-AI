/**
 * @file buildings.ts
 * @description 建筑数据加载和处理模块
 * 使用 Cesium OSM Buildings 加载全球 3D 建筑
 */

import * as Cesium from 'cesium'

/** OSM Buildings tileset 实例 */
let osmBuildingsTileset: Cesium.Cesium3DTileset | null = null

/**
 * 加载 Cesium OSM Buildings
 * 全球覆盖的 3D 建筑数据
 * @param viewer - Cesium Viewer 实例
 * @returns 加载完成的 3D Tileset 对象
 */
export async function loadBuildings(
  viewer: Cesium.Viewer
): Promise<Cesium.Cesium3DTileset> {
  try {
    // 加载 OSM Buildings
    osmBuildingsTileset = await Cesium.createOsmBuildingsAsync()
    
    // 应用建筑样式
    applyBuildingStyle()
    
    // 添加到场景
    viewer.scene.primitives.add(osmBuildingsTileset)
    
    console.log('OSM Buildings 加载成功')
    return osmBuildingsTileset
  } catch (error) {
    console.error('加载 OSM Buildings 失败:', error)
    throw error
  }
}

/**
 * 设置建筑显示/隐藏
 * @param visible - 是否显示
 */
export function setBuildingsVisibility(visible: boolean): void {
  if (osmBuildingsTileset) {
    osmBuildingsTileset.show = visible
  }
}

/**
 * 获取 OSM Buildings tileset 实例
 */
export function getOsmBuildingsTileset(): Cesium.Cesium3DTileset | null {
  return osmBuildingsTileset
}

/**
 * 应用建筑外立面样式
 * 根据建筑类型和高度设置不同颜色，模拟外立面效果
 */
export function applyBuildingStyle(): void {
  if (!osmBuildingsTileset) return
  
  osmBuildingsTileset.style = new Cesium.Cesium3DTileStyle({
    color: {
      conditions: [
        // 住宅建筑 - 暖色调
        ["${feature['building']} === 'residential'", "color('#E8D4B8')"],
        ["${feature['building']} === 'apartments'", "color('#D4C4A8')"],
        ["${feature['building']} === 'house'", "color('#F5E6D3')"],
        ["${feature['building']} === 'dormitory'", "color('#FFB347')"],
        
        // 商业建筑 - 蓝灰色调
        ["${feature['building']} === 'commercial'", "color('#A8C4D4')"],
        ["${feature['building']} === 'office'", "color('#B8D4E8')"],
        ["${feature['building']} === 'retail'", "color('#C4D4E8')"],
        
        // 工业建筑 - 灰色调
        ["${feature['building']} === 'industrial'", "color('#A0A0A0')"],
        ["${feature['building']} === 'warehouse'", "color('#909090')"],
        
        // 公共建筑 - 特殊颜色
        ["${feature['building']} === 'school'", "color('#87CEEB')"],
        ["${feature['building']} === 'university'", "color('#7EC8E3')"],
        ["${feature['building']} === 'hospital'", "color('#FFB6C1')"],
        ["${feature['building']} === 'church'", "color('#DDA0DD')"],
        
        // 按高度分级着色（默认）
        ["${feature['cesium#estimatedHeight']} > 100", "color('#708090')"],  // 超高层 - 深灰蓝
        ["${feature['cesium#estimatedHeight']} > 50", "color('#87CEEB')"],   // 高层 - 天蓝
        ["${feature['cesium#estimatedHeight']} > 20", "color('#B0C4DE')"],   // 中层 - 浅钢蓝
        ["${feature['cesium#estimatedHeight']} > 10", "color('#E0E8F0')"],   // 多层 - 浅灰蓝
        ["true", "color('#F5F5F5')"]  // 低层 - 白灰
      ]
    }
  })
}
