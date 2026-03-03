<template>
  <div class="ops-board">
    <div class="ops-board__header">
      <div>
        <h2 class="ops-board__title">{{ meta.title }}</h2>
        <p class="ops-board__subtitle">{{ meta.subtitle }}</p>
      </div>
      <div class="ops-board__header-actions">
        <button class="ops-btn" type="button" @click="refresh" :disabled="loading">刷新</button>
        <button class="ops-btn ops-btn--primary" type="button" @click="formOpen = !formOpen">
          {{ formOpen ? '收起新建' : '新建工单' }}
        </button>
      </div>
    </div>

    <div class="ops-board__stats">
      <div class="stat-card"><div class="stat-card__label">总工单</div><div class="stat-card__value">{{ stats.total }}</div></div>
      <div class="stat-card"><div class="stat-card__label">草稿</div><div class="stat-card__value">{{ stats.draft }}</div></div>
      <div class="stat-card"><div class="stat-card__label">待办</div><div class="stat-card__value">{{ stats.todo }}</div></div>
      <div class="stat-card"><div class="stat-card__label">已分配</div><div class="stat-card__value">{{ stats.assigned }}</div></div>
      <div class="stat-card"><div class="stat-card__label">进行中</div><div class="stat-card__value">{{ stats.in_progress }}</div></div>
      <div class="stat-card"><div class="stat-card__label">暂停</div><div class="stat-card__value">{{ stats.paused }}</div></div>
      <div class="stat-card"><div class="stat-card__label">审核中</div><div class="stat-card__value">{{ stats.review }}</div></div>
      <div class="stat-card"><div class="stat-card__label">已完成</div><div class="stat-card__value">{{ stats.completed }}</div></div>
      <div class="stat-card"><div class="stat-card__label">已关闭</div><div class="stat-card__value">{{ stats.closed }}</div></div>
      <div class="stat-card"><div class="stat-card__label">已驳回</div><div class="stat-card__value">{{ stats.rejected }}</div></div>
    </div>

    <div v-if="dashboard" class="ops-dashboard">
      <div class="dash-card">
        <div class="dash-card__title">运维效率</div>
        <div class="dash-kv">平均处理时长: {{ dashboard.efficiency.averageHandleHours }}h</div>
        <div class="dash-kv">重复工单率: {{ dashboard.efficiency.repeatedOrderRate }}</div>
        <div class="dash-kv">总维修成本: ¥{{ dashboard.efficiency.totalCost }}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card__title">受影响楼宇 Top10</div>
        <div v-for="item in dashboard.affectedBuildingsTop10.slice(0, 5)" :key="item.buildingName" class="dash-kv">
          {{ item.buildingName }}: {{ item.count }} 次，平均 {{ item.avgImpactHours }}h
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card__title">趋势（近周期）</div>
        <div v-for="item in dashboard.trendByDay.slice(-5)" :key="item.date" class="dash-kv">
          {{ item.date }}: 新建{{ item.created }} / 完成{{ item.completed }}
        </div>
      </div>
    </div>

    <div v-if="formOpen" class="ops-form">
      <div class="ops-form__title">人工建单</div>
      <div class="ops-form__row">
        <label>工单标题<input v-model="form.title" class="ops-input" placeholder="请输入工单标题" /></label>
        <label>描述<input v-model="form.description" class="ops-input" placeholder="工单描述" /></label>
      </div>
      <div class="ops-form__row">
        <label v-if="mode === 'linkage'">工单类型
          <select v-model="form.type" class="ops-input">
            <option value="inspection">巡检</option>
            <option value="maintenance">维修</option>
            <option value="retrofit">改造</option>
            <option value="retire">报废</option>
          </select>
        </label>
        <label>优先级
          <select v-model="form.priority" class="ops-input">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </label>
        <label>所属区域<input v-model="form.area" class="ops-input" placeholder="教学区 / 生活区" /></label>
        <label>管网介质
          <select v-model="form.pipelineMedium" class="ops-input">
            <option value="water">供水</option>
            <option value="drainage">排水</option>
            <option value="sewage">污水</option>
            <option value="mixed">混合</option>
          </select>
        </label>
      </div>
      <div class="ops-form__row">
        <label>节点（逗号）<input v-model="form.nodeIdsText" class="ops-input" placeholder="N-1001,N-1002" /></label>
        <label>管段（逗号）<input v-model="form.segmentIdsText" class="ops-input" placeholder="S-2101,S-2102" /></label>
        <label>关联楼宇编码<input v-model="form.buildingId" class="ops-input" placeholder="BLD-001" /></label>
        <label>关联楼宇名称<input v-model="form.buildingName" class="ops-input" placeholder="博学楼" /></label>
      </div>
      <div class="ops-form__row">
        <label>计划日期<input v-model="form.plannedDate" class="ops-input" type="date" /></label>
        <label>截止时间<input v-model="form.deadlineAt" class="ops-input" type="datetime-local" /></label>
        <label>执行人<input v-model="form.assignee" class="ops-input" placeholder="班组或人员" /></label>
        <label>审核人<input v-model="form.reviewer" class="ops-input" placeholder="审核人" /></label>
      </div>
      <div class="ops-form__actions">
        <button class="ops-btn ops-btn--primary" type="button" :disabled="submitting" @click="submitCreate">
          创建草稿工单
        </button>
      </div>

      <div class="ops-form__title ops-form__title--sub">自动触发建单（监测异常/知识推理）</div>
      <div class="ops-form__row">
        <label>触发类型
          <select v-model="autoForm.trigger" class="ops-input">
            <option value="telemetry_alert">监测异常</option>
            <option value="anomaly_alert">人工上报异常</option>
            <option value="kg_inference">知识图谱推理</option>
          </select>
        </label>
        <label>触发原因<input v-model="autoForm.reason" class="ops-input" placeholder="例如：N-2301 压力异常" /></label>
      </div>
      <div class="ops-form__actions">
        <button class="ops-btn" type="button" :disabled="submitting" @click="submitAutoCreate">
          一键自动建单
        </button>
      </div>
    </div>

    <div class="ops-filters">
      <select v-model="queryStatus" class="ops-input">
        <option value="">全部状态</option>
        <option value="draft">草稿</option>
        <option value="todo">待办</option>
        <option value="assigned">已分配</option>
        <option value="in_progress">进行中</option>
        <option value="paused">暂停</option>
        <option value="review">审核中</option>
        <option value="completed">已完成</option>
        <option value="closed">已关闭</option>
        <option value="cancelled">已取消</option>
        <option value="rejected">已驳回</option>
      </select>
      <input v-model="queryArea" class="ops-input" placeholder="按所属区域筛选" />
      <select v-model="queryMedium" class="ops-input">
        <option value="">全部介质</option>
        <option value="water">供水</option>
        <option value="drainage">排水</option>
        <option value="sewage">污水</option>
        <option value="mixed">混合</option>
      </select>
      <input v-model="queryNodeId" class="ops-input" placeholder="按节点筛选" />
      <input v-model="queryBuildingId" class="ops-input" placeholder="按楼宇筛选" />
      <input v-model="queryAssignee" class="ops-input" placeholder="按执行人筛选" />
      <input v-model="queryCreatedFrom" class="ops-input" type="date" />
      <input v-model="queryCreatedTo" class="ops-input" type="date" />
      <input v-model="queryKeyword" class="ops-input ops-input--wide" placeholder="搜索工单号/标题/管段/执行人" />
    </div>

    <div v-if="error" class="ops-error">{{ error }}</div>

    <div class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>工单号</th>
            <th>标题</th>
            <th>类型</th>
            <th>来源</th>
            <th>状态</th>
            <th>优先级</th>
            <th>执行人</th>
            <th>影响楼宇</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in list" :key="item.id" class="table-row" @click="openDetail(item.id)">
            <td>{{ item.id }}</td>
            <td>{{ item.title }}</td>
            <td>{{ typeLabel[item.type] }}</td>
            <td>{{ sourceLabel[item.source] }}</td>
            <td><span class="status-pill" :class="`status-pill--${item.status}`">{{ statusLabel[item.status] }}</span></td>
            <td>{{ priorityLabel[item.priority] }}</td>
            <td>{{ item.assignee || '-' }}</td>
            <td>{{ item.impactScope.impactedBuildings.length }}</td>
            <td>{{ formatTime(item.createdAt) }}</td>
            <td>
              <div class="ops-actions" @click.stop>
                <button
                  v-for="action in availableActions(item.status)"
                  :key="`${item.id}-${action}`"
                  class="ops-btn ops-btn--mini"
                  :disabled="submitting"
                  @click="triggerAction(item, action)"
                >
                  {{ actionText[action] }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && list.length === 0">
            <td colspan="10" class="ops-empty">暂无工单数据</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="ops-pagination">
      <button class="ops-btn ops-btn--mini" :disabled="loading || page <= 1" @click="page = page - 1">上一页</button>
      <div class="ops-pagination__text">第 {{ page }} / {{ Math.max(totalPages, 1) }} 页，共 {{ total }} 条</div>
      <button class="ops-btn ops-btn--mini" :disabled="loading || page >= totalPages" @click="page = page + 1">下一页</button>
    </div>

    <div v-if="detailOpen && detail" class="detail-mask" @click.self="detailOpen = false">
      <div class="detail-panel">
        <div class="detail-panel__header">
          <div>
            <h3>{{ detail.title }}</h3>
            <div class="detail-sub">{{ detail.id }} · {{ typeLabel[detail.type] }} · {{ statusLabel[detail.status] }}</div>
          </div>
          <div class="detail-actions">
            <button class="ops-btn" @click="locateOnMap(detail)">三维定位</button>
            <button class="ops-btn" @click="detailOpen = false">关闭</button>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <div class="detail-card__title">基本信息</div>
            <div class="detail-kv">描述: {{ detail.description || '-' }}</div>
            <div class="detail-kv">优先级: {{ priorityLabel[detail.priority] }}</div>
            <div class="detail-kv">管网介质: {{ mediumLabel[detail.pipelineMedium] }}</div>
            <div class="detail-kv">区域: {{ detail.area }}</div>
            <div class="detail-kv">拓扑链路: {{ detail.topologyChain.join(' -> ') || '-' }}</div>
            <div class="detail-kv">避让要求: {{ detail.impactScope.bypassRequirement || '-' }}</div>
          </div>

          <div class="detail-card">
            <div class="detail-card__title">影响楼宇与房间</div>
            <div
              v-for="building in detail.impactScope.impactedBuildings"
              :key="building.buildingId"
              class="detail-block"
            >
              <div class="detail-kv">
                {{ building.buildingName }}({{ building.buildingId }}) / 楼层: {{ building.floors.join(',') || '-' }}
              </div>
              <div class="detail-kv detail-kv--minor">
                房间: {{ building.rooms.map(r => `${r.roomNo}`).join(', ') || '-' }}
              </div>
            </div>
            <div class="detail-card__sub-title">手动调整影响范围</div>
            <textarea v-model="impactJson" class="ops-textarea" />
            <input v-model="impactBypass" class="ops-input" placeholder="管网链路避让要求描述" />
            <input v-model="impactNote" class="ops-input" placeholder="调整备注" />
            <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="submitImpactAdjust">保存影响范围调整</button>
          </div>

          <div class="detail-card">
            <div class="detail-card__title">执行日志</div>
            <div class="detail-card__sub-title">状态时间轴</div>
            <div class="ops-timeline">
              <div v-for="item in timelineEntries.slice(-10)" :key="item.id" class="ops-timeline__item">
                <div class="ops-timeline__dot" />
                <div class="ops-timeline__content">
                  <div class="detail-kv">{{ item.label }} · {{ formatTime(item.createdAt) }}</div>
                  <div class="detail-kv detail-kv--minor">{{ item.content }}</div>
                </div>
              </div>
            </div>
            <div v-for="log in detail.executionLogs.slice().reverse().slice(0, 8)" :key="log.id" class="detail-block">
              <div class="detail-kv">{{ formatTime(log.createdAt) }} · {{ log.stage }} · {{ log.actor }}</div>
              <div class="detail-kv detail-kv--minor">{{ log.content }}</div>
            </div>
            <div class="detail-card__sub-title">新增执行日志</div>
            <input v-model="logForm.content" class="ops-input" placeholder="执行日志内容" />
            <div class="detail-row">
              <input v-model="logForm.actor" class="ops-input" placeholder="记录人" />
              <select v-model="logForm.stage" class="ops-input">
                <option value="progress">过程记录</option>
                <option value="pause_or_exception">暂停/异常</option>
                <option value="acceptance">完成验收</option>
                <option value="notification">消息通知</option>
              </select>
              <input v-model="logForm.nodeId" class="ops-input" placeholder="节点ID(可选)" />
            </div>
            <div class="detail-row">
              <input v-model.number="logForm.lng" class="ops-input" type="number" step="0.000001" placeholder="经度(可选)" />
              <input v-model.number="logForm.lat" class="ops-input" type="number" step="0.000001" placeholder="纬度(可选)" />
              <label class="detail-check"><input v-model="logForm.mobile" type="checkbox" />移动端上传</label>
            </div>
            <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="submitLog">写入日志</button>
          </div>

          <div class="detail-card">
            <div class="detail-card__title">热水泵控制</div>
            <div class="detail-row">
              <select v-model="pumpForm.action" class="ops-input">
                <option value="open">开启热水泵</option>
                <option value="close">关闭热水泵</option>
                <option value="set_duration">设置时长</option>
              </select>
              <input v-model.number="pumpForm.durationMinutes" class="ops-input" type="number" min="1" placeholder="时长(分钟)" />
              <input v-model="pumpForm.actor" class="ops-input" placeholder="执行人" />
            </div>
            <input
              v-model="pumpForm.buildingIdsText"
              class="ops-input"
              placeholder="楼宇编码(逗号)，为空则使用当前影响楼宇"
            />
            <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="submitPumpControl">执行批量控制</button>
            <div v-if="pumpUi.running" class="pump-progress">
              <div class="pump-progress__bar">
                <div class="pump-progress__inner" :style="{ width: `${pumpUi.progress}%` }" />
              </div>
              <div class="detail-kv detail-kv--minor">
                批量执行中：{{ pumpUi.completed }}/{{ pumpUi.total }}，倒计时 {{ pumpUi.countdown }}s
              </div>
            </div>
            <div v-for="item in detail.pumpControls.slice().reverse().slice(0, 6)" :key="item.id" class="detail-kv detail-kv--minor">
              {{ formatTime(item.executedAt) }} · {{ item.buildingName }} · {{ item.action }} · {{ item.result }}
              · {{ item.beforeStatus || '-' }} -> {{ item.afterStatus || '-' }}
              · 进度{{ item.progressPercent ?? 0 }}%
            </div>
          </div>

          <div v-if="detail.type === 'inspection'" class="detail-card">
            <div class="detail-card__title">巡检专属流程</div>
            <div class="detail-row">
              <input v-model="inspectionForm.checkinNodeId" class="ops-input" placeholder="扫码签到节点ID" />
              <select v-model="inspectionForm.judgement" class="ops-input">
                <option value="normal">正常</option>
                <option value="abnormal">异常</option>
              </select>
              <input v-model.number="inspectionForm.pressure" class="ops-input" type="number" placeholder="水压" />
              <input v-model.number="inspectionForm.waterQuality" class="ops-input" type="number" placeholder="水质指数" />
            </div>
            <input v-model="inspectionForm.issueText" class="ops-input" placeholder="现场问题描述" />
            <div class="detail-row">
              <input v-model.number="inspectionForm.lng" class="ops-input" type="number" step="0.000001" placeholder="经度(可选)" />
              <input v-model.number="inspectionForm.lat" class="ops-input" type="number" step="0.000001" placeholder="纬度(可选)" />
              <input v-model="inspectionForm.actor" class="ops-input" placeholder="巡检人" />
            </div>
            <input v-model="inspectionForm.photoUrlsText" class="ops-input" placeholder="照片URL(逗号分隔，必填)" />
            <div class="detail-row">
              <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="submitInspectionRecord">上传巡检记录</button>
              <button class="ops-btn ops-btn--mini" :disabled="submitting || inspectionForm.judgement !== 'abnormal'" @click="convertInspection">
                异常转维修工单
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { usePipelineOpsBoard, type PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'
import type {
  ImpactedBuildingRef,
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
  PipelineWorkOrder,
  PumpAction,
} from '~/types/pipeline-ops'

const props = defineProps<{ mode: PipelineOpsBoardMode }>()
const mode = computed(() => props.mode)
const route = useRoute()

const metaMap: Record<PipelineOpsBoardMode, { title: string; subtitle: string }> = {
  inspection: { title: '巡检工单管理', subtitle: '巡检路线、签到、现场记录、异常转维修闭环。' },
  maintenance: { title: '维修工单管理', subtitle: '维修过程、验收、影响楼宇恢复与成本记录。' },
  retrofit: { title: '改造工单管理', subtitle: '改造方案、影响评估、台账回写与通知联动。' },
  retire: { title: '报废工单管理', subtitle: '报废评估、拓扑更新、档案与资产销账。' },
  linkage: { title: '工单联动看板', subtitle: '统一联动监测、知识推理、一张图定位与闭环跟踪。' },
}
const meta = computed(() => metaMap[props.mode])

const {
  loading,
  submitting,
  error,
  list,
  detail,
  stats,
  dashboard,
  page,
  total,
  totalPages,
  queryStatus,
  queryArea,
  queryMedium,
  queryNodeId,
  queryBuildingId,
  queryAssignee,
  queryCreatedFrom,
  queryCreatedTo,
  queryKeyword,
  refresh,
  loadDetail,
  createWorkorder,
  autoCreate,
  transition,
  addExecutionLog,
  adjustImpact,
  pumpControl,
  addInspectionRecord,
  convertToMaintenance,
} = usePipelineOpsBoard(props.mode)

const formOpen = ref(false)
const detailOpen = ref(false)

const form = reactive({
  title: '',
  description: '',
  type: (props.mode === 'linkage' ? 'inspection' : props.mode) as PipelineOrderType,
  pipelineMedium: 'water' as PipelineMedium,
  area: '',
  buildingId: '',
  buildingName: '',
  nodeIdsText: '',
  segmentIdsText: '',
  assignee: '',
  reviewer: '',
  priority: 'medium' as PipelinePriority,
  plannedDate: '',
  deadlineAt: '',
})

const autoForm = reactive({
  trigger: 'telemetry_alert' as 'telemetry_alert' | 'anomaly_alert' | 'kg_inference',
  reason: '',
})

const impactJson = ref('[]')
const impactBypass = ref('')
const impactNote = ref('人工修订影响范围')

const logForm = reactive({
  actor: 'admin-ui',
  stage: 'progress' as 'progress' | 'pause_or_exception' | 'acceptance' | 'notification',
  content: '',
  nodeId: '',
  lng: undefined as number | undefined,
  lat: undefined as number | undefined,
  mobile: false,
})

const pumpForm = reactive({
  actor: 'admin-ui',
  action: 'close' as PumpAction,
  durationMinutes: 30,
  buildingIdsText: '',
})
const pumpUi = reactive({
  running: false,
  total: 0,
  completed: 0,
  progress: 0,
  countdown: 0,
})
let pumpTimer: ReturnType<typeof setInterval> | null = null

const inspectionForm = reactive({
  actor: '巡检员',
  checkinNodeId: '',
  judgement: 'normal' as 'normal' | 'abnormal',
  pressure: undefined as number | undefined,
  waterQuality: undefined as number | undefined,
  issueText: '',
  lng: undefined as number | undefined,
  lat: undefined as number | undefined,
  photoUrlsText: '',
})

const typeLabel: Record<PipelineOrderType, string> = {
  inspection: '巡检',
  maintenance: '维修',
  retrofit: '改造',
  retire: '报废',
}

const sourceLabel: Record<string, string> = {
  manual: '人工',
  telemetry_alert: '监测异常',
  anomaly_alert: '异常上报',
  kg_inference: '知识推理',
  inspection_transfer: '巡检转维修',
}

const statusLabel: Record<PipelineOrderStatus, string> = {
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

const mediumLabel: Record<PipelineMedium, string> = {
  water: '供水',
  drainage: '排水',
  sewage: '污水',
  mixed: '混合',
}

const priorityLabel: Record<PipelinePriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

const actionText: Record<string, string> = {
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

const stageLabel: Record<string, string> = {
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

function parseCsv(text: string) {
  return text.split(',').map(i => i.trim()).filter(Boolean)
}

function resetCreateForm() {
  form.title = ''
  form.description = ''
  form.pipelineMedium = 'water'
  form.area = ''
  form.buildingId = ''
  form.buildingName = ''
  form.nodeIdsText = ''
  form.segmentIdsText = ''
  form.assignee = ''
  form.reviewer = ''
  form.priority = 'medium'
  form.plannedDate = ''
  form.deadlineAt = ''
  form.type = (props.mode === 'linkage' ? 'inspection' : props.mode) as PipelineOrderType
}

function availableActions(status: PipelineOrderStatus) {
  if (status === 'draft') return ['submit', 'cancel', 'reject']
  if (status === 'todo') return ['assign', 'start', 'cancel', 'reject']
  if (status === 'assigned') return ['start', 'cancel', 'reject']
  if (status === 'in_progress') return ['pause', 'to_review', 'cancel', 'reject']
  if (status === 'paused') return ['resume', 'cancel', 'reject']
  if (status === 'review') return ['approve', 'reopen', 'cancel', 'reject']
  if (status === 'completed') return ['close', 'reopen']
  if (status === 'closed' || status === 'cancelled' || status === 'rejected') return ['reopen']
  return []
}

async function triggerAction(item: PipelineWorkOrder, action: string) {
  const params: { assignee?: string; reviewer?: string; comment?: string } = {}
  if (action === 'assign') {
    const assignee = window.prompt('请输入执行人', item.assignee || '')
    if (!assignee) return
    params.assignee = assignee
    const reviewer = window.prompt('请输入审核人', item.reviewer || '')
    params.reviewer = reviewer || ''
  }
  if (action === 'reject') {
    const comment = window.prompt('请输入驳回原因', '流程不符合要求')
    await transition(item.id, action as any, { actor: 'admin-ui', comment: comment || '' })
    return
  }
  await transition(item.id, action as any, { ...params, actor: 'admin-ui' })
}

async function submitCreate() {
  if (!form.title.trim()) {
    alert('请填写工单标题')
    return
  }
  await createWorkorder({
    title: form.title,
    description: form.description,
    type: form.type,
    pipelineMedium: form.pipelineMedium,
    area: form.area || '未分区',
    buildingId: form.buildingId,
    buildingName: form.buildingName,
    nodeIds: parseCsv(form.nodeIdsText),
    segmentIds: parseCsv(form.segmentIdsText),
    assignee: form.assignee,
    reviewer: form.reviewer,
    priority: form.priority,
    plannedDate: form.plannedDate,
    deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : '',
    createdBy: 'admin-ui',
  })
  resetCreateForm()
}

async function submitAutoCreate() {
  if (!form.title.trim()) {
    alert('自动建单同样需要工单标题')
    return
  }
  if (!autoForm.reason.trim()) {
    alert('请填写触发原因')
    return
  }
  await autoCreate({
    trigger: autoForm.trigger,
    reason: autoForm.reason,
    base: {
      title: form.title,
      description: form.description,
      type: form.type,
      pipelineMedium: form.pipelineMedium,
      area: form.area || '未分区',
      buildingId: form.buildingId,
      buildingName: form.buildingName,
      nodeIds: parseCsv(form.nodeIdsText),
      segmentIds: parseCsv(form.segmentIdsText),
      assignee: form.assignee,
      reviewer: form.reviewer,
      priority: form.priority,
      plannedDate: form.plannedDate,
      deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : '',
      createdBy: 'system',
    },
  })
}

async function openDetail(id: string) {
  await loadDetail(id)
  detailOpen.value = true
}

watch(detail, (val) => {
  if (!val) return
  impactJson.value = JSON.stringify(val.impactScope.impactedBuildings, null, 2)
  impactBypass.value = val.impactScope.bypassRequirement || ''
  const defaultBuildingIds = val.impactScope.impactedBuildings.map(i => i.buildingId)
  pumpForm.buildingIdsText = defaultBuildingIds.join(',')
}, { immediate: true })

async function submitImpactAdjust() {
  if (!detail.value) return
  let impactedBuildings: ImpactedBuildingRef[] = []
  try {
    impactedBuildings = JSON.parse(impactJson.value)
  } catch {
    alert('影响范围 JSON 格式错误')
    return
  }
  await adjustImpact({
    id: detail.value.id,
    actor: 'admin-ui',
    note: impactNote.value || '手动调整影响范围',
    impactedBuildings,
    bypassRequirement: impactBypass.value,
  })
}

async function submitLog() {
  if (!detail.value) return
  if (!logForm.content.trim()) {
    alert('请输入日志内容')
    return
  }
  await addExecutionLog({
    id: detail.value.id,
    actor: logForm.actor || 'admin-ui',
    stage: logForm.stage,
    content: logForm.content,
    nodeId: logForm.nodeId,
    lng: logForm.lng,
    lat: logForm.lat,
    isMobileUpload: logForm.mobile,
  })
  logForm.content = ''
}

async function submitPumpControl() {
  if (!detail.value) return
  let buildingIds = parseCsv(pumpForm.buildingIdsText)
  if (!buildingIds.length) {
    buildingIds = detail.value.impactScope.impactedBuildings.map(i => i.buildingId)
  }
  if (!buildingIds.length) {
    alert('没有可控制的楼宇')
    return
  }
  startPumpUi(buildingIds.length, pumpForm.action === 'set_duration' ? Math.max(1, pumpForm.durationMinutes) : 1)
  await pumpControl({
    id: detail.value.id,
    actor: pumpForm.actor || 'admin-ui',
    action: pumpForm.action,
    durationMinutes: pumpForm.action === 'set_duration' ? pumpForm.durationMinutes : undefined,
    buildingIds,
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pipeline:pump-control-refreshed', {
      detail: { workorderId: detail.value.id, buildingIds },
    }))
  }
}

async function submitInspectionRecord() {
  if (!detail.value) return
  if (!inspectionForm.checkinNodeId.trim()) {
    alert('请输入巡检签到节点ID')
    return
  }
  if (typeof inspectionForm.pressure !== 'number') {
    alert('水压为必填项')
    return
  }
  if (typeof inspectionForm.waterQuality !== 'number') {
    alert('水质为必填项')
    return
  }
  if (typeof inspectionForm.lng !== 'number' || typeof inspectionForm.lat !== 'number') {
    alert('位置坐标为必填项')
    return
  }
  const photoUrls = parseCsv(inspectionForm.photoUrlsText)
  if (!photoUrls.length) {
    alert('现场照片为必填项')
    return
  }
  await addInspectionRecord({
    id: detail.value.id,
    actor: inspectionForm.actor || '巡检员',
    checkinNodeId: inspectionForm.checkinNodeId,
    judgement: inspectionForm.judgement,
    issueText: inspectionForm.issueText,
    pressure: inspectionForm.pressure,
    waterQuality: inspectionForm.waterQuality,
    lng: inspectionForm.lng,
    lat: inspectionForm.lat,
    photoUrls,
  })
  inspectionForm.issueText = ''
  inspectionForm.photoUrlsText = ''
}

async function convertInspection() {
  if (!detail.value) return
  const reason = inspectionForm.issueText || '巡检发现异常，转维修工单'
  await convertToMaintenance(detail.value.id, inspectionForm.actor || '巡检员', reason)
}

function locateOnMap(item: PipelineWorkOrder) {
  const focusNode = item.nodeIds[0] || ''
  const focusSegment = item.segmentIds[0] || ''
  const focusBuilding = item.buildingId || item.impactScope.impactedBuildings[0]?.buildingId || ''
  const focusRooms = item.impactScope.impactedBuildings
    .flatMap(b => b.rooms.map(r => r.roomId).filter(Boolean))
    .slice(0, 8)
    .join(',')
  const focusId = item.buildingId
    || item.impactScope.impactedBuildings[0]?.buildingId
    || item.nodeIds[0]
    || item.segmentIds[0]
    || item.id
  const query = new URLSearchParams({
    focusId,
    fromWorkorder: item.id,
    focusBuilding,
    focusNode,
    focusSegment,
    focusRooms,
  })
  window.open(`/?${query.toString()}`, '_blank')
}

const timelineEntries = computed(() => {
  if (!detail.value) return []
  return detail.value.executionLogs
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map(log => ({
      ...log,
      label: stageLabel[log.stage] || log.stage,
    }))
})

function startPumpUi(total: number, durationMinutes: number) {
  if (pumpTimer) {
    clearInterval(pumpTimer)
    pumpTimer = null
  }
  const totalSeconds = Math.max(5, Math.min(600, durationMinutes * 60))
  pumpUi.running = true
  pumpUi.total = total
  pumpUi.completed = 0
  pumpUi.progress = 0
  pumpUi.countdown = totalSeconds

  pumpTimer = setInterval(() => {
    if (pumpUi.countdown <= 1) {
      pumpUi.countdown = 0
      pumpUi.progress = 100
      pumpUi.completed = total
      pumpUi.running = false
      if (pumpTimer) {
        clearInterval(pumpTimer)
        pumpTimer = null
      }
      return
    }
    pumpUi.countdown -= 1
    const ratio = (totalSeconds - pumpUi.countdown) / totalSeconds
    pumpUi.progress = Number((ratio * 100).toFixed(1))
    pumpUi.completed = Math.min(total, Math.floor(total * ratio))
  }, 1000)
}

watch([queryStatus, queryArea, queryMedium, queryNodeId, queryBuildingId, queryAssignee, queryCreatedFrom, queryCreatedTo, queryKeyword], () => {
  page.value = 1
})

onBeforeUnmount(() => {
  if (pumpTimer) {
    clearInterval(pumpTimer)
    pumpTimer = null
  }
})

watch(
  () => route.query.workorderId,
  async (workorderId) => {
    if (typeof workorderId !== 'string' || !workorderId.trim()) return
    try {
      await loadDetail(workorderId.trim())
      detailOpen.value = true
    } catch {
      // ignore invalid route workorder id
    }
  },
  { immediate: true }
)

function formatTime(input?: string) {
  if (!input) return '-'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.ops-board { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.ops-board__header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.ops-board__title { margin: 0; font-size: 22px; color: #202428; }
.ops-board__subtitle { margin: 6px 0 0; color: #616a75; font-size: 13px; }
.ops-board__header-actions { display: flex; gap: 8px; }

.ops-board__stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: 10px; }
.stat-card { border: 1px solid #e2e6ea; border-radius: 10px; background: #fff; padding: 12px; }
.stat-card__label { font-size: 12px; color: #68727d; }
.stat-card__value { margin-top: 6px; font-size: 20px; font-weight: 700; color: #1d2125; }

.ops-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.dash-card { border: 1px solid #e2e6ea; border-radius: 10px; background: #fff; padding: 12px; }
.dash-card__title { font-size: 13px; color: #3b4650; margin-bottom: 6px; font-weight: 600; }
.dash-kv { font-size: 12px; color: #5f6973; margin-bottom: 4px; }

.ops-form { border: 1px solid #e2e6ea; border-radius: 10px; background: #fbfcfd; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.ops-form__title { font-size: 13px; font-weight: 600; color: #37414a; }
.ops-form__title--sub { margin-top: 6px; padding-top: 8px; border-top: 1px dashed #dce1e6; }
.ops-form__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
.ops-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #4f5a64; }
.ops-form__actions { display: flex; justify-content: flex-end; gap: 8px; }

.ops-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.ops-input { height: 34px; border: 1px solid #d7dde4; border-radius: 8px; background: #fff; padding: 0 10px; font-size: 13px; color: #1f2328; }
.ops-input--wide { min-width: 300px; }
.ops-textarea { border: 1px solid #d7dde4; border-radius: 8px; background: #fff; padding: 8px; min-height: 120px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.ops-btn { border: 1px solid #d2d8df; background: #fff; color: #27313c; border-radius: 8px; height: 34px; padding: 0 12px; font-size: 12px; cursor: pointer; }
.ops-btn:disabled { cursor: not-allowed; opacity: 0.6; }
.ops-btn--mini { height: 28px; padding: 0 8px; }
.ops-btn--primary { background: #1967ff; color: #fff; border-color: #1967ff; }

.ops-error { padding: 9px 10px; border-radius: 8px; background: #fff2f2; border: 1px solid #ffcdcd; color: #af2c2c; font-size: 12px; }
.ops-table-wrap { overflow: auto; border-radius: 10px; border: 1px solid #e2e6ea; }
.ops-table { width: 100%; border-collapse: collapse; min-width: 1200px; background: #fff; }
.ops-table th, .ops-table td { padding: 10px; border-bottom: 1px solid #edf0f2; text-align: left; font-size: 12px; color: #2a3138; vertical-align: top; }
.ops-table th { background: #f7f9fb; font-weight: 600; color: #5e6873; }
.table-row { cursor: pointer; }
.table-row:hover { background: #fafbfd; }
.ops-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.ops-empty { text-align: center; color: #8a929b; }
.ops-pagination { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.ops-pagination__text { font-size: 12px; color: #5e6873; min-width: 180px; text-align: center; }

.status-pill { display: inline-block; border-radius: 999px; padding: 1px 8px; line-height: 20px; font-size: 11px; }
.status-pill--draft { background: #eef2f7; color: #3f4b58; }
.status-pill--todo { background: #fff7e6; color: #8f5a00; }
.status-pill--assigned { background: #edf4ff; color: #2e5fc0; }
.status-pill--in_progress { background: #e8f2ff; color: #1c5fce; }
.status-pill--paused { background: #fff5eb; color: #a64d00; }
.status-pill--review { background: #f2ebff; color: #5f43b3; }
.status-pill--completed { background: #eaf8ee; color: #237a3f; }
.status-pill--closed { background: #e8f4f7; color: #0a6675; }
.status-pill--cancelled { background: #f5f6f7; color: #666d74; }
.status-pill--rejected { background: #ffecee; color: #a5333a; }

.detail-mask { position: fixed; inset: 0; background: rgba(10, 12, 16, 0.35); z-index: 3000; display: flex; justify-content: flex-end; }
.detail-panel { width: min(980px, 92vw); height: 100%; background: #f7f9fb; border-left: 1px solid #dce3ea; overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.detail-panel__header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.detail-panel__header h3 { margin: 0; color: #27313b; }
.detail-sub { margin-top: 4px; color: #66707b; font-size: 12px; }
.detail-actions { display: flex; gap: 8px; }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; }
.detail-card { border: 1px solid #dce3ea; border-radius: 10px; background: #fff; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.detail-card__title { font-size: 13px; font-weight: 600; color: #2d3740; }
.detail-card__sub-title { margin-top: 6px; font-size: 12px; color: #4f5a64; }
.detail-kv { font-size: 12px; color: #3d4752; }
.detail-kv--minor { color: #64717d; }
.detail-block { border-top: 1px dashed #eceff3; padding-top: 6px; }
.detail-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.detail-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #48545f; }
.ops-timeline { display: flex; flex-direction: column; gap: 8px; border: 1px dashed #e5e9ef; border-radius: 8px; padding: 8px; }
.ops-timeline__item { display: grid; grid-template-columns: 12px 1fr; gap: 8px; align-items: start; }
.ops-timeline__dot { width: 8px; height: 8px; border-radius: 999px; background: #1f6dff; margin-top: 5px; }
.pump-progress { display: flex; flex-direction: column; gap: 4px; }
.pump-progress__bar { width: 100%; height: 8px; border-radius: 999px; background: #edf2f7; overflow: hidden; }
.pump-progress__inner { height: 100%; background: linear-gradient(90deg, #1f79ff, #29b089); }

@media (max-width: 960px) {
  .ops-board__header { flex-direction: column; }
}
</style>
