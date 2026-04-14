<template>
  <div class="ops-timeline">
    <div class="ops-timeline__header">
      <h3 class="ops-timeline__title">工单关联追踪</h3>
      <p class="ops-timeline__subtitle">追踪问题从发现到闭环的完整生命周期</p>
    </div>

    <div v-if="timelineChains.length === 0" class="ops-timeline__empty">
      <div class="ops-timeline__empty-icon">🔗</div>
      <div class="ops-timeline__empty-text">暂无关联工单链</div>
    </div>

    <div v-else class="ops-timeline__chains">
      <div
        v-for="chain in timelineChains"
        :key="chain.id"
        class="timeline-chain"
      >
        <div class="timeline-chain__header">
          <span class="timeline-chain__badge">关联链 #{{ chain.id }}</span>
          <span class="timeline-chain__date">{{ formatDate(chain.startDate) }}</span>
        </div>

        <div class="timeline-chain__items">
          <div
            v-for="(item, index) in chain.items"
            :key="item.workorderId"
            class="timeline-item"
            :class="`timeline-item--${item.status}`"
            @click="$emit('open-workorder', item.workorderId)"
          >
            <div class="timeline-item__connector" v-if="index > 0">
              <div class="timeline-item__arrow">↓</div>
              <div class="timeline-item__trigger">{{ item.triggerReason }}</div>
            </div>

            <div class="timeline-item__card">
              <div class="timeline-item__icon">{{ getTypeIcon(item.type) }}</div>
              <div class="timeline-item__content">
                <div class="timeline-item__title">
                  <span class="timeline-item__type">{{ getTypeLabel(item.type) }}</span>
                  <span class="timeline-item__id">{{ item.workorderId }}</span>
                </div>
                <div class="timeline-item__desc">{{ item.title }}</div>
                <div class="timeline-item__meta">
                  <span class="timeline-item__status-badge" :class="`status-badge--${item.status}`">
                    {{ getStatusLabel(item.status) }}
                  </span>
                  <span class="timeline-item__date">{{ formatTime(item.createdAt) }}</span>
                  <span v-if="item.assignee" class="timeline-item__assignee">👤 {{ item.assignee }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PipelineOrderStatus, PipelineOrderType } from '~/types/pipeline-ops'

interface TimelineItem {
  workorderId: string
  type: PipelineOrderType
  title: string
  status: PipelineOrderStatus
  createdAt: string
  assignee?: string
  triggerReason?: string
}

interface TimelineChain {
  id: string
  startDate: string
  items: TimelineItem[]
}

const props = defineProps<{
  chains: TimelineChain[]
}>()

defineEmits<{
  (e: 'open-workorder', id: string): void
}>()

const timelineChains = computed(() => props.chains)

function getTypeIcon(type: PipelineOrderType): string {
  const icons: Record<PipelineOrderType, string> = {
    inspection: '🔍',
    maintenance: '🔧',
    retrofit: '🏗️',
    retire: '🗑️',
  }
  return icons[type]
}

function getTypeLabel(type: PipelineOrderType): string {
  const labels: Record<PipelineOrderType, string> = {
    inspection: '巡检',
    maintenance: '维修',
    retrofit: '改造',
    retire: '报废',
  }
  return labels[type]
}

function getStatusLabel(status: PipelineOrderStatus): string {
  const labels: Record<PipelineOrderStatus, string> = {
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
  return labels[status]
}

function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10)
}

function formatTime(dateStr: string): string {
  return dateStr.slice(5, 16).replace('T', ' ')
}
</script>

<style scoped>
.ops-timeline {
  border: 1px solid #e2e6ea;
  border-radius: 10px;
  background: #fff;
  padding: 16px;
}

.ops-timeline__header {
  margin-bottom: 20px;
}

.ops-timeline__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1d2125;
}

.ops-timeline__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #68727d;
}

.ops-timeline__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
}

.ops-timeline__empty-icon {
  font-size: 48px;
  opacity: 0.3;
}

.ops-timeline__empty-text {
  font-size: 14px;
  color: #8a929b;
}

.ops-timeline__chains {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.timeline-chain {
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 16px;
  background: #fbfcfd;
}

.timeline-chain__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.timeline-chain__badge {
  display: inline-block;
  padding: 4px 10px;
  background: #e8f2ff;
  color: #1c5fce;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.timeline-chain__date {
  font-size: 12px;
  color: #68727d;
}

.timeline-chain__items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  position: relative;
  cursor: pointer;
}

.timeline-item__connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.timeline-item__arrow {
  font-size: 20px;
  color: #8a929b;
}

.timeline-item__trigger {
  margin-top: 4px;
  padding: 4px 8px;
  background: #fff7e6;
  color: #8f5a00;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.timeline-item__card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e6ea;
  border-radius: 8px;
  transition: all 0.2s;
}

.timeline-item__card:hover {
  border-color: #1967ff;
  box-shadow: 0 2px 8px rgba(25, 103, 255, 0.15);
  transform: translateX(4px);
}

.timeline-item__icon {
  font-size: 24px;
  flex-shrink: 0;
}

.timeline-item__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timeline-item__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-item__type {
  font-size: 13px;
  font-weight: 700;
  color: #3b4650;
}

.timeline-item__id {
  font-size: 11px;
  color: #68727d;
  font-family: ui-monospace, monospace;
}

.timeline-item__desc {
  font-size: 13px;
  color: #5f6973;
}

.timeline-item__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.timeline-item__status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.status-badge--todo {
  background: #fff7e6;
  color: #8f5a00;
}

.status-badge--in_progress {
  background: #e8f2ff;
  color: #1c5fce;
}

.status-badge--completed {
  background: #eaf8ee;
  color: #237a3f;
}

.status-badge--closed {
  background: #e8f4f7;
  color: #0a6675;
}

.timeline-item__date,
.timeline-item__assignee {
  font-size: 11px;
  color: #8a929b;
}

/* 状态指示 */
.timeline-item--completed .timeline-item__card {
  border-left: 3px solid #22c55e;
}

.timeline-item--in_progress .timeline-item__card {
  border-left: 3px solid #3b82f6;
}

.timeline-item--todo .timeline-item__card {
  border-left: 3px solid #f59e0b;
}
</style>
