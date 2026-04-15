<template>
  <div class="statGrid">
    <div class="statCard">
      <div class="label">学生宿舍房源</div>
      <div class="value">{{ studentCount }}</div>
    </div>
    <div class="statCard">
      <div class="label">教师宿舍房源</div>
      <div class="value">{{ teacherCount }}</div>
    </div>
    <div class="statCard">
      <div class="label">总床位数</div>
      <div class="value">{{ totalBeds }}</div>
    </div>
    <div class="statCard">
      <div class="label">已入住床位</div>
      <div class="value">{{ occupiedBeds }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  studentCount: number
  teacherCount: number
  totalBeds: number
  occupiedBeds: number
}>()
</script>

<style scoped>
.statGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.statCard { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
.label { color: #646a73; font-size: 12px; }
.value { margin-top: 8px; font-size: 24px; font-weight: 800; }
@media (max-width: 900px) { .statGrid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px) { .statGrid { grid-template-columns: 1fr; } }
</style>














