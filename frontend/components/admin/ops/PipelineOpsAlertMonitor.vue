<template>
  <div v-if="alerts.length > 0" class="ops-alert-monitor">
    <div class="ops-alert-monitor__header">
      <span class="ops-alert-monitor__title">⚠️ 异常预警 ({{ alerts.length }})</span>
      <button class="ops-alert-monitor__toggle" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开' }}
      </button>
    </div>

    <div v-if="expanded" class="ops-alert-monitor__list">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="ops-alert-item"
        :class="`ops-alert-item--${alert.severity}`"
      >
        <div class="ops-alert-item__icon">
          {{ alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵' }}
        </div>
        <div class="ops-alert-item__content">
          <div class="ops-alert-item__title">{{ alert.title }}</div>
          <div class="ops-alert-item__detail">
            节点: {{ alert.nodeId }} | 当前值: {{ alert.currentValue }} | 阈值: {{ alert.threshold }}
          </div>
          <div class="ops-alert-item__time">{{ formatTime(alert.timestamp) }}</div>
        </div>
        <div class="ops-alert-item__actions">
          <button
            class="ops-btn ops-btn--small ops-btn--primary"
            :disabled="alert.autoCreating"
            @click="handleAutoCreate(alert)"
          >
            {{ alert.autoCreating ? '创建中...' : '自动建单' }}
          </button>
          <button
            class="ops-btn ops-btn--small"
            @click="handleDismiss(alert.id)"
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { createAlertWorkorder } from '~/services/pipeline-intelligence'

interface PipelineAlert {
  id: string
  title: string
  nodeId: string
  alertType: 'pressure' | 'flow' | 'quality'
  severity: 'critical' | 'warning' | 'info'
  currentValue: number
  threshold: number
  timestamp: Date
  autoCreating?: boolean
}

const props = defineProps<{
  formatTime: (date: Date | string) => string
}>()

const emit = defineEmits<{
  (e: 'auto-create-success', workorderId: string): void
}>()

const alerts = ref<PipelineAlert[]>([])
const expanded = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

// 模拟轮询获取预警数据
function pollAlerts() {
  // TODO: 实际调用后端接口
  // const response = await $fetch('/api/pipeline/alerts')

  // 模拟数据：随机生成预警
  if (Math.random() > 0.7 && alerts.value.length < 3) {
    const alertTypes: Array<'pressure' | 'flow' | 'quality'> = ['pressure', 'flow', 'quality']
    const severities: Array<'critical' | 'warning' | 'info'> = ['critical', 'warning', 'info']

    const newAlert: PipelineAlert = {
      id: 'ALERT-' + Date.now(),
      title: '管道压力异常',
      nodeId: 'N-' + Math.floor(Math.random() * 9000 + 1000),
      alertType: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      currentValue: Math.random() * 10,
      threshold: 5.0,
      timestamp: new Date(),
    }

    alerts.value.unshift(newAlert)
  }
}

// 自动创建工单
async function handleAutoCreate(alert: PipelineAlert) {
  alert.autoCreating = true

  try {
    const workorderId = await createAlertWorkorder({
      alertType: alert.alertType,
      nodeId: alert.nodeId,
      threshold: alert.threshold,
      currentValue: alert.currentValue,
    })

    // 移除预警
    alerts.value = alerts.value.filter(a => a.id !== alert.id)

    // 通知父组件
    emit('auto-create-success', workorderId)
  } catch (error) {
    console.error('自动建单失败:', error)
    alert.autoCreating = false
  }
}

// 忽略预警
function handleDismiss(alertId: string) {
  alerts.value = alerts.value.filter(a => a.id !== alertId)
}

onMounted(() => {
  // 启动轮询（每30秒检查一次）
  pollTimer = setInterval(pollAlerts, 30000)
  // 立即执行一次
  pollAlerts()
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>
