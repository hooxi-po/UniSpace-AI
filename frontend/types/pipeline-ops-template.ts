import type { PipelineMedium, PipelineOrderType, PipelinePriority } from './pipeline-ops'

export type PipelineWorkOrderTemplate = {
  id: string
  name: string
  description: string
  icon: string
  category: 'inspection' | 'maintenance' | 'retrofit' | 'retire'
  preset: {
    title: string
    description: string
    type: PipelineOrderType
    pipelineMedium: PipelineMedium
    priority: PipelinePriority
    area?: string
    assignee?: string
    reviewer?: string
  }
}

export const BUILTIN_TEMPLATES: PipelineWorkOrderTemplate[] = [
  {
    id: 'tpl-water-leak',
    name: '供水管道漏水',
    description: '供水管道发生漏水，需要紧急维修',
    icon: '💧',
    category: 'maintenance',
    preset: {
      title: '供水管道漏水维修',
      description: '管道漏水，需要立即处理以避免水资源浪费和影响供水',
      type: 'maintenance',
      pipelineMedium: 'water',
      priority: 'urgent',
    },
  },
  {
    id: 'tpl-water-burst',
    name: '供水管道爆裂',
    description: '供水管道爆裂，需要紧急抢修',
    icon: '🚨',
    category: 'maintenance',
    preset: {
      title: '供水管道爆裂紧急抢修',
      description: '管道爆裂，大量漏水，需要立即关闭阀门并进行抢修',
      type: 'maintenance',
      pipelineMedium: 'water',
      priority: 'urgent',
    },
  },
  {
    id: 'tpl-drainage-blockage',
    name: '排水管道堵塞',
    description: '排水管道堵塞，需要疏通',
    icon: '🚰',
    category: 'maintenance',
    preset: {
      title: '排水管道堵塞疏通',
      description: '排水不畅，管道堵塞，需要进行疏通作业',
      type: 'maintenance',
      pipelineMedium: 'drainage',
      priority: 'high',
    },
  },
  {
    id: 'tpl-sewage-overflow',
    name: '污水管道溢出',
    description: '污水管道溢出，需要紧急处理',
    icon: '⚠️',
    category: 'maintenance',
    preset: {
      title: '污水管道溢出紧急处理',
      description: '污水溢出，影响环境卫生，需要立即处理',
      type: 'maintenance',
      pipelineMedium: 'sewage',
      priority: 'urgent',
    },
  },
  {
    id: 'tpl-routine-inspection',
    name: '定期巡检',
    description: '按计划进行管网定期巡检',
    icon: '🔍',
    category: 'inspection',
    preset: {
      title: '管网定期巡检',
      description: '按照巡检计划，对管网设施进行例行检查',
      type: 'inspection',
      pipelineMedium: 'water',
      priority: 'medium',
    },
  },
  {
    id: 'tpl-pressure-check',
    name: '压力检测',
    description: '管网压力异常，需要检测',
    icon: '📊',
    category: 'inspection',
    preset: {
      title: '管网压力异常检测',
      description: '监测系统显示压力异常，需要现场检测确认',
      type: 'inspection',
      pipelineMedium: 'water',
      priority: 'high',
    },
  },
  {
    id: 'tpl-valve-replacement',
    name: '阀门更换',
    description: '老化阀门需要更换',
    icon: '🔧',
    category: 'maintenance',
    preset: {
      title: '老化阀门更换',
      description: '阀门老化失效，需要更换新阀门',
      type: 'maintenance',
      pipelineMedium: 'water',
      priority: 'medium',
    },
  },
  {
    id: 'tpl-pipe-retrofit',
    name: '管道改造',
    description: '老旧管道改造升级',
    icon: '🏗️',
    category: 'retrofit',
    preset: {
      title: '老旧管道改造升级',
      description: '管道老化严重，需要进行改造升级',
      type: 'retrofit',
      pipelineMedium: 'water',
      priority: 'medium',
    },
  },
  {
    id: 'tpl-pipe-retire',
    name: '管道报废',
    description: '废弃管道需要报废处理',
    icon: '🗑️',
    category: 'retire',
    preset: {
      title: '废弃管道报废处理',
      description: '管道已废弃不再使用，需要进行报废处理',
      type: 'retire',
      pipelineMedium: 'water',
      priority: 'low',
    },
  },
  {
    id: 'tpl-water-quality',
    name: '水质检测',
    description: '水质异常，需要检测',
    icon: '🧪',
    category: 'inspection',
    preset: {
      title: '水质异常检测',
      description: '水质监测显示异常，需要进行详细检测',
      type: 'inspection',
      pipelineMedium: 'water',
      priority: 'high',
    },
  },
]
