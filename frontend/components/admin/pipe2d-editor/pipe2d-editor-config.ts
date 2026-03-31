import {
  FileText,
  Hand,
  Home,
  Layers,
  Network,
  Plus,
  Search,
  Upload,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export type EditorMessage = {
  type: 'ok' | 'error'
  text: string
}

export type ViewMode = 'global' | 'underground' | 'topology2d' | 'sketch'
export type CanvasSkin = 'dots' | 'plain' | 'blueprint' | 'satellite'
export type ToolKey =
  | 'select'
  | 'addNode'
  | 'addPipe'
  | 'bindAsset'
  | 'annotate'
  | 'layer'
  | 'import'

export type PanelSectionKey = 'basic' | 'relation' | 'control' | 'realtime' | 'timeline' | 'runtime'

export type ToolbarDragState = {
  active: boolean
  toolKey: ToolKey | null
  clientX: number
  clientY: number
  startX: number
  startY: number
  moved: boolean
  overCanvas: boolean
}

export type ToolItem = {
  key: ToolKey
  icon: Component
  label: string
  tooltip: string
  shortcut: string
}

export const viewModeOptions: Array<{ key: ViewMode; label: string }> = [
  { key: 'global', label: '全域3D' },
  { key: 'underground', label: '地下切片' },
  { key: 'sketch', label: '平面草图' },
  { key: 'topology2d', label: '2D拓扑' },
]

export const toolItems: ToolItem[] = [
  { key: 'select', icon: Hand, label: '选择工具', tooltip: '选择工具', shortcut: 'V' },
  { key: 'addNode', icon: Plus, label: '创建节点', tooltip: '创建设备节点（窨井/阀门/泵站等）', shortcut: 'N' },
  { key: 'addPipe', icon: Network, label: '添加管线', tooltip: '添加管线', shortcut: 'P' },
  { key: 'bindAsset', icon: Home, label: '房产绑定', tooltip: '绑定房产', shortcut: 'B' },
  { key: 'annotate', icon: FileText, label: '批注', tooltip: '添加批注', shortcut: 'M' },
  { key: 'layer', icon: Layers, label: '图层', tooltip: '图层过滤', shortcut: 'L' },
  { key: 'import', icon: Upload, label: '导入', tooltip: '导入数据', shortcut: 'U' },
]

export const viewModeSet = new Set<ViewMode>(viewModeOptions.map(item => item.key))
export const toolKeySet = new Set<ToolKey>(toolItems.map(item => item.key))
export const defaultToolbarGhostIcon = Search

export const defaultPanelSectionCollapsed: Record<PanelSectionKey, boolean> = {
  basic: false,
  relation: false,
  control: false,
  realtime: false,
  timeline: false,
  runtime: true,
}

export function createEmptyToolbarDragState(): ToolbarDragState {
  return {
    active: false,
    toolKey: null,
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
    moved: false,
    overCanvas: false,
  }
}

