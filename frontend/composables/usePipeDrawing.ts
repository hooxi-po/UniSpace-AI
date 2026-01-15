/**
 * @file usePipeDrawing.ts
 * @description 管道交互式绘制功能
 * 提供类似 CAD 的点击绘制体验
 */

import { ref, readonly } from 'vue'
import * as Cesium from 'cesium'

export type DrawingMode = 'none' | 'node' | 'pipe' | 'edit'

// 绘制状态
const drawingMode = ref<DrawingMode>('none')
const drawingPoints = ref<Cesium.Cartesian3[]>([])
const tempEntities = ref<Cesium.Entity[]>([])
const selectedEntity = ref<Cesium.Entity | null>(null)

// Cesium Viewer 实例
let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null

// 临时绘制图层
let drawingDataSource: Cesium.CustomDataSource | null = null

/**
 * 初始化绘制工具
 */
export function initDrawingTool(cesiumViewer: Cesium.Viewer): void {
  viewer = cesiumViewer
  
  // 创建临时绘制图层
  drawingDataSource = new Cesium.CustomDataSource('drawing')
  viewer.dataSources.add(drawingDataSource)
  
  // 创建事件处理器
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
}

/**
 * 设置绘制模式
 */
export function setDrawingMode(mode: DrawingMode): void {
  drawingMode.value = mode
  
  // 清除之前的绘制状态
  clearDrawing()
  
  if (mode === 'none') {
    // 移除所有事件监听
    if (handler) {
      handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
      handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
      handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    }
  } else if (mode === 'node') {
    setupNodeDrawing()
  } else if (mode === 'pipe') {
    setupPipeDrawing()
  } else if (mode === 'edit') {
    setupEditMode()
  }
}

/**
 * 设置节点绘制模式
 */
function setupNodeDrawing(): void {
  if (!viewer || !handler || !drawingDataSource) return
  
  // 左键点击添加节点
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    if (!viewer || !drawingDataSource) return
    
    // 获取点击位置的地理坐标
    const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid)
    if (!cartesian) return
    
    // 添加节点标记
    const entity = drawingDataSource.entities.add({
      position: cartesian,
      point: {
        pixelSize: 10,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: `节点 ${drawingDataSource.entities.values.length}`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
    
    tempEntities.value.push(entity)
    drawingPoints.value.push(cartesian)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // 右键取消
  handler.setInputAction(() => {
    clearDrawing()
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

/**
 * 设置管道绘制模式
 */
function setupPipeDrawing(): void {
  if (!viewer || !handler || !drawingDataSource) return
  
  let activePolyline: Cesium.Entity | null = null
  let activePoints: Cesium.Cartesian3[] = []
  
  // 左键点击添加管道点
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    if (!viewer || !drawingDataSource) return
    
    const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid)
    if (!cartesian) return
    
    activePoints.push(cartesian)
    drawingPoints.value.push(cartesian)
    
    // 添加点标记
    const pointEntity = drawingDataSource.entities.add({
      position: cartesian,
      point: {
        pixelSize: 8,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
    tempEntities.value.push(pointEntity)
    
    // 如果有两个或以上的点，绘制管线
    if (activePoints.length >= 2) {
      if (activePolyline) {
        // 更新现有管线
        activePolyline.polyline!.positions = new Cesium.CallbackProperty(() => {
          return activePoints
        }, false)
      } else {
        // 创建新管线
        activePolyline = drawingDataSource.entities.add({
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              return activePoints
            }, false),
            width: 5,
            material: Cesium.Color.CYAN.withAlpha(0.8),
            clampToGround: true
          }
        })
        tempEntities.value.push(activePolyline)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // 鼠标移动显示预览线
  let previewLine: Cesium.Entity | null = null
  handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
    if (!viewer || !drawingDataSource || activePoints.length === 0) return
    
    const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid)
    if (!cartesian) return
    
    // 移除旧的预览线
    if (previewLine) {
      drawingDataSource.entities.remove(previewLine)
    }
    
    // 创建新的预览线
    const previewPoints = [...activePoints, cartesian]
    previewLine = drawingDataSource.entities.add({
      polyline: {
        positions: previewPoints,
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.YELLOW,
          dashLength: 16
        }),
        clampToGround: true
      }
    })
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  
  // 右键完成绘制
  handler.setInputAction(() => {
    if (activePoints.length >= 2) {
      // 触发完成事件，传递绘制的点
      finishPipeDrawing(activePoints)
    }
    
    // 清除预览线
    if (previewLine && drawingDataSource) {
      drawingDataSource.entities.remove(previewLine)
      previewLine = null
    }
    
    // 重置状态
    activePoints = []
    activePolyline = null
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

/**
 * 设置编辑模式
 */
function setupEditMode(): void {
  if (!viewer || !handler) return
  
  // 左键点击选择实体
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    if (!viewer) return
    
    const pickedObject = viewer.scene.pick(click.position)
    
    if (Cesium.defined(pickedObject) && pickedObject.id) {
      const entity = pickedObject.id as Cesium.Entity
      
      // 检查是否是管道实体
      if (entity.id && String(entity.id).startsWith('pipe_')) {
        selectedEntity.value = entity
        highlightEntity(entity)
      }
    } else {
      // 点击空白处取消选择
      if (selectedEntity.value) {
        unhighlightEntity(selectedEntity.value)
        selectedEntity.value = null
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/**
 * 高亮实体
 */
function highlightEntity(entity: Cesium.Entity): void {
  if (entity.polyline) {
    // 保存原始样式
    const originalWidth = entity.polyline.width
    const originalMaterial = entity.polyline.material
    
    // 设置高亮样式
    entity.polyline.width = new Cesium.ConstantProperty(8)
    entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.WHITE)
    
    // 保存原始样式以便恢复
    ;(entity as any)._originalStyle = {
      width: originalWidth,
      material: originalMaterial
    }
  }
}

/**
 * 取消高亮
 */
function unhighlightEntity(entity: Cesium.Entity): void {
  if (entity.polyline && (entity as any)._originalStyle) {
    const original = (entity as any)._originalStyle
    entity.polyline.width = original.width
    entity.polyline.material = original.material
    delete (entity as any)._originalStyle
  }
}

/**
 * 完成管道绘制
 */
function finishPipeDrawing(points: Cesium.Cartesian3[]): void {
  if (points.length < 2) return
  
  // 转换为经纬度坐标
  const coordinates: number[][] = []
  for (const point of points) {
    const cartographic = Cesium.Cartographic.fromCartesian(point)
    const longitude = Cesium.Math.toDegrees(cartographic.longitude)
    const latitude = Cesium.Math.toDegrees(cartographic.latitude)
    coordinates.push([longitude, latitude])
  }
  
  // 计算管道长度
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    const distance = Cesium.Cartesian3.distance(points[i - 1], points[i])
    totalLength += distance
  }
  
  // 触发完成事件
  if (onPipeDrawComplete) {
    onPipeDrawComplete({
      coordinates,
      length: Math.round(totalLength)
    })
  }
  
  // 清除临时绘制
  clearDrawing()
}

/**
 * 清除临时绘制
 */
function clearDrawing(): void {
  if (drawingDataSource) {
    drawingDataSource.entities.removeAll()
  }
  drawingPoints.value = []
  tempEntities.value = []
}

/**
 * 获取绘制的坐标点
 */
export function getDrawingCoordinates(): number[][] {
  const coordinates: number[][] = []
  for (const point of drawingPoints.value) {
    const cartographic = Cesium.Cartographic.fromCartesian(point)
    const longitude = Cesium.Math.toDegrees(cartographic.longitude)
    const latitude = Cesium.Math.toDegrees(cartographic.latitude)
    coordinates.push([longitude, latitude])
  }
  return coordinates
}

/**
 * 管道绘制完成回调
 */
let onPipeDrawComplete: ((data: { coordinates: number[][], length: number }) => void) | null = null

export function setOnPipeDrawComplete(callback: (data: { coordinates: number[][], length: number }) => void): void {
  onPipeDrawComplete = callback
}

/**
 * 销毁绘制工具
 */
export function destroyDrawingTool(): void {
  if (handler) {
    handler.destroy()
    handler = null
  }
  
  if (drawingDataSource && viewer) {
    viewer.dataSources.remove(drawingDataSource)
    drawingDataSource = null
  }
  
  viewer = null
  drawingMode.value = 'none'
  clearDrawing()
}

/**
 * 导出 Composable
 */
export function usePipeDrawing() {
  return {
    drawingMode: readonly(drawingMode),
    drawingPoints: readonly(drawingPoints),
    selectedEntity: readonly(selectedEntity),
    initDrawingTool,
    setDrawingMode,
    getDrawingCoordinates,
    setOnPipeDrawComplete,
    clearDrawing,
    destroyDrawingTool
  }
}
