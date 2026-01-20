<template>
  <div class="alert-list">
    <div v-if="alerts.length === 0" class="no-alerts">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <span>系统运行正常</span>
    </div>
    <div v-else class="alert-items">
      <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="alert.level">
        <div class="alert-icon">
          <svg v-if="alert.level === 'critical'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="alert-content">
          <div class="alert-title">{{ alert.title }}</div>
          <div class="alert-time">{{ alert.time }}</div>
        </div>
        <button class="alert-action" @click="handleAlert(alert.id)">查看</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Alert {
  id: number
  title: string
  level: 'critical' | 'warning'
  time: string
}

const alerts = ref<Alert[]>([])

// Simulate incoming alerts
onMounted(() => {
  setTimeout(() => {
    alerts.value.push({
      id: 1,
      title: '供水管网 V-102 压力异常',
      level: 'critical',
      time: '10:23:45'
    })
  }, 3000)

  setTimeout(() => {
    alerts.value.push({
      id: 2,
      title: '排水井 #45 液位预警',
      level: 'warning',
      time: '10:25:12'
    })
  }, 8000)
})

const handleAlert = (id: number) => {
  // Mock handler
  console.log('Handling alert', id)
}
</script>

<style scoped>
.alert-list {
  min-height: 100px;
}

.no-alerts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #00ff7f;
  gap: 8px;
  font-size: 13px;
  background: rgba(0, 255, 127, 0.05);
  border-radius: 6px;
  border: 1px dashed rgba(0, 255, 127, 0.2);
}

.alert-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-left: 3px solid #ccc;
  border-radius: 4px;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.alert-item.critical {
  border-left-color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

.alert-item.warning {
  border-left-color: #faad14;
  background: rgba(250, 173, 20, 0.1);
}

.alert-icon {
  margin-right: 10px;
  display: flex;
}

.alert-item.critical .alert-icon { color: #ff4d4f; }
.alert-item.warning .alert-icon { color: #faad14; }

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 13px;
  color: #fff;
  font-weight: 500;
  margin-bottom: 2px;
}

.alert-time {
  font-size: 11px;
  color: #888;
}

.alert-action {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
}

.alert-action:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
</style>
