<template>
  <div class="ops-filters">
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
    <input v-model="queryCreatedFromModel" class="ops-input" type="date" />
    <input v-model="queryCreatedToModel" class="ops-input" type="date" />
    <input v-model="queryKeywordModel" class="ops-input ops-input--wide" placeholder="搜索工单号/标题/管段/执行人" />
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
                @click="emit('trigger-action', item, action)"
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
    <button class="ops-btn ops-btn--mini" :disabled="loading || pageModel <= 1" @click="pageModel = pageModel - 1">上一页</button>
    <div class="ops-pagination__text">第 {{ pageModel }} / {{ Math.max(totalPages, 1) }} 页，共 {{ total }} 条</div>
    <button class="ops-btn ops-btn--mini" :disabled="loading || pageModel >= totalPages" @click="pageModel = pageModel + 1">下一页</button>
  </div>
</template>

<script setup lang="ts">
import type {
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
  PipelineWorkOrder,
} from '~/types/pipeline-ops'

const pageModel = defineModel<number>('page', { required: true })
const queryStatusModel = defineModel<PipelineOrderStatus | ''>('queryStatus', { default: '' })
const queryAreaModel = defineModel<string>('queryArea', { default: '' })
const queryMediumModel = defineModel<PipelineMedium | ''>('queryMedium', { default: '' })
const queryNodeIdModel = defineModel<string>('queryNodeId', { default: '' })
const queryBuildingIdModel = defineModel<string>('queryBuildingId', { default: '' })
const queryAssigneeModel = defineModel<string>('queryAssignee', { default: '' })
const queryCreatedFromModel = defineModel<string>('queryCreatedFrom', { default: '' })
const queryCreatedToModel = defineModel<string>('queryCreatedTo', { default: '' })
const queryKeywordModel = defineModel<string>('queryKeyword', { default: '' })

defineProps<{
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

const emit = defineEmits<{
  (e: 'open-detail', id: string): void
  (e: 'trigger-action', item: PipelineWorkOrder, action: string): void
}>()
</script>
