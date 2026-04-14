<template>
  <!-- 基础筛选区 -->
  <div class="ops-filters-basic">
    <input v-model="queryKeywordModel" class="ops-input ops-input--search" placeholder="🔍 搜索工单号/标题/管段/执行人" />
    <select v-model="queryStatusModel" class="ops-input">
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
    <select v-model="queryPriorityModel" class="ops-input">
      <option value="">全部优先级</option>
      <option value="urgent">紧急</option>
      <option value="high">高</option>
      <option value="medium">中</option>
      <option value="low">低</option>
    </select>
    <div class="ops-date-range">
      <input v-model="queryCreatedFromModel" class="ops-input" type="date" placeholder="开始日期" />
      <span class="ops-date-separator">至</span>
      <input v-model="queryCreatedToModel" class="ops-input" type="date" placeholder="结束日期" />
    </div>
    <button class="ops-btn ops-btn--filter-toggle" @click="advancedFiltersOpen = !advancedFiltersOpen">
      {{ advancedFiltersOpen ? '收起筛选 ▲' : '更多筛选 ▼' }}
    </button>
  </div>

  <!-- 高级筛选区（可折叠） -->
  <div v-if="advancedFiltersOpen" class="ops-filters-advanced">
    <input v-model="queryAreaModel" class="ops-input" placeholder="按所属区域筛选" />
    <select v-model="queryMediumModel" class="ops-input">
      <option value="">全部介质</option>
      <option value="water">供水</option>
      <option value="drainage">排水</option>
      <option value="sewage">污水</option>
      <option value="mixed">混合</option>
    </select>
    <input v-model="queryNodeIdModel" class="ops-input" placeholder="按节点筛选" />
    <input v-model="queryBuildingIdModel" class="ops-input" placeholder="按楼宇筛选" />
    <input v-model="queryAssigneeModel" class="ops-input" placeholder="按执行人筛选" />
  </div>

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
          <th>地图</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id" class="table-row" @click="emit('open-detail', item.id)">
          <td>{{ item.id }}</td>
          <td>{{ item.title }}</td>
          <td>{{ typeLabel[item.type] }}</td>
          <td>{{ sourceLabel[item.source] }}</td>
          <td><span class="status-pill" :class="`status-pill--${item.status}`">{{ statusLabel[item.status] }}</span></td>
          <td>
            <span class="priority-badge" :class="`priority-badge--${item.priority}`">
              <span class="priority-badge__dot"></span>
              {{ priorityLabel[item.priority] }}
            </span>
          </td>
          <td>{{ item.assignee || '-' }}</td>
          <td>
            <span
              class="impact-summary"
              :title="getImpactTooltip(item)"
            >
              <span class="impact-summary-buildings">🏢 {{ item.impactScope.impactedBuildings.length }}</span>
              <span class="impact-summary-rooms">🚪 {{ getTotalRooms(item) }}</span>
            </span>
          </td>
          <td>{{ formatTime(item.createdAt) }}</td>
          <td>
            <button
              class="ops-btn ops-btn--mini ops-btn--map"
              title="在地图上定位"
              @click.stop="emit('locate-on-map', item)"
            >
              📍 定位
            </button>
          </td>
          <td>
            <div class="ops-actions" @click.stop>
              <button
                v-if="getPrimaryAction(item.status)"
                class="ops-btn ops-btn--mini ops-btn--primary"
                :disabled="submitting"
                @click="emit('trigger-action', item, getPrimaryAction(item.status)!)"
              >
                {{ actionText[getPrimaryAction(item.status)!] }}
              </button>
              <div v-if="getSecondaryActions(item.status).length > 0" class="ops-actions-dropdown">
                <button class="ops-btn ops-btn--mini" :disabled="submitting">
                  ⋯
                </button>
                <div class="ops-actions-menu">
                  <button
                    v-for="action in getSecondaryActions(item.status)"
                    :key="`${item.id}-${action}`"
                    class="ops-actions-menu-item"
                    :disabled="submitting"
                    @click="emit('trigger-action', item, action)"
                  >
                    {{ actionText[action] }}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
        <tr v-if="!loading && list.length === 0">
          <td colspan="11" class="ops-empty">
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
    <button class="ops-btn ops-btn--mini" :disabled="loading || pageModel <= 1" @click="pageModel = pageModel - 1">上一页</button>
    <div class="ops-pagination__text">第 {{ pageModel }} / {{ Math.max(totalPages, 1) }} 页，共 {{ total }} 条</div>
    <button class="ops-btn ops-btn--mini" :disabled="loading || pageModel >= totalPages" @click="pageModel = pageModel + 1">下一页</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type {
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
  PipelineWorkOrder,
} from '~/types/pipeline-ops'

const advancedFiltersOpen = ref(false)

const pageModel = defineModel<number>('page', { required: true })
const queryStatusModel = defineModel<PipelineOrderStatus | ''>('queryStatus', { default: '' })
const queryAreaModel = defineModel<string>('queryArea', { default: '' })
const queryMediumModel = defineModel<PipelineMedium | ''>('queryMedium', { default: '' })
const queryPriorityModel = defineModel<PipelinePriority | ''>('queryPriority', { default: '' })
const queryNodeIdModel = defineModel<string>('queryNodeId', { default: '' })
const queryBuildingIdModel = defineModel<string>('queryBuildingId', { default: '' })
const queryAssigneeModel = defineModel<string>('queryAssignee', { default: '' })
const queryCreatedFromModel = defineModel<string>('queryCreatedFrom', { default: '' })
const queryCreatedToModel = defineModel<string>('queryCreatedTo', { default: '' })
const queryKeywordModel = defineModel<string>('queryKeyword', { default: '' })

const emit = defineEmits<{
  (e: 'open-detail', id: string): void
  (e: 'trigger-action', item: PipelineWorkOrder, action: string): void
  (e: 'locate-on-map', item: PipelineWorkOrder): void
}>()

const props = defineProps<{
  loading: boolean
  submitting: boolean
  list: PipelineWorkOrder[]
  totalPages: number
  total: number
  typeLabel: Record<PipelineOrderType, string>
  sourceLabel: Record<string, string>
  statusLabel: Record<PipelineOrderStatus, string>
  priorityLabel: Record<PipelinePriority, string>
  actionText: Record<string, string>
  availableActions: (status: PipelineOrderStatus) => string[]
  formatTime: (input?: string) => string
}>()

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

// 获取主操作（当前状态下最重要的操作）
function getPrimaryAction(status: PipelineOrderStatus): string | null {
  const primaryActionMap: Record<PipelineOrderStatus, string | null> = {
    draft: 'submit',
    todo: 'start',
    assigned: 'start',
    in_progress: 'complete',
    paused: 'resume',
    review: 'approve',
    completed: null,
    closed: null,
    cancelled: null,
    rejected: 'resubmit',
  }
  return primaryActionMap[status]
}

// 获取次要操作（收纳到更多菜单中）
function getSecondaryActions(status: PipelineOrderStatus): string[] {
  const allActions = props.availableActions(status)
  const primary = getPrimaryAction(status)
  return allActions.filter(action => action !== primary)
}

</script>
