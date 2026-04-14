<template>
  <div class="ops-board__header">
    <div>
      <h2 class="ops-board__title">{{ meta.title }}</h2>
      <p class="ops-board__subtitle">{{ meta.subtitle }}</p>
    </div>
    <div class="ops-board__header-actions">
      <button class="ops-btn ops-btn--report" type="button" @click="emit('toggle-report')">
        {{ reportOpen ? '📊 收起报表' : '📊 查看统计报表' }}
      </button>
      <button
        class="ops-btn ops-btn--report"
        type="button"
        :class="{ 'ops-btn--active': realtimeEnabled }"
        @click="emit('toggle-realtime', !realtimeEnabled)"
      >
        🔄 实时更新
        <span v-if="realtimeEnabled && lastUpdateTime" class="ops-realtime-time">
          {{ formatTime(lastUpdateTime) }}
        </span>
      </button>
      <button class="ops-btn" type="button" @click="emit('refresh')" :disabled="loading">刷新</button>
      <button class="ops-btn ops-btn--primary" type="button" @click="emit('toggle-form')">
        {{ formOpen ? '收起新建' : '新建工单' }}
      </button>
    </div>
  </div>

  <div
    v-if="feedbackText"
    :class="['ops-notice', `ops-notice--${feedbackType}`]"
  >
    <span>{{ feedbackText }}</span>
    <button class="ops-notice__close" type="button" @click="emit('dismiss-feedback')">知道了</button>
  </div>

  <div class="ops-board__stats">
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.total === 0 }"
      @click="emit('filter-by-status', '')"
    >
      <div class="stat-card__label">总工单</div>
      <div class="stat-card__value">{{ stats.total }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.todo === 0 }"
      @click="emit('filter-by-status', 'todo')"
    >
      <div class="stat-card__label">待办</div>
      <div class="stat-card__value">{{ stats.todo }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.in_progress === 0 }"
      @click="emit('filter-by-status', 'in_progress')"
    >
      <div class="stat-card__label">进行中</div>
      <div class="stat-card__value">{{ stats.in_progress }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.completed === 0 }"
      @click="emit('filter-by-status', 'completed')"
    >
      <div class="stat-card__label">已完成</div>
      <div class="stat-card__value">{{ stats.completed }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.assigned === 0 }"
      @click="emit('filter-by-status', 'assigned')"
    >
      <div class="stat-card__label">已分配</div>
      <div class="stat-card__value">{{ stats.assigned }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.paused === 0 }"
      @click="emit('filter-by-status', 'paused')"
    >
      <div class="stat-card__label">暂停</div>
      <div class="stat-card__value">{{ stats.paused }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.review === 0 }"
      @click="emit('filter-by-status', 'review')"
    >
      <div class="stat-card__label">审核中</div>
      <div class="stat-card__value">{{ stats.review }}</div>
    </div>
    <div
      class="stat-card"
      :class="{ 'stat-card--inactive': stats.rejected === 0 }"
      @click="emit('filter-by-status', 'rejected')"
    >
      <div class="stat-card__label">驳回</div>
      <div class="stat-card__value">{{ stats.rejected }}</div>
    </div>
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
</template>

<script setup lang="ts">
import type { PipelineOpsDashboard } from '~/types/pipeline-ops'
import type { PipelineOpsStats } from '~/services/pipeline-ops'

defineProps<{
  meta: { title: string; subtitle: string }
  loading: boolean
  formOpen: boolean
  reportOpen: boolean
  realtimeEnabled: boolean
  lastUpdateTime: number
  feedbackText: string
  feedbackType: 'info' | 'success' | 'error'
  stats: PipelineOpsStats
  dashboard: PipelineOpsDashboard | null
  formatTime: (input?: string | number) => string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'toggle-form'): void
  (e: 'toggle-report'): void
  (e: 'toggle-realtime', enabled: boolean): void
  (e: 'dismiss-feedback'): void
  (e: 'filter-by-status', status: string): void
}>()
</script>
