/**
 * usePipe2DEditorDrawMode.ts
 *
 * 思维导图式绘制模式的交互状态机。
 *
 * DrawMode:
 *   'idle'        — 普通选择，不绘制
 *   'placeNode'   — 点击地图空白处放置节点
 *   'connectEdge' — 已选中源节点，等待点击目标节点完成连线
 *                   鼠标移动时显示预览虚线
 *
 * 与 usePipe2DEditorMapInteractions 的分工：
 *   - 本文件只处理"绘制新元素"的点击逻辑
 *   - Interactions 继续处理已有元素的选中、拖拽、删点、hover
 *   - 两者通过 drawMode ref 协调，Interactions 在 drawMode !== 'idle' 时跳过自身逻辑
 */

import * as Cesium from 'cesium'
import { ref, type Ref } from 'vue'
import type { SelectedElement } from '~/composables/admin/usePipe2DEditorGraph'
import type { EdgeType, NodeType, PipeGraph } from '~/utils/pipe2d-graph'
import type { Point } from '~/utils/pipe2d-geometry'

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type DrawMode = 'idle' | 'placeNode' | 'connectEdge'

export type DrawModeOptions = {
  graph: Ref<PipeGraph>
  selected: Ref<SelectedElement>
  drawMode: Ref<DrawMode>
  /** 当前连线边类型（straight / curve） */
  pendingEdgeType: Ref<EdgeType>
  /** 连线源节点 id */
  connectSourceId: Ref<string | null>
  /** 连线预览目标点（跟随鼠标），null 时隐藏预览线 */
  previewTarget: Ref<Point | null>
  /** 放置节点的默认类型 */
  placeNodeType: Ref<NodeType>
  getViewer: () => Cesium.Viewer | null
  screenToLonLat: (pos: Cesium.Cartesian2) => Point | null
  addNode: (lon: number, lat: number, type: NodeType) => { id: string }
  addEdge: (srcId: string, tgtId: string, edgeType: EdgeType) => unknown
  selectNode: (id: string) => void
  selectEdge: (id: string) => void
  clearSelection: () => void
  renderDraftGraphics: () => void
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function usePipe2DEditorDrawMode(options: DrawModeOptions) {
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let moveHandler: Cesium.ScreenSpaceEventHandler | null = null

  // 找到鼠标位置最近的节点（像素阈值内），用于连线吸附
  function findNearestNodeId(screenPos: Cesium.Cartesian2, thresholdPx = 20): string | null {
    const viewer = options.getViewer()
    if (!viewer) return null
    let bestId: string | null = null
    let bestDist = thresholdPx * thresholdPx
    for (const node of options.graph.value.nodes) {
      const cart = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, 0)
      const win = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cart)
      if (!win) continue
      const dx = win.x - screenPos.x
      const dy = win.y - screenPos.y
      const d = dx * dx + dy * dy
      if (d < bestDist) { bestDist = d; bestId = node.id }
    }
    return bestId
  }

  // ---------------------------------------------------------------------------
  // 模式切换
  // ---------------------------------------------------------------------------

  function enterPlaceNode(type?: NodeType) {
    if (type) options.placeNodeType.value = type
    options.drawMode.value = 'placeNode'
    options.connectSourceId.value = null
    options.previewTarget.value = null
    options.clearSelection()
  }

  function enterConnectFromNode(sourceNodeId: string, edgeType?: EdgeType) {
    if (edgeType) options.pendingEdgeType.value = edgeType
    options.drawMode.value = 'connectEdge'
    options.connectSourceId.value = sourceNodeId
    options.previewTarget.value = null
  }

  function exitDrawMode() {
    options.drawMode.value = 'idle'
    options.connectSourceId.value = null
    options.previewTarget.value = null
  }

  // ---------------------------------------------------------------------------
  // 事件处理
  // ---------------------------------------------------------------------------

  function handlePlaceNodeClick(screenPos: Cesium.Cartesian2) {
    const point = options.screenToLonLat(screenPos)
    if (!point) return
    // 吸附：若点击在已有节点附近则不重复放置，而是切换到连线模式
    const nearId = findNearestNodeId(screenPos, 16)
    if (nearId) {
      enterConnectFromNode(nearId)
      return
    }
    const node = options.addNode(point[0], point[1], options.placeNodeType.value)
    options.selectNode(node.id)
    options.renderDraftGraphics()
  }

  function handleConnectEdgeClick(screenPos: Cesium.Cartesian2) {
    const srcId = options.connectSourceId.value
    if (!srcId) { exitDrawMode(); return }

    const targetId = findNearestNodeId(screenPos, 20)
    if (targetId && targetId !== srcId) {
      const edge = options.addEdge(srcId, targetId, options.pendingEdgeType.value) as { id: string } | null
      if (edge) options.selectEdge(edge.id)
      options.renderDraftGraphics()
      exitDrawMode()
      return
    }

    // 点击空白处：先放置新节点，再连线
    const point = options.screenToLonLat(screenPos)
    if (!point) return
    const newNode = options.addNode(point[0], point[1], 'default')
    const edge = options.addEdge(srcId, newNode.id, options.pendingEdgeType.value) as { id: string } | null
    if (edge) options.selectEdge(edge.id)
    options.renderDraftGraphics()
    // 连线完成后，以新节点为起点继续连线（链式绘制）
    enterConnectFromNode(newNode.id)
  }

  function handleMouseMove(screenPos: Cesium.Cartesian2) {
    if (options.drawMode.value !== 'connectEdge') {
      options.previewTarget.value = null
      return
    }
    const point = options.screenToLonLat(screenPos)
    options.previewTarget.value = point
    // 不调用 renderDraftGraphics（预览线由 Graphics 层的 watch previewTarget 处理）
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      exitDrawMode()
    }
  }

  // ---------------------------------------------------------------------------
  // 绑定 / 解绑
  // ---------------------------------------------------------------------------

  function bindDrawEvents() {
    const viewer = options.getViewer()
    if (!viewer || handler) return

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const mode = options.drawMode.value
      if (mode === 'placeNode') handlePlaceNodeClick(e.position)
      else if (mode === 'connectEdge') handleConnectEdgeClick(e.position)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    moveHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    moveHandler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      handleMouseMove(e.endPosition)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    window.addEventListener('keydown', handleKeydown)
  }

  function destroyDrawEvents() {
    if (handler) { handler.destroy(); handler = null }
    if (moveHandler) { moveHandler.destroy(); moveHandler = null }
    window.removeEventListener('keydown', handleKeydown)
    exitDrawMode()
  }

  return {
    enterPlaceNode,
    enterConnectFromNode,
    exitDrawMode,
    bindDrawEvents,
    destroyDrawEvents,
  }
}

