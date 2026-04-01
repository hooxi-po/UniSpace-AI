import * as Cesium from 'cesium'
import { watch, type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import type { PipeGraph } from '~/utils/pipe2d-graph'
import { autoControlPoints, graphToLines, sampleCubicBezier } from '~/utils/pipe2d-graph'
import { cloneLines, type Lines, type Point } from '~/utils/pipe2d-geometry'
import type { SelectedElement } from '~/composables/admin/usePipe2DEditorGraph'
import {
  getChangedPointIndex,
  getNearestPointIndex,
  lineIndexOfGraphic,
  resolvePipeBaseColor,
  toLineFromGraphic,
  toLonLat,
} from './pipe2d-editor-map-shared'

// 节点类型颜色映射
const NODE_TYPE_COLORS: Record<string, string> = {
  default:  '#6366f1',
  valve:    '#f59e0b',
  manhole:  '#10b981',
  pump:     '#3b82f6',
  meter:    '#8b5cf6',
  junction: '#ef4444',
}

// 节点类型标签（用于 label billboard）
const NODE_TYPE_LABELS: Record<string, string> = {
  default:  '●',
  valve:    '阀',
  manhole:  '井',
  pump:     '泵',
  meter:    '表',
  junction: 'T',
}

type UsePipe2DEditorMapGraphicsOptions = {
  getViewer: () => Cesium.Viewer | null
  getGraphicLayer: () => any | null
  getMars3dLib: () => any | null
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  draftLines: Ref<Lines>
  activeLineIndex: Ref<number>
  hoveredLineIndex: Ref<number | null>
  setSkipDraftLinesWatch: (next: boolean) => void
  draggingNodeId: Ref<string | null>
  setCameraControlsEnabled: (enabled: boolean) => void
  clearDragReleaseFallback: () => void
  installDragReleaseFallback: () => void
  pushHistory: () => void
  toCartesian: (point: Point) => Cesium.Cartesian3
  // 图结构（Phase 2/3 新增，可选以保持向后兼容）
  graph?: Ref<PipeGraph>
  graphSelected?: Ref<SelectedElement>
  previewTarget?: Ref<Point | null>
  connectSourceId?: Ref<string | null>
  // 思维导图编辑器选中状态（Phase 3 新增）
  mindmapSelectedNodeIds?: Ref<Set<string>>
  mindmapSelectedEdgeIds?: Ref<Set<string>>
  mindmapHoveredNodeId?: Ref<string | null>
  mindmapHoveredEdgeId?: Ref<string | null>
}

export function usePipe2DEditorMapGraphics(options: UsePipe2DEditorMapGraphicsOptions) {
  const lineGraphicMap = new Map<number, any>()
  const currentLineEntities: Cesium.Entity[] = []
  let layerEventsBound = false
  let dragEditHistoryPushed = false
  let dragEditStartLines: Lines | null = null

  // ---- 图节点/边/预览线实体列表 ----
  const currentGraphNodeEntities: Cesium.Entity[] = []
  const currentGraphEdgeEntities: Cesium.Entity[] = []
  let previewLineEntity: Cesium.Entity | null = null

  // ---- 防抖渲染优化 ----
  let syncRafId: number | null = null
  let pendingSyncEvent: any = null

  function clearGraphEntities() {
    const viewer = options.getViewer()
    if (!viewer) return
    for (const e of currentGraphNodeEntities) viewer.entities.remove(e)
    for (const e of currentGraphEdgeEntities) viewer.entities.remove(e)
    if (previewLineEntity) {
      viewer.entities.remove(previewLineEntity)
      previewLineEntity = null
    }
    currentGraphNodeEntities.length = 0
    currentGraphEdgeEntities.length = 0
  }

  function clearGraphics() {
    // 取消待处理的防抖更新
    if (syncRafId !== null) {
      cancelAnimationFrame(syncRafId)
      syncRafId = null
      pendingSyncEvent = null
    }

    const graphicLayer = options.getGraphicLayer()
    if (graphicLayer && typeof graphicLayer.clear === 'function') {
      graphicLayer.clear(true)
      lineGraphicMap.clear()
    }
    const viewer = options.getViewer()
    if (!viewer) return
    for (const entity of currentLineEntities) {
      viewer.entities.remove(entity)
    }
    currentLineEntities.length = 0
    clearGraphEntities()
  }

  function startEditingActiveLine() {
    const activeGraphic = lineGraphicMap.get(options.activeLineIndex.value)
    const graphicLayer = options.getGraphicLayer()
    if (graphicLayer && activeGraphic && typeof graphicLayer.startEditing === 'function') {
      graphicLayer.startEditing(activeGraphic)
    }
  }

  function syncDraftLinesFromLayer() {
    if (!options.getGraphicLayer()) return
    const nextLines: Lines = []
    for (const [lineIndex, graphic] of lineGraphicMap.entries()) {
      if (!graphic) continue
      const line = toLineFromGraphic(graphic)
      if (line.length >= 2) {
        nextLines[lineIndex] = line
      }
    }
    const normalized = nextLines.filter((line): line is Point[] => Array.isArray(line) && line.length >= 2)
    if (!normalized.length) return
    options.setSkipDraftLinesWatch(true)
    options.draftLines.value = cloneLines(normalized)
  }

  function renderGraphNodeEntities() {
    if (!options.graph) return
    const viewer = options.getViewer()
    if (!viewer) return
    const graph = options.graph.value
    const selected = options.graphSelected?.value

    // 清除旧的节点实体，避免重复渲染泄漏
    for (const entity of currentGraphNodeEntities) {
      viewer.entities.remove(entity)
    }
    currentGraphNodeEntities.length = 0

    // 思维导图选中状态
    const mindmapSelectedIds = options.mindmapSelectedNodeIds?.value || new Set<string>()
    const mindmapHoveredId = options.mindmapHoveredNodeId?.value

    for (const node of graph.nodes) {
      const color = NODE_TYPE_COLORS[node.type] || NODE_TYPE_COLORS.default

      // 检查选中状态（支持传统选中和思维导图多选）
      const isTraditionalSelected = selected?.kind === 'node' && selected.nodeId === node.id
      const isMindmapSelected = mindmapSelectedIds.has(node.id)
      const isHovered = mindmapHoveredId === node.id
      const isSelected = isTraditionalSelected || isMindmapSelected

      // 小圆点样式（和 Lines 点一致）
      const visibleSize = isSelected ? 11 : 10
      const outlineWidth = isSelected ? 2 : 1.5
      const outlineColor = isSelected
        ? Cesium.Color.fromCssColorString('#fbbf24')  // 选中时金色轮廓
        : Cesium.Color.fromCssColorString('#e2e8f0')

      // 透明点击区域（扩大点击范围）
      const hitArea = viewer.entities.add({
        position: options.toCartesian([node.lon, node.lat]),
        point: {
          pixelSize: isSelected ? 20 : 18,
          color: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.01),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          graphNodeId: node.id,
        },
      })
      currentGraphNodeEntities.push(hitArea)

      // 主节点圆点
      const circle = viewer.entities.add({
        position: options.toCartesian([node.lon, node.lat]),
        point: {
          pixelSize: visibleSize,
          color: Cesium.Color.fromCssColorString(color),
          outlineColor,
          outlineWidth,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          graphNodeId: node.id,
        },
      })
      currentGraphNodeEntities.push(circle)

      // 节点标签（仅在选中或有自定义标签时显示）
      const hasCustomLabel = node.attributes.label && node.attributes.label !== NODE_TYPE_LABELS[node.type]
      if (isSelected || hasCustomLabel) {
        const label = node.attributes.label || NODE_TYPE_LABELS[node.type] || NODE_TYPE_LABELS.default
        const text = viewer.entities.add({
          position: options.toCartesian([node.lon, node.lat]),
          label: {
            text: label,
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: {
            graphNodeId: node.id,
          },
        })
        currentGraphNodeEntities.push(text)
      }
    }
  }

  function renderGraphEdgeEntities() {
    if (!options.graph) return
    const viewer = options.getViewer()
    if (!viewer) return
    const graph = options.graph.value
    const selected = options.graphSelected?.value

    // 清除旧的边实体，避免重复渲染泄漏
    for (const entity of currentGraphEdgeEntities) {
      viewer.entities.remove(entity)
    }
    currentGraphEdgeEntities.length = 0

    // 思维导图选中状态
    const mindmapSelectedIds = options.mindmapSelectedEdgeIds?.value || new Set<string>()
    const mindmapHoveredId = options.mindmapHoveredEdgeId?.value

    for (const edge of graph.edges) {
      const srcNode = graph.nodes.find(n => n.id === edge.sourceId)
      const tgtNode = graph.nodes.find(n => n.id === edge.targetId)
      if (!srcNode || !tgtNode) continue

      // 检查选中状态
      const isTraditionalSelected = selected?.kind === 'edge' && selected.edgeId === edge.id
      const isMindmapSelected = mindmapSelectedIds.has(edge.id)
      const isHovered = mindmapHoveredId === edge.id
      const isSelected = isTraditionalSelected || isMindmapSelected

      let positions: Point[]

      if (edge.edgeType === 'curve' && edge.controlPoints?.length === 2) {
        const p0: Point = [srcNode.lon, srcNode.lat]
        const p3: Point = [tgtNode.lon, tgtNode.lat]
        const cp1: Point = edge.controlPoints[0]
        const cp2: Point = edge.controlPoints[1]
        positions = sampleCubicBezier(p0, cp1, cp2, p3, 32)
      } else {
        positions = [[srcNode.lon, srcNode.lat], [tgtNode.lon, tgtNode.lat]]
      }

      // 根据状态调整视觉效果
      const width = isSelected ? 6 : (isHovered ? 4 : 3)
      const color = isSelected ? '#6366f1' : (isHovered ? '#818cf8' : '#94a3b8')
      const alpha = isSelected ? 1.0 : (isHovered ? 0.9 : 0.8)

      // 选中时添加底层光晕
      if (isSelected) {
        const haloPolyline = viewer.entities.add({
          polyline: {
            positions: positions.map(options.toCartesian),
            width: 12,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
            clampToGround: true,
          },
          properties: {
            graphEdgeId: edge.id,
            isHalo: true,
          },
        })
        currentGraphEdgeEntities.push(haloPolyline)
      }

      // 主边线
      const polyline = viewer.entities.add({
        polyline: {
          positions: positions.map(options.toCartesian),
          width,
          material: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
          clampToGround: true,
        },
        properties: {
          graphEdgeId: edge.id,
        },
      })
      currentGraphEdgeEntities.push(polyline)
    }
  }

  function renderPreviewLine() {
    if (!options.previewTarget || !options.connectSourceId || !options.graph) return
    const viewer = options.getViewer()
    if (!viewer) return
    const target = options.previewTarget.value
    const sourceId = options.connectSourceId.value
    if (!target || !sourceId) {
      if (previewLineEntity) {
        viewer.entities.remove(previewLineEntity)
        previewLineEntity = null
      }
      return
    }

    const srcNode = options.graph.value.nodes.find(n => n.id === sourceId)
    if (!srcNode) return

    if (previewLineEntity) viewer.entities.remove(previewLineEntity)
    previewLineEntity = viewer.entities.add({
      polyline: {
        positions: [options.toCartesian([srcNode.lon, srcNode.lat]), options.toCartesian(target)],
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#6366f1').withAlpha(0.6),
          dashLength: 8,
        }),
        clampToGround: true,
      },
    })
  }

  if (options.previewTarget) {
    watch(options.previewTarget, renderPreviewLine, { immediate: true })
  }

  function bindLayerEvents() {
    const graphicLayer = options.getGraphicLayer()
    const mars3dLib = options.getMars3dLib()
    if (!graphicLayer || !mars3dLib || layerEventsBound) return
    layerEventsBound = true
    const eventType = mars3dLib.EventType as Record<string, string>

    // Mars3D 图层点击：激活对应折线
    graphicLayer.on(eventType.click, (event: any) => {
      const lineIndex = lineIndexOfGraphic(event?.graphic)
      if (lineIndex < 0) return
      options.activeLineIndex.value = lineIndex
      if (typeof graphicLayer.startEditing === 'function' && event?.graphic) {
        graphicLayer.startEditing(event.graphic)
      }
      renderDraftGraphics()
    })
  }

  function renderDraftGraphics() {
    dragEditHistoryPushed = false
    dragEditStartLines = null
    clearGraphics()
    const baseColor = resolvePipeBaseColor(options.selectedFeature.value)
    const graphicLayer = options.getGraphicLayer()
    const mars3dLib = options.getMars3dLib()

    if (graphicLayer && mars3dLib) {
      options.draftLines.value.forEach((line, lineIndex) => {
        if (line.length < 2) return
        const activeLine = lineIndex === options.activeLineIndex.value
        const hoveredLine = options.hoveredLineIndex.value === lineIndex
        const graphic = new mars3dLib.graphic.PolylineEntity({
          positions: line.map((point) => [point[0], point[1], 0]),
          style: {
            width: activeLine || hoveredLine ? 4 : 3,
            color: activeLine || hoveredLine ? '#6366f1' : baseColor,
            opacity: 0.95,
            clampToGround: true,
          },
          attr: { lineIndex },
          hasEdit: false,
          hasMoveEdit: false,
          hasMidPoint: false,
        })
        ;(graphic as any).__pipeLineMeta = { lineIndex }
        if (graphic.entity) {
          ;(graphic.entity as any).__pipeLineMeta = { lineIndex }
        }
        graphicLayer.addGraphic(graphic)
        lineGraphicMap.set(lineIndex, graphic)
      })

      startEditingActiveLine()
      renderGraphEdgeEntities()
      renderGraphNodeEntities()
      return
    }

    const viewer = options.getViewer()
    if (!viewer) return

    options.draftLines.value.forEach((line, lineIndex) => {
      if (line.length < 2) return
      const activeLine = lineIndex === options.activeLineIndex.value
      const hoveredLine = options.hoveredLineIndex.value === lineIndex
      const lineEntity = viewer.entities.add({
        polyline: {
          positions: line.map(options.toCartesian),
          width: activeLine || hoveredLine ? 4 : 3,
          clampToGround: true,
          material: activeLine || hoveredLine
            ? new Cesium.PolylineGlowMaterialProperty({
              glowPower: activeLine ? 0.2 : 0.14,
              color: Cesium.Color.fromCssColorString('#6366f1').withAlpha(0.95),
            })
            : Cesium.Color.fromCssColorString(baseColor).withAlpha(0.95),
        },
      })
      ;(lineEntity as any).__pipeLineMeta = { lineIndex }
      currentLineEntities.push(lineEntity)

      const lineHitEntity = viewer.entities.add({
        polyline: {
          positions: line.map(options.toCartesian),
          width: activeLine || hoveredLine ? 14 : 12,
          clampToGround: true,
          material: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.01),
        },
      })
      ;(lineHitEntity as any).__pipeLineMeta = { lineIndex }
      currentLineEntities.push(lineHitEntity)
    })

    renderGraphEdgeEntities()
    renderGraphNodeEntities()
  }

  function resetGraphicsState() {
    // 取消待处理的防抖更新
    if (syncRafId !== null) {
      cancelAnimationFrame(syncRafId)
      syncRafId = null
      pendingSyncEvent = null
    }

    layerEventsBound = false
    dragEditHistoryPushed = false
    dragEditStartLines = null
    lineGraphicMap.clear()
    currentLineEntities.length = 0
    currentGraphNodeEntities.length = 0
    currentGraphEdgeEntities.length = 0
    previewLineEntity = null
  }

  // 监听思维导图选中状态变化，重新渲染
  if (options.mindmapSelectedNodeIds) {
    watch(options.mindmapSelectedNodeIds, () => {
      renderGraphNodeEntities()
    }, { deep: true })
  }

  if (options.mindmapSelectedEdgeIds) {
    watch(options.mindmapSelectedEdgeIds, () => {
      renderGraphEdgeEntities()
    }, { deep: true })
  }

  // 监听思维导图悬停状态变化，重新渲染
  if (options.mindmapHoveredNodeId) {
    watch(options.mindmapHoveredNodeId, () => {
      renderGraphNodeEntities()
    })
  }

  if (options.mindmapHoveredEdgeId) {
    watch(options.mindmapHoveredEdgeId, () => {
      renderGraphEdgeEntities()
    })
  }

  return {
    clearGraphics,
    bindLayerEvents,
    renderDraftGraphics,
    startEditingActiveLine,
    resetGraphicsState,
  }
}
