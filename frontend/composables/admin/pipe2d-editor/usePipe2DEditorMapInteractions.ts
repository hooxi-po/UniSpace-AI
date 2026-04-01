import * as Cesium from 'cesium'
import { type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import { cloneLines, isSamePoint, type Lines, type Point } from '~/utils/pipe2d-geometry'
import {
  lineLengthMeters,
  lineMetaOf,
  pointToSegmentDistanceSquared,
  SELECT_LINE_THRESHOLD,
  SNAP_PIXEL_THRESHOLD,
  type ContextMenuState,
  type HoverLengthHint,
  type PipeLineMeta,
} from './pipe2d-editor-map-shared'

type ActionMessage = {
  type: 'ok' | 'error'
  text: string
}

type UsePipe2DEditorMapInteractionsOptions = {
  open: Ref<boolean>
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  draftLines: Ref<Lines>
  originalLines: Ref<Lines>
  saving: Ref<boolean>
  actionMessage: Ref<ActionMessage | null>
  requestClose?: () => void
  getViewer: () => Cesium.Viewer | null
  getGraphicLayer: () => any | null
  toCartesian: (point: Point) => Cesium.Cartesian3
  screenToLonLat: (screenPosition: Cesium.Cartesian2) => Point | null
  worldToScreen: (point: Point) => Cesium.Cartesian2 | null
  snapEndpointCandidates: ComputedRef<Point[]>
  activeLineIndex: Ref<number>
  draggingNodeId: Ref<string | null>
  addPointMode: Ref<boolean>
  deletePointMode: Ref<boolean>
  addNodeMode: Ref<boolean>
  placeGraphNodeAtScreen: (x: number, y: number) => boolean
  pickGraphEntity: (screenPosition: { x: number; y: number }) => { type: 'node'; nodeId: string } | { type: 'edge'; edgeId: string } | null
  selectGraphNode: (nodeId: string) => void
  selectGraphEdge: (edgeId: string) => void
  clearGraphSelection?: () => void
  graphSelected?: Ref<{ kind: 'node'; nodeId: string } | { kind: 'edge'; edgeId: string } | null>
  insertNodeOnEdge?: (edgeId: string, lon: number, lat: number) => void
  removeNodeMergeEdge?: (nodeId: string) => void
  moveGraphNode?: (nodeId: string, lon: number, lat: number) => void
  pushGraphHistory?: () => void
  snapEnabled: Ref<boolean>
  history: Ref<Lines[]>
  redoHistory: Ref<Lines[]>
  contextMenu: Ref<ContextMenuState>
  snapHintVisible: Ref<boolean>
  hoverLengthHint: Ref<HoverLengthHint>
  hoveredLineIndex: Ref<number | null>
  renderDraftGraphics: () => void
  // 思维导图状态（用于检查是否处于思维导图编辑模式）
  mindmapSelectedNodeIds?: Ref<Set<string>>
  mindmapSelectedEdgeIds?: Ref<Set<string>>
  mindmapModeType?: Ref<string>
  startEditingActiveLine: () => void
  setCameraControlsEnabled: (enabled: boolean) => void
  clearDragReleaseFallback: () => void
  installDragReleaseFallback: () => void
  pushHistory: () => void
}

export function usePipe2DEditorMapInteractions(options: UsePipe2DEditorMapInteractionsOptions) {
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let ignoreNextClick = false
  let snapHintTimer: ReturnType<typeof setTimeout> | null = null
  let hoverHintTimer: ReturnType<typeof setTimeout> | null = null
  let hoverRafId: number | null = null
  let pendingHoverPosition: Cesium.Cartesian2 | null = null
  let contextMenuPoint: Point | null = null

  function triggerSnapHint() {
    options.snapHintVisible.value = true
    if (snapHintTimer) {
      clearTimeout(snapHintTimer)
    }
    snapHintTimer = setTimeout(() => {
      options.snapHintVisible.value = false
      snapHintTimer = null
    }, 800)
  }

  function applyEndpointSnap(
    point: Point,
    screenPosition?: Cesium.Cartesian2,
    excludePoint?: Point | null,
  ): Point {
    if (!options.snapEnabled.value || !options.snapEndpointCandidates.value.length) return point
    const source = screenPosition || options.worldToScreen(point)
    if (!source) return point

    let best = point
    let bestDistanceSq = SNAP_PIXEL_THRESHOLD * SNAP_PIXEL_THRESHOLD
    for (const candidate of options.snapEndpointCandidates.value) {
      if (excludePoint && isSamePoint(candidate, excludePoint)) continue
      const projected = options.worldToScreen(candidate)
      if (!projected) continue
      const dx = projected.x - source.x
      const dy = projected.y - source.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq <= bestDistanceSq) {
        bestDistanceSq = distanceSq
        best = [candidate[0], candidate[1]]
      }
    }
    if (!isSamePoint(best, point)) {
      triggerSnapHint()
    }
    return best
  }

  function hideContextMenu() {
    options.contextMenu.value.visible = false
  }

  function hideHoverLengthHint() {
    options.hoverLengthHint.value.visible = false
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
      hoverHintTimer = null
    }
  }

  function showHoverLengthHint(screenPosition: Cesium.Cartesian2, lineIndex: number) {
    const line = options.draftLines.value[lineIndex]
    if (!line || line.length < 2) {
      hideHoverLengthHint()
      return
    }
    options.hoverLengthHint.value = {
      visible: true,
      x: Math.round(screenPosition.x) + 12,
      y: Math.round(screenPosition.y) - 14,
      text: `长度：${lineLengthMeters(line).toFixed(1)} m`,
    }
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
    }
    hoverHintTimer = setTimeout(() => {
      options.hoverLengthHint.value.visible = false
      hoverHintTimer = null
    }, 2000)
  }

  function syncHoveredLine(nextLineIndex: number | null) {
    if (options.hoveredLineIndex.value === nextLineIndex) return
    options.hoveredLineIndex.value = nextLineIndex
    if (!options.getGraphicLayer()) {
      options.renderDraftGraphics()
    }
  }

  function pickEntity(screenPosition: Cesium.Cartesian2 | undefined) {
    const viewer = options.getViewer()
    if (!viewer || !screenPosition) return null
    const picked = viewer.scene.pick(screenPosition)
    if (!picked || !Cesium.defined(picked)) return null
    const id = (picked as any).id
    if (id instanceof Cesium.Entity) return id
    return null
  }

  function toWindowPosition(point: Point) {
    const viewer = options.getViewer()
    if (!viewer) return null
    const screen = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, options.toCartesian(point))
    if (!screen) return null
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null
    return screen
  }

  function findNearestLineMeta(screenPosition: Cesium.Cartesian2, thresholdPx = 12): PipeLineMeta | null {
    let bestMeta: PipeLineMeta | null = null
    let bestDistSq = thresholdPx * thresholdPx
    for (let lineIndex = 0; lineIndex < options.draftLines.value.length; lineIndex += 1) {
      const line = options.draftLines.value[lineIndex]
      for (let segmentIndex = 0; segmentIndex < line.length - 1; segmentIndex += 1) {
        const a = toWindowPosition(line[segmentIndex])
        const b = toWindowPosition(line[segmentIndex + 1])
        if (!a || !b) continue
        const distSq = pointToSegmentDistanceSquared(screenPosition, a, b)
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          bestMeta = { lineIndex }
        }
      }
    }
    return bestMeta
  }

  function stopDragging() {
    if (options.draggingNodeId.value) {
      ignoreNextClick = true
      if (options.pushGraphHistory) options.pushGraphHistory()
    }
    options.draggingNodeId.value = null
    options.setCameraControlsEnabled(true)
    options.clearDragReleaseFallback()
  }

  function insertPointAtCanvasCenter() {
    const viewer = options.getViewer()
    if (!viewer || !options.selectedFeature.value || options.saving.value) return
    const center = new Cesium.Cartesian2(
      Math.round(viewer.canvas.clientWidth / 2),
      Math.round(viewer.canvas.clientHeight / 2),
    )
    insertPointAtScreenPosition(center.x, center.y)
  }

  function insertPointAtScreenPosition(x: number, y: number) {
    if (!options.selectedFeature.value || options.saving.value) return false
    const screen = new Cesium.Cartesian2(Math.round(x), Math.round(y))
    const point = options.screenToLonLat(screen)
    if (!point) return false
    // 找最近的边，调用 insertNodeOnEdge
    if (options.insertNodeOnEdge) {
      // 找最近的 Graph Edge（用图的 sourceId/targetId 查坐标）
      // 降级：找最近的 Lines 折线段
      const snapped = applyEndpointSnap(point, screen)
      insertNodeOnLines(snapped)
    }
    return true
  }

  function insertNodeOnLines(point: Point) {
    if (!options.insertNodeOnEdge) return
    // 找 draftLines 中最近的边，映射到 edgeId（简化：直接找离 point 最近的 line segment）
    let bestEdgeId: string | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    // 通过 graph 找最近的边
    // 实现：调用 options.insertNodeOnEdge with nearest edge
    // 我们需要 draftLines 来找最近 segment，但 edgeId 需要从 graph 获取
    // 注：此处通过 pickGraphEntity 来处理（用户点击线段）
    // 对于 canvas center 插入，退化处理：不实现（暂保留空实现）
  }

  function toggleDeletePointMode() {
    if (!options.deletePointMode.value) {
      options.addPointMode.value = false
    }
    options.deletePointMode.value = !options.deletePointMode.value
    options.startEditingActiveLine()
  }

  function toggleAddPointMode() {
    if (!options.addPointMode.value) {
      options.deletePointMode.value = false
    }
    options.addPointMode.value = !options.addPointMode.value
    options.startEditingActiveLine()
  }

  function handleHoverHint(screenPosition: Cesium.Cartesian2) {
    if (options.draggingNodeId.value) {
      hideHoverLengthHint()
      return
    }
    const pickedEntity = pickEntity(screenPosition)
    const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(screenPosition, SELECT_LINE_THRESHOLD)
    if (lineMeta) {
      syncHoveredLine(lineMeta.lineIndex)
      showHoverLengthHint(screenPosition, lineMeta.lineIndex)
      return
    }
    syncHoveredLine(null)
    hideHoverLengthHint()
  }

  function queueHoverHint(screenPosition: Cesium.Cartesian2) {
    if (typeof window === 'undefined') return
    pendingHoverPosition = new Cesium.Cartesian2(screenPosition.x, screenPosition.y)
    if (hoverRafId !== null) return
    hoverRafId = window.requestAnimationFrame(() => {
      hoverRafId = null
      const next = pendingHoverPosition
      pendingHoverPosition = null
      if (!next) return
      handleHoverHint(next)
    })
  }

  function undoLast() {
    const prev = options.history.value.pop()
    if (!prev) return
    options.redoHistory.value.push(cloneLines(options.draftLines.value))
    options.draftLines.value = cloneLines(prev)
    options.clearGraphSelection?.()
    hideContextMenu()
    options.renderDraftGraphics()
  }

  function redoLast() {
    const next = options.redoHistory.value.pop()
    if (!next) return
    options.history.value.push(cloneLines(options.draftLines.value))
    if (options.history.value.length > 10) options.history.value.shift()
    options.draftLines.value = cloneLines(next)
    options.clearGraphSelection?.()
    hideContextMenu()
    options.renderDraftGraphics()
  }

  function restoreFromHistory(index: number) {
    if (index < 0 || index >= options.history.value.length) return
    const target = options.history.value[index]
    const current = cloneLines(options.draftLines.value)
    const newer = options.history.value
      .slice(index + 1)
      .map(snapshot => cloneLines(snapshot))
    newer.push(current)
    options.redoHistory.value = newer
    options.history.value = options.history.value
      .slice(0, index)
      .map(snapshot => cloneLines(snapshot))
    options.draftLines.value = cloneLines(target)
    options.clearGraphSelection?.()
    hideContextMenu()
    options.renderDraftGraphics()
  }

  function resetDraft() {
    options.draftLines.value = cloneLines(options.originalLines.value)
    options.history.value = []
    options.redoHistory.value = []
    options.clearGraphSelection?.()
    options.addPointMode.value = false
    options.deletePointMode.value = false
    hideContextMenu()
    options.actionMessage.value = null
    options.renderDraftGraphics()
  }

  function deleteSelectedPoint() {
    const sel = options.graphSelected?.value
    if (!sel || sel.kind !== 'node') return
    if (options.removeNodeMergeEdge) {
      options.removeNodeMergeEdge(sel.nodeId)
      hideContextMenu()
      options.renderDraftGraphics()
    }
  }

  function endEditing() {
    options.draggingNodeId.value = null
    options.clearGraphSelection?.()
    options.addPointMode.value = false
    options.deletePointMode.value = false
    hideContextMenu()
    hideHoverLengthHint()
    options.setCameraControlsEnabled(true)
    options.renderDraftGraphics()
  }

  function openContextMenu(screenPosition: Cesium.Cartesian2) {
    const viewer = options.getViewer()
    if (!viewer) return

    const pickedEntity = pickEntity(screenPosition)
    const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(screenPosition, SELECT_LINE_THRESHOLD)
    const point = options.screenToLonLat(screenPosition)
    contextMenuPoint = point

    const graphHit = options.pickGraphEntity({ x: screenPosition.x, y: screenPosition.y })
    if (graphHit?.type === 'node') {
      options.selectGraphNode(graphHit.nodeId)
      options.renderDraftGraphics()
    } else if (lineMeta) {
      options.activeLineIndex.value = lineMeta.lineIndex
      options.renderDraftGraphics()
    }

    const activeLine = options.draftLines.value[options.activeLineIndex.value]
    const canInsert = Boolean(point && activeLine && activeLine.length >= 2)
    const sel = options.graphSelected?.value
    const canDelete = sel?.kind === 'node'

    const rect = viewer.canvas.getBoundingClientRect()
    const x = Math.max(6, Math.min(screenPosition.x, rect.width - 170))
    const y = Math.max(6, Math.min(screenPosition.y, rect.height - 126))

    options.contextMenu.value = {
      visible: true,
      x,
      y,
      canInsert,
      canDelete,
    }
  }

  function insertPointFromContextMenu() {
    if (!contextMenuPoint) return
    // 插点操作通过 addPointMode + 点击实现，右键菜单暂不支持精确插点
    hideContextMenu()
  }

  function deletePointFromContextMenu() {
    deleteSelectedPoint()
    hideContextMenu()
  }

  function shouldIgnoreShortcutTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null
    if (!el) return false
    const tag = el.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (el.isContentEditable) return true
    return false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!options.open.value || options.saving.value) return
    if (shouldIgnoreShortcutTarget(event.target)) return

    const key = event.key.toLowerCase()
    const isMod = event.metaKey || event.ctrlKey
    if (isMod && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undoLast()
      return
    }
    if ((isMod && key === 'y') || (isMod && key === 'z' && event.shiftKey)) {
      event.preventDefault()
      redoLast()
      return
    }
    if (key === 'escape') {
      event.preventDefault()
      const hasTraditionalEdit = options.addPointMode.value
        || options.deletePointMode.value
        || options.draggingNodeId.value !== null
        || options.addNodeMode.value

      const isMindmapActiveMode = (options.mindmapModeType?.value ?? 'idle') !== 'idle'
      const hasMindmapSelection =
        (options.mindmapSelectedNodeIds?.value.size ?? 0) > 0 ||
        (options.mindmapSelectedEdgeIds?.value.size ?? 0) > 0

      if (hasTraditionalEdit) {
        if (options.addNodeMode.value) {
          options.addNodeMode.value = false
        }
        endEditing()
      } else if (isMindmapActiveMode || hasMindmapSelection) {
        return
      }
      return
    }
    if (key === 'i') {
      event.preventDefault()
      toggleAddPointMode()
      return
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      deleteSelectedPoint()
    }
  }

  function bindMapEvents() {
    const viewer = options.getViewer()
    if (!viewer || handler) return
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      // 拖拽节点时实时更新坐标
      if (options.draggingNodeId.value && options.moveGraphNode) {
        const newPos = options.screenToLonLat(movement.endPosition)
        if (newPos) {
          options.moveGraphNode(options.draggingNodeId.value, newPos[0], newPos[1])
          options.renderDraftGraphics()
        }
      }
      queueHoverHint(movement.endPosition)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      // LEFT_DOWN：检测是否点中图节点，开始拖拽
      const graphHit = options.pickGraphEntity({ x: movement.position.x, y: movement.position.y })
      if (graphHit?.type === 'node') {
        options.draggingNodeId.value = graphHit.nodeId
        options.setCameraControlsEnabled(false)
        options.installDragReleaseFallback()
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

    handler.setInputAction(() => {
      if (options.draggingNodeId.value) {
        stopDragging()
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      hideContextMenu()
      if (ignoreNextClick) {
        ignoreNextClick = false
        return
      }

      const pickedEntity = pickEntity(movement.position)
      const graphHit = options.pickGraphEntity({ x: movement.position.x, y: movement.position.y })

      if (options.deletePointMode.value) {
        if (graphHit?.type === 'node' && options.removeNodeMergeEdge) {
          options.removeNodeMergeEdge(graphHit.nodeId)
          options.renderDraftGraphics()
        }
        return
      }

      if (options.addNodeMode.value && !options.saving.value && options.selectedFeature.value) {
        options.placeGraphNodeAtScreen(movement.position.x, movement.position.y)
        return
      }

      if (options.addPointMode.value && !options.saving.value && options.selectedFeature.value) {
        if (graphHit?.type === 'edge' && options.insertNodeOnEdge) {
          const point = options.screenToLonLat(movement.position)
          if (point) {
            const snapped = applyEndpointSnap(point, movement.position)
            options.insertNodeOnEdge(graphHit.edgeId, snapped[0], snapped[1])
            options.renderDraftGraphics()
          }
        }
        return
      }

      // 统一图节点/边选中（所有折点都是图节点）
      if (graphHit?.type === 'node') {
        options.selectGraphNode(graphHit.nodeId)
        options.renderDraftGraphics()
        return
      }
      if (graphHit?.type === 'edge') {
        options.selectGraphEdge(graphHit.edgeId)
        options.renderDraftGraphics()
        return
      }

      const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(movement.position, SELECT_LINE_THRESHOLD)
      if (lineMeta) {
        options.activeLineIndex.value = lineMeta.lineIndex
        options.startEditingActiveLine()
        options.renderDraftGraphics()
        return
      }

      // 点击空白区域：清除选中
      options.clearGraphSelection?.()
      options.renderDraftGraphics()
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (options.saving.value) return
      openContextMenu(movement.position)
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  function destroyInteractions() {
    hideContextMenu()
    hideHoverLengthHint()
    options.snapHintVisible.value = false
    options.hoveredLineIndex.value = null
    contextMenuPoint = null
    ignoreNextClick = false
    options.clearDragReleaseFallback()
    if (hoverRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(hoverRafId)
      hoverRafId = null
    }
    pendingHoverPosition = null
    if (snapHintTimer) {
      clearTimeout(snapHintTimer)
      snapHintTimer = null
    }
    if (hoverHintTimer) {
      clearTimeout(hoverHintTimer)
      hoverHintTimer = null
    }
    if (handler) {
      handler.destroy()
      handler = null
    }
  }

  return {
    hideContextMenu,
    stopDragging,
    insertPointAtCanvasCenter,
    insertPointAtScreenPosition,
    toggleDeletePointMode,
    toggleAddPointMode,
    undoLast,
    redoLast,
    restoreFromHistory,
    resetDraft,
    deleteSelectedPoint,
    endEditing,
    insertPointFromContextMenu,
    deletePointFromContextMenu,
    handleKeydown,
    bindMapEvents,
    destroyInteractions,
  }
}
