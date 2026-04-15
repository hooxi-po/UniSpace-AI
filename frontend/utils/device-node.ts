/**
 * device-node.ts
 *
 * 设备节点类型定义和辅助函数
 * 设备节点在 Lines 中表示为单点线段（length === 1）
 */

import type { Lines } from './pipe2d-geometry'

export type DeviceNodeType = 'default' | 'manhole' | 'valve' | 'pump' | 'meter'

export type DeviceNodeMeta = {
  lineIndex: number
  type: DeviceNodeType
  label?: string

  // 窨井专有属性
  manholeType?: 'inspection' | 'drainage' | 'cable' | 'other'
  manholeNo?: string
  depth?: number
  diameter?: number
  material?: string
  coverType?: string

  // 阀门专有属性
  valveType?: 'gate' | 'ball' | 'butterfly' | 'check'
  valveNo?: string
  valveSize?: number
  valveStatus?: 'open' | 'closed' | 'partial'

  // 泵站专有属性
  pumpCapacity?: number
  pumpPower?: number
  pumpHead?: number
  pumpStatus?: 'running' | 'stopped' | 'maintenance'

  // 测点专有属性
  sensorType?: 'pressure' | 'flow' | 'temperature' | 'level'
  sensorId?: string
  meterNo?: string
  meterDiameter?: number

  // 通用属性
  elevation?: number
  installDate?: string
  status?: 'normal' | 'warning' | 'error'
  notes?: string

  [key: string]: unknown
}

/**
 * 判断指定 lineIndex 的线段是否是设备节点（单点线段）
 */
export function isDeviceNode(lines: Lines, lineIndex: number): boolean {
  const line = lines[lineIndex]
  return line && line.length === 1
}

/**
 * 从 properties.deviceNodes 中获取设备节点元数据
 */
export function getDeviceNodeMeta(
  deviceNodes: DeviceNodeMeta[] | undefined,
  lineIndex: number
): DeviceNodeMeta | undefined {
  return deviceNodes?.find(n => n.lineIndex === lineIndex)
}

/**
 * 设备节点类型对应的颜色
 */
export const DEVICE_NODE_COLORS: Record<DeviceNodeType, string> = {
  default: '#6366f1',
  manhole: '#10b981',
  valve: '#f59e0b',
  pump: '#3b82f6',
  meter: '#8b5cf6',
}

/**
 * 设备节点类型对应的标签
 */
export const DEVICE_NODE_LABELS: Record<DeviceNodeType, string> = {
  default: '●',
  manhole: '井',
  valve: '阀',
  pump: '泵',
  meter: '表',
}
