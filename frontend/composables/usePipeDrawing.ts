/**
 * @file usePipeDrawing.ts
 * @description 管道交互式绘制功能
 * 新流程：绘制节点 → 自动连接 → 调整曲线 → 设置粗细 → 填写信息
 */

import { ref, readonly, computed } from 'vue'
import * as Cesium from 'cesium'

// ==================== 类型定义 ====================

export type DrawingMode = 'none' | 'bindNode' | 'bindPipe' | 'node' | 'bindCurve' | 'adjustCurve' | 'bindWidth' | 'adjustWidth'

export interface PipeNode {
  id: string
  position: Cesium.Cartesian3
  coordinates: [number, number] // [经度, 纬度]
  entity?: Cesium.Entity
}

export interface PipeSegment {
  id: string
  startNode: PipeNode
  endNode: PipeNode
  controlPoints: Cesium.Cartesian3[] // 贝塞尔曲线控制点
  width: number // 管道宽度（像素）
  entity?: Cesium.Entity
}

export interface DrawnPipeData {
  nodes: PipeNode[]
  segments: PipeSegment[]
  totalLength: number
}

// ==================== 响应式状态 ====================

const drawingMode = ref<DrawingMode>('none')
const nodes = ref<PipeNode[]>([])
const segments = ref<PipeSegment[]>([])
const selectedNode = ref<PipeNode | null>(null)
const selectedSegment = ref<PipeSegment | null>(null)
const currentWidth = ref<number>(5)
const canUndo = ref(false)
const showPipeForm = ref(false)
const drawnPipeData = ref<DrawnPipeData | null>(null)

// ==================== 模块级变量 ====================

let viewer: Cesium.Viewer | null = null
let handler: Cesium.ScreenSpaceEventHandler | null = null
let drawingDataSource: Cesium.CustomDataSource | null = null
let nodeIdCounter = 0
let segmentIdCounter = 0

// 回调函数
let onPipeDrawComplete: ((data: DrawnPipeData) => void) | null = null

// ==================== 计算属性 ====================

const totalLength = computed(() => {
  let length = 0
  for (const seg of segments.value) {
    length += calculateSegmentLength(seg)
  }
  return Math.round(length)
})

// ==================== 初始化 ====================

export function initDrawingTool(cesiumViewer: Cesium.Viewer): void {
  viewer = cesiumViewer
  drawingDataSource = new Cesium.CustomDataSource('pipeDrawing')
  viewer.dataSources.add(drawingDataSource)
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
}

// ==================== 模式控制 ====================

export function setDrawingMode(mode: DrawingMode): void {
  // 清除之前的事件监听
  clearEventHandlers()
  
  drawingMode.value = mode
  
  switch (mode) {
    case 'node':
      setupNodeDrawing()
      break
    case 'adjustCurve':
      setupCurveAdjustment()
      break
    case 'adjustWidth':
      setupWidthAdjustment()
      break
    case 'none':
      // 不做任何事
      break
  }
}

function clearEventHandlers(): void {
  if (handler) {
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MIDDLE_CLICK)
  }
}

// ==================== 节点绘制 ====================

function setupNodeDrawing(): void {
  if (!viewer || !handler) return
  
  // 左键添加节点
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const cartesian = viewer!.camera.pickEllipsoid(click.position, viewer!.scene.globe.ellipsoid)
    if (!cartesian) return
    addNode(cartesian)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // 中键撤销
  handler.setInputAction(() => {
    undoLastNode()
  }, Cesium.ScreenSpaceEventType.MIDDLE_CLICK)
  
  // 右键完成节点绘制，进入曲线调整模式
  handler.setInputAction(() => {
    if (nodes.value.length >= 2) {
      setDrawingMode('adjustCurve')
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

function addNode(position: Cesium.Cartesian3): void {
  if (!drawingDataSource) return
  
  const cartographic = Cesium.Cartographic.fromCartesian(position)
  const longitude = Cesium.Math.toDegrees(cartographic.longitude)
  const latitude = Cesium.Math.toDegrees(cartographic.latitude)
  
  const node: PipeNode = {
    id: `node_${++nodeIdCounter}`,
    position,
    coordinates: [longitude, latitude]
  }
  
  // 创建节点实体
  node.entity = drawingDataSource.entities.add({
    id: node.id,
    position,
    point: {
      pixelSize: 14,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    label: {
      text: `${nodes.value.length + 1}`,
      font: 'bold 12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -18),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  })
  
  nodes.value.push(node)
  
  // 如果有前一个节点，自动创建连接线段
  if (nodes.value.length >= 2) {
    const prevNode = nodes.value[nodes.value.length - 2]
    createSegment(prevNode, node)
  }
  
  canUndo.value = nodes.value.length > 0
}

function createSegment(startNode: PipeNode, endNode: PipeNode): void {
  if (!drawingDataSource) return
  
  const segment: PipeSegment = {
    id: `segment_${++segmentIdCounter}`,
    startNode,
    endNode,
    controlPoints: [], // 初始为直线，无控制点
    width: currentWidth.value
  }
  
  // 创建线段实体
  segment.entity = drawingDataSource.entities.add({
    id: segment.id,
    polyline: {
      positions: [startNode.position, endNode.position],
      width: segment.width,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.2,
        color: Cesium.Color.CYAN.withAlpha(0.8)
      }),
      clampToGround: true
    }
  })
  
  segments.value.push(segment)
}

function undoLastNode(): void {
  if (!drawingDataSource || nodes.value.length === 0) return
  
  // 移除最后一个节点
  const lastNode = nodes.value.pop()
  if (lastNode?.entity) {
    drawingDataSource.entities.remove(lastNode.entity)
  }
  
  // 移除最后一个线段
  if (segments.value.length > 0) {
    const lastSegment = segments.value.pop()
    if (lastSegment?.entity) {
      drawingDataSource.entities.remove(lastSegment.entity)
    }
  }
  
  canUndo.value = nodes.value.length > 0
}

// ==================== 曲线调整 ====================

function setupCurveAdjustment(): void {
  if (!viewer || !handler) return
  
  // 点击选择线段
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const picked = viewer!.scene.pick(click.position)
    
    if (Cesium.defined(picked) && picked.id) {
      const entityId = picked.id.id || picked.id
      const segment = segments.value.find(s => s.id === entityId)
      
      if (segment) {
        selectSegment(segment)
      } else {
        // 点击空白处，如果已选中线段，在该位置添加控制点
        if (selectedSegment.value) {
          const cartesian = viewer!.camera.pickEllipsoid(click.position, viewer!.scene.globe.ellipsoid)
          if (cartesian) {
            addControlPoint(selectedSegment.value, cartesian)
          }
        }
      }
    } else if (selectedSegment.value) {
      // 点击空白处添加控制点
      const cartesian = viewer!.camera.pickEllipsoid(click.position, viewer!.scene.globe.ellipsoid)
      if (cartesian) {
        addControlPoint(selectedSegment.value, cartesian)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // 右键完成曲线调整，进入粗细调整
  handler.setInputAction(() => {
    selectedSegment.value = null
    setDrawingMode('adjustWidth')
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

function selectSegment(segment: PipeSegment): void {
  // 取消之前的选择
  if (selectedSegment.value?.entity?.polyline) {
    selectedSegment.value.entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.2,
      color: Cesium.Color.CYAN.withAlpha(0.8)
    })
  }
  
  selectedSegment.value = segment
  
  // 高亮选中的线段
  if (segment.entity?.polyline) {
    segment.entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.4,
      color: Cesium.Color.YELLOW
    })
  }
}

function addControlPoint(segment: PipeSegment, position: Cesium.Cartesian3): void {
  if (!drawingDataSource) return
  
  segment.controlPoints.push(position)
  
  // 添加控制点可视化
  drawingDataSource.entities.add({
    id: `ctrl_${segment.id}_${segment.controlPoints.length}`,
    position,
    point: {
      pixelSize: 10,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  })
  
  // 更新线段为曲线
  updateSegmentCurve(segment)
}

function updateSegmentCurve(segment: PipeSegment): void {
  if (!segment.entity?.polyline) return
  
  const positions = generateCurvePositions(segment)
  segment.entity.polyline.positions = new Cesium.ConstantProperty(positions)
}

function generateCurvePositions(segment: PipeSegment): Cesium.Cartesian3[] {
  const { startNode, endNode, controlPoints } = segment
  
  if (controlPoints.length === 0) {
    return [startNode.position, endNode.position]
  }
  
  // 使用 Catmull-Rom 样条生成平滑曲线
  const allPoints = [startNode.position, ...controlPoints, endNode.position]
  const spline = new Cesium.CatmullRomSpline({
    times: allPoints.map((_, i) => i / (allPoints.length - 1)),
    points: allPoints
  })
  
  // 生成曲线上的点
  const curvePositions: Cesium.Cartesian3[] = []
  const numSamples = 20 * allPoints.length
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples
    curvePositions.push(spline.evaluate(t))
  }
  
  return curvePositions
}

// ==================== 粗细调整 ====================

function setupWidthAdjustment(): void {
  if (!viewer || !handler) return
  
  // 点击选择线段
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const picked = viewer!.scene.pick(click.position)
    
    if (Cesium.defined(picked) && picked.id) {
      const entityId = picked.id.id || picked.id
      const segment = segments.value.find(s => s.id === entityId)
      
      if (segment) {
        selectSegmentForWidth(segment)
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  
  // 右键完成，显示表单
  handler.setInputAction(() => {
    finishDrawing()
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
}

function selectSegmentForWidth(segment: PipeSegment): void {
  selectedSegment.value = segment
  
  // 高亮选中的线段
  if (segment.entity?.polyline) {
    segment.entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.4,
      color: Cesium.Color.YELLOW
    })
  }
}

export function setSegmentWidth(width: number): void {
  if (!selectedSegment.value?.entity?.polyline) return
  
  selectedSegment.value.width = width
  selectedSegment.value.entity.polyline.width = new Cesium.ConstantProperty(width)
}

export function setAllSegmentsWidth(width: number): void {
  currentWidth.value = width
  for (const segment of segments.value) {
    segment.width = width
    if (segment.entity?.polyline) {
      segment.entity.polyline.width = new Cesium.ConstantProperty(width)
    }
  }
}

// ==================== 完成绘制 ====================

function finishDrawing(): void {
  if (nodes.value.length < 2) return
  
  // 准备数据
  drawnPipeData.value = {
    nodes: [...nodes.value],
    segments: [...segments.value],
    totalLength: totalLength.value
  }
  
  // 显示表单
  showPipeForm.value = true
  
  // 清除事件
  clearEventHandlers()
  drawingMode.value = 'none'
  
  // 触发回调
  if (onPipeDrawComplete) {
    onPipeDrawComplete(drawnPipeData.value)
  }
}

// ==================== 辅助函数 ====================

function calculateSegmentLength(segment: PipeSegment): number {
  const positions = generateCurvePositions(segment)
  let length = 0
  for (let i = 1; i < positions.length; i++) {
    length += Cesium.Cartesian3.distance(positions[i - 1], positions[i])
  }
  return length
}

// ==================== 清理 ====================

export function clearDrawing(): void {
  if (drawingDataSource) {
    drawingDataSource.entities.removeAll()
  }
  nodes.value = []
  segments.value = []
  selectedNode.value = null
  selectedSegment.value = null
  canUndo.value = false
  drawnPipeData.value = null
  showPipeForm.value = false
  nodeIdCounter = 0
  segmentIdCounter = 0
}

export function cancelDrawing(): void {
  clearDrawing()
  clearEventHandlers()
  drawingMode.value = 'none'
}

export function closePipeForm(): void {
  showPipeForm.value = false
}

export function confirmPipeForm(): void {
  // 保留绘制的数据，关闭表单
  showPipeForm.value = false
  clearDrawing()
}

export function setOnPipeDrawComplete(callback: typeof onPipeDrawComplete): void {
  onPipeDrawComplete = callback
}

export function destroyDrawingTool(): void {
  clearEventHandlers()
  if (handler) {
    handler.destroy()
    handler = null
  }
  if (drawingDataSource && viewer) {
    viewer.dataSources.remove(drawingDataSource)
    drawingDataSource = null
  }
  viewer = null
  clearDrawing()
  onPipeDrawComplete = null
}

// ==================== 导出 Composable ====================

export function usePipeDrawing() {
  return {
    // 状态
    drawingMode: readonly(drawingMode),
    nodes: readonly(nodes),
    segments: readonly(segments),
    selectedNode: readonly(selectedNode),
    selectedSegment: readonly(selectedSegment),
    currentWidth: readonly(currentWidth),
    canUndo: readonly(canUndo),
    showPipeForm: readonly(showPipeForm),
    drawnPipeData: readonly(drawnPipeData),
    totalLength,
    
    // 方法
    initDrawingTool,
    setDrawingMode,
    setSegmentWidth,
    setAllSegmentsWidth,
    clearDrawing,
    cancelDrawing,
    closePipeForm,
    confirmPipeForm,
    setOnPipeDrawComplete,
    destroyDrawingTool
  }
}
