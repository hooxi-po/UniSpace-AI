<template>
  <div class="stats">
    <div class="card"><span>任务总数</span><strong>{{ total }}</strong></div>
    <div class="card"><span>已完成</span><strong>{{ completed }}</strong></div>
    <div class="card"><span>待复核</span><strong>{{ reviewing }}</strong></div>
    <div class="card"><span>逾期</span><strong>{{ overdue }}</strong></div>
    <div class="card"><span>平均进度</span><strong>{{ progressAvg }}%</strong></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ total: number; completed: number; reviewing: number; overdue: number; progressAvg: number }>()
</script>

<style scoped>
.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.card{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:12px;display:grid;gap:6px}
.card span{font-size:12px;color:#646a73}.card strong{font-size:22px}
@media (max-width:1100px){.stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:700px){.stats{grid-template-columns:1fr 1fr}}
</style>