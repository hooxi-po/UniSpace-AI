<script setup lang="ts">
defineProps<{
  totalPoints: number
  segmentCount: number
  linkedBuildingCount: number
  alertCount: number
  lastSyncText: string
  activeToolLabel: string
}>()
</script>

<template>
  <footer class="bottom-status">
    <div class="status-group">
      <span class="status-mono">节点 {{ totalPoints }}</span>
      <span class="status-sep">|</span>
      <span class="status-mono">管段 {{ segmentCount }}</span>
      <span class="status-sep">|</span>
      <span class="status-mono">楼栋 {{ linkedBuildingCount }}</span>
    </div>
    <div class="status-group">
      <span class="status-alert"><i /><span class="status-mono">{{ alertCount }}</span></span>
    </div>
    <div class="status-group status-group--right">
      <span class="status-online"><i />在线 1人</span>
      <span class="status-sep">•</span>
      <span class="status-mono">同步 {{ lastSyncText }}</span>
      <span class="status-sep">•</span>
      <span class="status-mono">工具 {{ activeToolLabel }}</span>
      <span class="status-sep">•</span>
      <span class="status-mono">WGS84</span>
    </div>
  </footer>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
