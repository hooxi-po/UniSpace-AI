import * as Cesium from 'cesium'
import { type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import { cloneLines, distanceToSegmentSquared, isSamePoint, type Lines, type Point } from '~/utils/pipe2d-geometry'
import {
  lineLengthMeters,
  lineMetaOf,
  pointMetaOf,
  pointToSegmentDistanceSquared,
  SELECT_LINE_THRESHOLD,
  SELECT_POINT_THRESHOLD,
  SNAP_PIXEL_THRESHOLD,
  type ContextMenuState,
  type HoverLengthHint,
  type PipeLineMeta,
  type PipePointMeta,
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
  selectedPoint: Ref<PipePointMeta | null>
  dragging: Ref<PipePointMeta | null>
  addPointMode: Ref<boolean>
  deletePointMode: Ref<boolean>
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
  let contextMenuPointMeta: PipePointMeta | null = null

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

  function findNearestPointMeta(screenPosition: Cesium.Cartesian2, thresholdPx = 16): PipePointMeta | null {
    let bestMeta: PipePointMeta | null = null
    let bestDistSq = thresholdPx * thresholdPx
    for (let lineIndex = 0; lineIndex < options.draftLines.value.length; lineIndex += 1) {
      const line = options.draftLines.value[lineIndex]
      for (let pointIndex = 0; pointIndex < line.length; pointIndex += 1) {
        const win = toWindowPosition(line[pointIndex])
        if (!win) continue
        const dx = win.x - screenPosition.x
        const dy = win.y - screenPosition.y
        const distSq = dx * dx + dy * dy
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          bestMeta = { lineIndex, pointIndex }
        }
      }
    }
    return bestMeta
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

  function selectPoint(lineIndex: number, pointIndex: number) {
    options.activeLineIndex.value = lineIndex
    options.selectedPoint.value = { lineIndex, pointIndex }
    options.renderDraftGraphics()
    options.startEditingActiveLine()
  }

  function stopDragging() {
    if (options.dragging.value) {
      ignoreNextClick = true
    }
    options.dragging.value = null
    options.setCameraControlsEnabled(true)
    options.clearDragReleaseFallback()
  }

  function insertPointAtBestSegment(point: Point) {
    let bestLineIndex = -1
    let bestSegmentIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY

    options.draftLines.value.forEach((line, lineIndex) => {
      if (!line || line.length < 2) return
      for (let index = 0; index < line.length - 1; index += 1) {
        const distance = distanceToSegmentSquared(point, line[index], line[index + 1])
        if (distance < bestDistance) {
          bestDistance = distance
          bestLineIndex = lineIndex
          bestSegmentIndex = index
        }
      }
    })

    if (bestLineIndex < 0 || bestSegmentIndex < 0) return
    const line = options.draftLines.value[bestLineIndex]
    if (!line) return

    options.pushHistory()
    line.splice(bestSegmentIndex + 1, 0, point)
    options.activeLineIndex.value = bestLineIndex
    options.selectedPoint.value = { lineIndex: bestLineIndex, pointIndex: bestSegmentIndex + 1 }
    options.renderDraftGraphics()
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
    insertPointAtBestSegment(applyEndpointSnap(point, screen))
    return true
  }

  function deletePointByMeta(meta: PipePointMeta) {
    const line = options.draftLines.value[meta.lineIndex]
    if (!line || line.length <= 2) return
    options.pushHistory()
    line.splice(meta.pointIndex, 1)
    options.selectedPoint.value = null
    options.renderDraftGraphics()
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
    if (options.dragging.value) {
      hideHoverLengthHint()
      return
    }
    const pickedEntity = pickEntity(screenPosition)
    const pointMeta = pointMetaOf(pickedEntity) || findNearestPointMeta(screenPosition, SELECT_POINT_THRESHOLD)
    if (pointMeta) {
      syncHoveredLine(pointMeta.lineIndex)
      showHoverLengthHint(screenPosition, pointMeta.lineIndex)
      return
    }
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
    options.selectedPoint.value = null
    hideContextMenu()
    options.renderDraftGraphics()
  }

  function redoLast() {
    const next = options.redoHistory.value.pop()
    if (!next) return
    options.history.value.push(cloneLines(options.draftLines.value))
    if (options.history.value.length > 10) options.history.value.shift()
    options.draftLines.value = cloneLines(next)
    options.selectedPoint.value = null
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
    options.selectedPoint.value = null
    hideContextMenu()
    options.renderDraftGraphics()
  }

  function resetDraft() {
    options.draftLines.value = cloneLines(options.originalLines.value)
    options.history.value = []
    options.redoHistory.value = []
    options.selectedPoint.value = null
    options.addPointMode.value = false
    options.deletePointMode.value = false
    hideContextMenu()
    options.actionMessage.value = null
    options.renderDraftGraphics()
  }

  function deleteSelectedPoint() {
    if (!options.selectedPoint.value) return
    const { lineIndex, pointIndex } = options.selectedPoint.value
    const line = options.draftLines.value[lineIndex]
    if (!line || line.length <= 2) return
    options.pushHistory()
    line.splice(pointIndex, 1)
    options.selectedPoint.value = null
    hideContextMenu()
    options.renderDraftGraphics()
  }

  function endEditing() {
    options.dragging.value = null
    options.selectedPoint.value = null
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
    const pointMeta = pointMetaOf(pickedEntity) || findNearestPointMeta(screenPosition, SELECT_POINT_THRESHOLD)
    const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(screenPosition, SELECT_LINE_THRESHOLD)
    const point = options.screenToLonLat(screenPosition)
    contextMenuPoint = point
    contextMenuPointMeta = pointMeta

    if (pointMeta) {
      selectPoint(pointMeta.lineIndex, pointMeta.pointIndex)
    } else if (lineMeta) {
      options.activeLineIndex.value = lineMeta.lineIndex
      options.renderDraftGraphics()
    }

    const activeLine = options.draftLines.value[options.activeLineIndex.value]
    const canInsert = Boolean(point && activeLine && activeLine.length >= 2)
    const canDeleteFromMeta = pointMeta
      ? ((options.draftLines.value[pointMeta.lineIndex]?.length || 0) > 2)
      : false

    const rect = viewer.canvas.getBoundingClientRect()
    const x = Math.max(6, Math.min(screenPosition.x, rect.width - 170))
    const y = Math.max(6, Math.min(screenPosition.y, rect.height - 126))

    options.contextMenu.value = {
      visible: true,
      x,
      y,
      canInsert,
      canDelete: canDeleteFromMeta || Boolean(options.selectedPoint.value && canDeleteFromMeta),
    }
  }

  function insertPointFromContextMenu() {
    if (!contextMenuPoint) return
    insertPointAtBestSegment(contextMenuPoint)
    hideContextMenu()
  }

  function deletePointFromContextMenu() {
    if (contextMenuPointMeta) {
      const line = options.draftLines.value[contextMenuPointMeta.lineIndex]
      if (line && line.length > 2) {
        deletePointByMeta(contextMenuPointMeta)
      }
      hideContextMenu()
      return
    }
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
      // 优先取消当前编辑状态，而不是关闭整个编辑器
      // 检查是否有活动的编辑状态：
      // 1. 传统编辑模式（插点/删点/选点）
      // 2. 思维导图模式（当前 mode 非 idle，或存在选中）
      const hasTraditionalEdit = options.addPointMode.value
        || options.deletePointMode.value
        || options.selectedPoint.value !== null

      const isMindmapActiveMode = (options.mindmapModeType?.value ?? 'idle') !== 'idle'
      const hasMindmapSelection =
        (options.mindmapSelectedNodeIds?.value.size ?? 0) > 0 ||
        (options.mindmapSelectedEdgeIds?.value.size ?? 0) > 0

      if (hasTraditionalEdit) {
        // 取消传统编辑状态
        endEditing()
      } else if (isMindmapActiveMode || hasMindmapSelection) {
        // 思维导图状态由 useMindmapEditorEvents 处理，这里禁止关闭对话框
        return
      } else if (options.requestClose) {
        // 只有在完全空闲状态下才允许关闭编辑器
        options.requestClose()
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
      queueHoverHint(movement.endPosition)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => {
      if (options.dragging.value) {
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
      const pointMeta = pointMetaOf(pickedEntity) || findNearestPointMeta(movement.position, SELECT_POINT_THRESHOLD)

      if (options.deletePointMode.value) {
        if (pointMeta) {
          deletePointByMeta(pointMeta)
        }
        return
      }

      if (options.addPointMode.value && !options.saving.value && options.selectedFeature.value) {
        const point = options.screenToLonLat(movement.position)
        if (!point) return
        const snappedPoint = applyEndpointSnap(point, movement.position)
        insertPointAtBestSegment(snappedPoint)
        return
      }

      if (pointMeta) {
        selectPoint(pointMeta.lineIndex, pointMeta.pointIndex)
        return
      }

      const lineMeta = lineMetaOf(pickedEntity) || findNearestLineMeta(movement.position, SELECT_LINE_THRESHOLD)
      if (lineMeta) {
        options.activeLineIndex.value = lineMeta.lineIndex
        options.startEditingActiveLine()
        options.renderDraftGraphics()
        return
      }

      options.selectedPoint.value = null
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
    contextMenuPointMeta = null
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
    selectPoint,
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
