import type { PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'
import type {
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
} from '~/types/pipeline-ops'

export const pipelineOpsMetaMap: Record<PipelineOpsBoardMode, { title: string; subtitle: string }> = {
  inspection: { title: '巡检工单管理', subtitle: '巡检路线、签到、现场记录、异常转维修闭环。' },
  maintenance: { title: '维修工单管理', subtitle: '维修过程、验收、影响楼宇恢复与成本记录。' },
  retrofit: { title: '改造工单管理', subtitle: '改造方案、影响评估、台账回写与通知联动。' },
  retire: { title: '报废工单管理', subtitle: '报废评估、拓扑更新、档案与资产销账。' },
  linkage: { title: '工单联动看板', subtitle: '统一联动监测、知识推理、一张图定位与闭环跟踪。' },
}

export const pipelineOpsTypeLabel: Record<PipelineOrderType, string> = {
  inspection: '巡检',
  maintenance: '维修',
  retrofit: '改造',
  retire: '报废',
}

export const pipelineOpsSourceLabel: Record<string, string> = {
  manual: '人工',
  telemetry_alert: '监测异常',
  anomaly_alert: '异常上报',
  kg_inference: '知识推理',
  inspection_transfer: '巡检转维修',
}

export const pipelineOpsStatusLabel: Record<PipelineOrderStatus, string> = {
  draft: '草稿',
  todo: '待办',
  assigned: '已分配',
  in_progress: '进行中',
  paused: '暂停',
  review: '审核中',
  completed: '已完成',
  closed: '已关闭',
  cancelled: '已取消',
  rejected: '已驳回',
}

export const pipelineOpsMediumLabel: Record<PipelineMedium, string> = {
  water: '供水',
  drainage: '排水',
  sewage: '污水',
  mixed: '混合',
}

export const pipelineOpsPriorityLabel: Record<PipelinePriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

export const pipelineOpsActionText: Record<string, string> = {
  submit: '提交',
  assign: '分配',
  start: '开始',
  pause: '暂停',
  resume: '继续',
  to_review: '送审',
  approve: '通过',
  close: '关闭',
  cancel: '取消',
  reject: '驳回',
  reopen: '重开',
}

export const pipelineOpsStageLabel: Record<string, string> = {
  created: '创建',
  status_change: '流转',
  start_execute: '开始执行',
  progress: '执行记录',
  pause_or_exception: '暂停/异常',
  acceptance: '验收',
  completed: '完成',
  closed: '关闭',
  impact_adjust: '影响范围调整',
  pump_control: '泵控执行',
  notification: '通知',
  system_linkage: '联动',
}
