<script setup lang="ts">
import { computed } from 'vue'
import { pipelineOpsStatusLabel } from './pipeline-ops-view-constants'
import type { PipelineOpsStats } from '~/services/pipeline-ops'
import type { PipelineOpsDashboard, PipelineOrderStatus } from '~/types/pipeline-ops'

const props = defineProps<{
  stats: PipelineOpsStats
  dashboard: PipelineOpsDashboard | null
}>()

const statusChartPalette: Record<PipelineOrderStatus, string> = {
  draft: '#94a3b8',
  todo: '#fbbf24',
  assigned: '#06b6d4',
  in_progress: '#3b82f6',
  paused: '#f97316',
  review: '#8b5cf6',
  completed: '#10b981',
  closed: '#6b7280',
  cancelled: '#ef4444',
  rejected: '#b91c1c',
}

const statusChartOrder: PipelineOrderStatus[] = [
  'draft',
  'todo',
  'assigned',
  'in_progress',
  'paused',
  'review',
  'completed',
  'closed',
  'cancelled',
  'rejected',
]

const statusChartData = computed(() => {
  if (!props.dashboard) return []
  const data = props.dashboard.totalsByStatus
  const total = Object.values(data).reduce((sum, val) => sum + val, 0)

  return statusChartOrder
    .map((status) => {
      const value = data[status] || 0
      return {
        label: pipelineOpsStatusLabel[status],
        value,
        color: statusChartPalette[status],
        percentage: total > 0 ? (value / total * 100) : 0,
      }
    })
    .filter(item => item.value > 0)
})

const typeChartData = computed(() => {
  if (!props.dashboard) return []
  const data = props.dashboard.totalsByType
  const total = Object.values(data).reduce((sum, val) => sum + val, 0)

  return [
    { label: '巡检', value: data.inspection || 0, color: '#8b5cf6', percentage: total > 0 ? ((data.inspection || 0) / total * 100) : 0 },
    { label: '维修', value: data.maintenance || 0, color: '#ef4444', percentage: total > 0 ? ((data.maintenance || 0) / total * 100) : 0 },
    { label: '改造', value: data.retrofit || 0, color: '#f59e0b', percentage: total > 0 ? ((data.retrofit || 0) / total * 100) : 0 },
    { label: '报废', value: data.retire || 0, color: '#6b7280', percentage: total > 0 ? ((data.retire || 0) / total * 100) : 0 },
  ].filter(item => item.value > 0)
})

const trendData = computed(() => {
  if (!props.dashboard?.trendByDay) return []
  return props.dashboard.trendByDay.slice(-14) // 最近14天
})

const maxTrendValue = computed(() => {
  if (trendData.value.length === 0) return 1
  return Math.max(...trendData.value.map(d => Math.max(d.created, d.completed)))
})
</script>

<template>
  <div class="ops-report">
    <div class="ops-report__header">
      <h3 class="ops-report__title">工单统计报表</h3>
    </div>

    <!-- 关键指标 -->
    <div class="ops-report__metrics">
      <div class="metric-card metric-card--primary">
        <div class="metric-card__icon">📊</div>
        <div class="metric-card__content">
          <div class="metric-card__value">{{ stats.total }}</div>
          <div class="metric-card__label">工单总数</div>
        </div>
      </div>

      <div class="metric-card metric-card--success">
        <div class="metric-card__icon">✅</div>
        <div class="metric-card__content">
          <div class="metric-card__value">{{ stats.completed }}</div>
          <div class="metric-card__label">已完成</div>
        </div>
      </div>

      <div class="metric-card metric-card--warning">
        <div class="metric-card__icon">⏳</div>
        <div class="metric-card__content">
          <div class="metric-card__value">{{ stats.in_progress }}</div>
          <div class="metric-card__label">进行中</div>
        </div>
      </div>

      <div class="metric-card metric-card--info">
        <div class="metric-card__icon">⏱️</div>
        <div class="metric-card__content">
          <div class="metric-card__value">{{ dashboard?.efficiency.averageHandleHours.toFixed(1) || '0' }}h</div>
          <div class="metric-card__label">平均处理时长</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="ops-report__charts">
      <!-- 状态分布 -->
      <div class="chart-card">
        <div class="chart-card__header">
          <h4 class="chart-card__title">工单状态分布</h4>
        </div>
        <div class="chart-card__body">
          <div class="bar-chart">
            <div
              v-for="item in statusChartData"
              :key="item.label"
              class="bar-chart__item"
            >
              <div class="bar-chart__label">{{ item.label }}</div>
              <div class="bar-chart__bar-container">
                <div
                  class="bar-chart__bar"
                  :style="{ width: item.percentage + '%', backgroundColor: item.color }"
                >
                  <span class="bar-chart__value">{{ item.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 类型分布 -->
      <div class="chart-card">
        <div class="chart-card__header">
          <h4 class="chart-card__title">工单类型分布</h4>
        </div>
        <div class="chart-card__body">
          <div class="pie-chart">
            <div class="pie-chart__legend">
              <div
                v-for="item in typeChartData"
                :key="item.label"
                class="pie-chart__legend-item"
              >
                <span class="pie-chart__legend-dot" :style="{ backgroundColor: item.color }"></span>
                <span class="pie-chart__legend-label">{{ item.label }}</span>
                <span class="pie-chart__legend-value">{{ item.value }} ({{ item.percentage.toFixed(1) }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 趋势图 -->
      <div class="chart-card chart-card--wide">
        <div class="chart-card__header">
          <h4 class="chart-card__title">工单趋势（最近14天）</h4>
        </div>
        <div class="chart-card__body">
          <div v-if="trendData.length > 0" class="line-chart">
            <div class="line-chart__grid">
              <div
                v-for="item in trendData"
                :key="item.date"
                class="line-chart__column"
              >
                <div class="line-chart__bars">
                  <div
                    class="line-chart__bar line-chart__bar--created"
                    :style="{ height: (item.created / maxTrendValue * 100) + '%' }"
                    :title="`创建: ${item.created}`"
                  ></div>
                  <div
                    class="line-chart__bar line-chart__bar--completed"
                    :style="{ height: (item.completed / maxTrendValue * 100) + '%' }"
                    :title="`完成: ${item.completed}`"
                  ></div>
                </div>
                <div class="line-chart__label">{{ item.date.slice(5) }}</div>
              </div>
            </div>
            <div class="line-chart__legend">
              <div class="line-chart__legend-item">
                <span class="line-chart__legend-dot line-chart__legend-dot--created"></span>
                <span>创建</span>
              </div>
              <div class="line-chart__legend-item">
                <span class="line-chart__legend-dot line-chart__legend-dot--completed"></span>
                <span>完成</span>
              </div>
            </div>
          </div>
          <div v-else class="chart-card__empty">暂无趋势数据</div>
        </div>
      </div>

      <!-- 受影响楼宇 Top 10 -->
      <div v-if="dashboard?.affectedBuildingsTop10 && dashboard.affectedBuildingsTop10.length > 0" class="chart-card chart-card--wide">
        <div class="chart-card__header">
          <h4 class="chart-card__title">受影响楼宇 Top 10</h4>
        </div>
        <div class="chart-card__body">
          <div class="ranking-list">
            <div
              v-for="(building, index) in dashboard.affectedBuildingsTop10"
              :key="building.buildingName"
              class="ranking-item"
            >
              <div class="ranking-item__rank" :class="{ 'ranking-item__rank--top': index < 3 }">
                {{ index + 1 }}
              </div>
              <div class="ranking-item__content">
                <div class="ranking-item__name">{{ building.buildingName }}</div>
                <div class="ranking-item__meta">
                  <span>工单数: {{ building.count }}</span>
                  <span>平均影响时长: {{ building.avgImpactHours.toFixed(1) }}h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 报表组件 - 与房产管理模块统一风格 */
.ops-report {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ops-report__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ops-report__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
}

/* 关键指标 */
.ops-report__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: white;
  border: 1px solid #dee0e3;
}

.metric-card--primary {
  background: #3370ff;
  color: white;
  border-color: #3370ff;
}

.metric-card--success {
  background: #22c55e;
  color: white;
  border-color: #22c55e;
}

.metric-card--warning {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.metric-card--info {
  background: #8b5cf6;
  color: white;
  border-color: #8b5cf6;
}

.metric-card__icon {
  font-size: 28px;
}

.metric-card__value {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.metric-card__label {
  font-size: 12px;
  opacity: 0.9;
}

/* 图表区域 */
.ops-report__charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.chart-card {
  background: white;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.chart-card--wide {
  grid-column: 1 / -1;
}

.chart-card__header {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  background: #f8fafc;
}

.chart-card__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #1f2329;
}

.chart-card__body {
  padding: 14px;
}

.chart-card__empty {
  text-align: center;
  padding: 24px;
  color: #8f959e;
  font-size: 13px;
}

/* 柱状图 */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bar-chart__item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-chart__label {
  width: 60px;
  font-size: 12px;
  font-weight: 700;
  color: #646a73;
}

.bar-chart__bar-container {
  flex: 1;
  height: 32px;
  background: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
}

.bar-chart__bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  transition: width 0.3s ease;
  border-radius: 8px;
}

.bar-chart__value {
  font-size: 12px;
  font-weight: 700;
  color: white;
}

/* 饼图图例 */
.pie-chart__legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pie-chart__legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  padding: 10px;
  background: #f9fafb;
  border: 1px solid #eef0f2;
  border-radius: 8px;
}

.pie-chart__legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pie-chart__legend-label {
  font-weight: 700;
  color: #1f2329;
}

.pie-chart__legend-value {
  margin-left: auto;
  color: #646a73;
  font-weight: 700;
}

/* 折线图 */
.line-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.line-chart__grid {
  display: flex;
  gap: 8px;
  height: 200px;
  align-items: flex-end;
}

.line-chart__column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.line-chart__bars {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 180px;
  width: 100%;
}

.line-chart__bar {
  flex: 1;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  min-height: 2px;
}

.line-chart__bar--created {
  background: #3b82f6;
}

.line-chart__bar--completed {
  background: #22c55e;
}

.line-chart__label {
  font-size: 11px;
  color: #8f959e;
}

.line-chart__legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 10px;
  background: #f9fafb;
  border: 1px solid #eef0f2;
  border-radius: 8px;
}

.line-chart__legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #1f2329;
  font-weight: 700;
}

.line-chart__legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.line-chart__legend-dot--created {
  background: #3b82f6;
}

.line-chart__legend-dot--completed {
  background: #22c55e;
}

/* 排行榜 */
.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: #f9fafb;
  border: 1px solid #eef0f2;
  border-radius: 12px;
}

.ranking-item:hover {
  background: #f1f5f9;
}

.ranking-item__rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #646a73;
  flex-shrink: 0;
}

.ranking-item__rank--top {
  background: #fbbf24;
  color: white;
}

.ranking-item__content {
  flex: 1;
}

.ranking-item__name {
  font-size: 13px;
  font-weight: 700;
  color: #1f2329;
  margin-bottom: 4px;
}

.ranking-item__meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #646a73;
}

@media (max-width: 768px) {
  .ops-report__charts {
    grid-template-columns: 1fr;
  }

  .ops-report__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
