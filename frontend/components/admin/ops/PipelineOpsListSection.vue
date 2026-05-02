<template>
  <div class="toolbar toolbar--filters">
    <input
      v-if="showKeywordSearch"
      v-model="queryKeywordModel"
      class="admin-input toolbar__search"
      placeholder="搜索工单号 / 标题 / 管段 / 执行人"
    />
    <select v-model="queryStatusModel" class="admin-input toolbar__field">
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
    <select v-model="queryPriorityModel" class="admin-input toolbar__field">
      <option value="">全部优先级</option>
      <option value="urgent">紧急</option>
      <option value="high">高</option>
      <option value="medium">中</option>
      <option value="low">低</option>
    </select>
    <div class="toolbar__date-range">
      <input v-model="queryCreatedFromModel" class="admin-input toolbar__field" type="date" placeholder="开始日期" />
      <span class="toolbar__date-separator">至</span>
      <input v-model="queryCreatedToModel" class="admin-input toolbar__field" type="date" placeholder="结束日期" />
    </div>
    <button class="admin-btn" type="button" @click="advancedFiltersOpen = !advancedFiltersOpen">
      {{ advancedFiltersOpen ? '收起筛选 ▲' : '更多筛选 ▼' }}
    </button>
  </div>

  <div v-if="advancedFiltersOpen" class="advanced-filters">
    <div class="advanced-filters__header">
      <div>
        <div class="advanced-filters__title">高级筛选</div>
        <div class="advanced-filters__caption">按介质、定位对象、责任人和时间快速缩小工单范围。</div>
      </div>
      <button class="admin-btn admin-btn--mini" type="button" @click="emit('reset-filters')">
        清空筛选
      </button>
    </div>

    <div class="advanced-filters__grid">
      <label class="advanced-filters__field">
        <span class="advanced-filters__label">管网介质</span>
        <select v-model="queryMediumModel" class="admin-input toolbar__field">
          <option value="">全部介质</option>
          <option value="water">供水</option>
          <option value="drainage">排水</option>
          <option value="sewage">污水</option>
          <option value="mixed">混合</option>
        </select>
      </label>

      <label class="advanced-filters__field">
        <span class="advanced-filters__label">所属区域</span>
        <input v-model="queryAreaModel" class="admin-input toolbar__field" placeholder="教学区 / 生活区 / 北区" />
      </label>

      <label class="advanced-filters__field">
        <span class="advanced-filters__label">管段 ID</span>
        <input v-model="querySegmentIdModel" class="admin-input toolbar__field" placeholder="按管段筛选" />
      </label>

      <label class="advanced-filters__field">
        <span class="advanced-filters__label">节点 ID</span>
        <input v-model="queryNodeIdModel" class="admin-input toolbar__field" placeholder="按节点筛选" />
      </label>

      <label class="advanced-filters__field">
        <span class="advanced-filters__label">关联楼宇</span>
        <input v-model="queryBuildingIdModel" class="admin-input toolbar__field" placeholder="按楼宇筛选" />
      </label>

      <label class="advanced-filters__field">
        <span class="advanced-filters__label">执行人</span>
        <input v-model="queryAssigneeModel" class="admin-input toolbar__field" placeholder="按执行人筛选" />
      </label>
    </div>
  </div>

  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th class="col-id">工单号</th>
          <th class="col-main">工单信息</th>
          <th class="col-locate">业务定位</th>
          <th class="col-owner">责任信息</th>
          <th class="col-status">状态</th>
          <th class="col-priority">优先级</th>
          <th class="col-impact">影响范围</th>
          <th class="col-time">计划 / 创建</th>
          <th class="col-map">地图</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id" class="row-click" @click="emit('open-detail', item.id)">
          <td class="col-id"><span class="cell-id">{{ item.id }}</span></td>
          <td class="col-main">
            <div class="workorder-main">
              <div class="workorder-main__title">{{ item.title }}</div>
              <div class="workorder-main__meta">
                <span>{{ typeLabel[item.type] }}</span>
                <span>{{ sourceLabel[item.source] }}</span>
                <span>{{ mediumLabel[item.pipelineMedium] }}</span>
              </div>
            </div>
          </td>
          <td class="col-locate">
            <div class="workorder-locate">
              <div class="workorder-locate__line">
                <strong>区域</strong>
                <span>{{ item.area || '未分区' }}</span>
                <strong>楼宇</strong>
                <span>{{ resolveBuildingLabel(item) }}</span>
              </div>
              <div class="workorder-locate__line">
                <strong>管段</strong>
                <span>{{ item.segmentIds[0] || '-' }}</span>
                <strong>节点</strong>
                <span>{{ item.nodeIds[0] || '-' }}</span>
              </div>
            </div>
          </td>
          <td class="col-owner">
            <div class="workorder-owner">
              <div class="workorder-owner__line"><strong>执行</strong>{{ item.assignee || '待分配' }}</div>
              <div class="workorder-owner__line"><strong>审核</strong>{{ item.reviewer || '未设置' }}</div>
            </div>
          </td>
          <td class="col-status"><span class="status-pill" :class="`status-pill--${item.status}`">{{ statusLabel[item.status] }}</span></td>
          <td class="col-priority">
            <span class="priority-badge" :class="`priority-badge--${item.priority}`">
              <span class="priority-badge__dot"></span>
              {{ priorityLabel[item.priority] }}
            </span>
          </td>
          <td class="col-impact">
            <div class="impact-summary" :title="getImpactTooltip(item)">
              <span class="impact-summary__item">楼宇 {{ item.impactScope.impactedBuildings.length }}</span>
              <span class="impact-summary__item">房间 {{ getTotalRooms(item) }}</span>
            </div>
          </td>
          <td class="col-time">
            <div class="workorder-time">
              <div class="workorder-time__line"><strong>计划</strong><span>{{ formatDateOnly(item.plannedDate) }}</span></div>
              <div class="workorder-time__line"><strong>创建</strong><span>{{ formatDateOnly(item.createdAt) }}</span></div>
            </div>
          </td>
          <td class="col-map">
            <button
              class="admin-btn admin-btn--mini"
              title="在地图上定位"
              @click.stop="emit('locate-on-map', item)"
            >
              定位
            </button>
          </td>
          <td class="col-actions">
            <div class="ops-actions" @click.stop>
              <button
                v-if="getPrimaryAction(item.status)"
                class="admin-btn admin-btn--mini admin-btn--primary"
                :disabled="submitting"
                @click="emit('trigger-action', item, getPrimaryAction(item.status)!)"
              >
                {{ actionText[getPrimaryAction(item.status)!] }}
              </button>
              <div
                v-if="getSecondaryActions(item.status).length > 0"
                class="ops-actions-dropdown"
                :class="{ 'ops-actions-dropdown--open': openActionsFor === item.id }"
              >
                <button
                  class="admin-btn admin-btn--mini"
                  type="button"
                  :disabled="submitting"
                  :aria-expanded="openActionsFor === item.id"
                  @click.stop="toggleSecondaryActions(item.id)"
                >
                  ⋯
                </button>
                <div class="ops-actions-menu">
                  <button
                    v-for="action in getSecondaryActions(item.status)"
                    :key="`${item.id}-${action}`"
                    class="ops-actions-menu-item"
                    type="button"
                    :disabled="submitting"
                    @click.stop="triggerSecondaryAction(item, action)"
                  >
                    {{ actionText[action] }}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
        <tr v-if="!loading && list.length === 0">
          <td colspan="10" class="empty">
            <div class="ops-empty-state">
              <div class="ops-empty-state__icon">📋</div>
              <div class="ops-empty-state__text">暂无工单数据</div>
              <div class="ops-empty-state__hint">试试调整筛选条件，或创建第一个工单</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="ops-pagination">
    <button class="admin-btn admin-btn--mini" :disabled="loading || pageModel <= 1" @click="pageModel = pageModel - 1">上一页</button>
    <div class="ops-pagination__text">第 {{ pageModel }} / {{ Math.max(totalPages, 1) }} 页，共 {{ total }} 条</div>
    <button class="admin-btn admin-btn--mini" :disabled="loading || pageModel >= totalPages" @click="pageModel = pageModel + 1">下一页</button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type {
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
  PipelineWorkOrder,
} from '~/types/pipeline-ops'

const advancedFiltersOpen = ref(false)
const openActionsFor = ref('')

const pageModel = defineModel<number>('page', { required: true })
const queryStatusModel = defineModel<PipelineOrderStatus | ''>('queryStatus', { default: '' })
const queryAreaModel = defineModel<string>('queryArea', { default: '' })
const queryMediumModel = defineModel<PipelineMedium | ''>('queryMedium', { default: '' })
const queryPriorityModel = defineModel<PipelinePriority | ''>('queryPriority', { default: '' })
const queryNodeIdModel = defineModel<string>('queryNodeId', { default: '' })
const querySegmentIdModel = defineModel<string>('querySegmentId', { default: '' })
const queryBuildingIdModel = defineModel<string>('queryBuildingId', { default: '' })
const queryAssigneeModel = defineModel<string>('queryAssignee', { default: '' })
const queryCreatedFromModel = defineModel<string>('queryCreatedFrom', { default: '' })
const queryCreatedToModel = defineModel<string>('queryCreatedTo', { default: '' })
const queryKeywordModel = defineModel<string>('queryKeyword', { default: '' })

const emit = defineEmits<{
  (e: 'open-detail', id: string): void
  (e: 'trigger-action', item: PipelineWorkOrder, action: string): void
  (e: 'locate-on-map', item: PipelineWorkOrder): void
  (e: 'reset-filters'): void
}>()

const props = withDefaults(defineProps<{
  showKeywordSearch?: boolean
  loading: boolean
  submitting: boolean
  list: PipelineWorkOrder[]
  totalPages: number
  total: number
  typeLabel: Record<PipelineOrderType, string>
  mediumLabel: Record<PipelineMedium, string>
  sourceLabel: Record<string, string>
  statusLabel: Record<PipelineOrderStatus, string>
  priorityLabel: Record<PipelinePriority, string>
  actionText: Record<string, string>
  availableActions: (status: PipelineOrderStatus) => string[]
  formatTime: (input?: string) => string
}>(), {
  showKeywordSearch: true,
})

function getTotalRooms(item: PipelineWorkOrder): number {
  return item.impactScope.impactedBuildings.reduce((sum, b) => sum + b.rooms.length, 0)
}

function getImpactTooltip(item: PipelineWorkOrder): string {
  const buildings = item.impactScope.impactedBuildings
  if (buildings.length === 0) return '无影响范围'

  const buildingNames = buildings.map(b => b.buildingName).join(', ')
  const totalRooms = getTotalRooms(item)
  const totalFloors = buildings.reduce((sum, b) => sum + b.floors.length, 0)

  return `影响楼宇: ${buildingNames}\n楼层数: ${totalFloors}\n房间数: ${totalRooms}`
}

function resolveBuildingLabel(item: PipelineWorkOrder): string {
  return item.buildingName
    || item.buildingId
    || item.impactScope.impactedBuildings[0]?.buildingName
    || '-'
}

function formatDateOnly(input?: string) {
  if (!input) return '-'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return String(input).slice(0, 10) || '-'
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 获取主操作（当前状态下最重要的操作）
function getPrimaryAction(status: PipelineOrderStatus): string | null {
  const primaryActionMap: Record<PipelineOrderStatus, string | null> = {
    draft: 'submit',
    todo: 'start',
    assigned: 'start',
    in_progress: 'to_review',
    paused: 'resume',
    review: 'approve',
    completed: 'close',
    closed: 'reopen',
    cancelled: 'reopen',
    rejected: 'reopen',
  }
  const primaryAction = primaryActionMap[status]
  const available = props.availableActions(status)
  if (primaryAction && available.includes(primaryAction)) {
    return primaryAction
  }
  return available[0] || null
}

// 获取次要操作（收纳到更多菜单中）
function getSecondaryActions(status: PipelineOrderStatus): string[] {
  const allActions = props.availableActions(status)
  const primary = getPrimaryAction(status)
  return allActions.filter(action => action !== primary)
}

function toggleSecondaryActions(id: string) {
  openActionsFor.value = openActionsFor.value === id ? '' : id
}

function triggerSecondaryAction(item: PipelineWorkOrder, action: string) {
  openActionsFor.value = ''
  emit('trigger-action', item, action)
}

function closeSecondaryActions() {
  openActionsFor.value = ''
}

onMounted(() => {
  document.addEventListener('click', closeSecondaryActions)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeSecondaryActions)
})

</script>
