<template>
  <div class="ops-alert-monitor">
    <div class="ops-alert-monitor__header">
      <span class="ops-alert-monitor__title">⚠️ 异常预警</span>
    </div>
    <div class="ops-notice ops-notice--warn">
      真实监测预警数据尚未接入，已关闭自动建单入口，避免从前端模拟数据生成真实工单。
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  formatTime: (date: Date | string) => string
}>()

defineEmits<{
  (e: 'auto-create-success', workorderId: string): void
}>()
</script>
