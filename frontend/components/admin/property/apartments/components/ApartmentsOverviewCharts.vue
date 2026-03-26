<template>
  <div class="chartGrid">
    <section class="panel">
      <div class="panelTitle">学生/教师宿舍状态对比</div>
      <div class="compareList">
        <div v-for="state in statuses" :key="state" class="compareRow">
          <div class="stateName">{{ state }}</div>
          <div class="bars">
            <div class="barItem">
              <span>学生</span>
              <div class="barTrack"><div class="barFill" :style="{ width: `${getTypePercent('学生宿舍', state)}%`, backgroundColor: getStatusMeta(state).dot }" /></div>
              <strong>{{ getTypePercent('学生宿舍', state) }}%</strong>
            </div>
            <div class="barItem">
              <span>教师</span>
              <div class="barTrack"><div class="barFill" :style="{ width: `${getTypePercent('教师宿舍', state)}%`, backgroundColor: getStatusMeta(state).dot }" /></div>
              <strong>{{ getTypePercent('教师宿舍', state) }}%</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panelTitle">床位入住率（分宿舍类型）</div>
      <div class="typeOccupancyList">
        <div v-for="item in typeOccupancy" :key="item.type" class="typeRow">
          <div class="typeRowHead"><strong>{{ item.type }}</strong><span>{{ item.occupiedBeds }}/{{ item.totalBeds }} 床位</span></div>
          <div class="barTrack large"><div class="barFill" :style="{ width: `${item.percent}%`, backgroundColor: item.color }" /></div>
          <div class="typePercent">{{ item.percent }}%</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { DormStatus, DormType } from '~/services/apartments'

defineProps<{
  statuses: DormStatus[]
  typeOccupancy: { type: DormType; totalBeds: number; occupiedBeds: number; percent: number; color: string }[]
  getStatusMeta: (status: DormStatus) => { dot: string; bg: string; text: string }
  getTypePercent: (type: DormType, status: DormStatus) => number
}>()
</script>

<style scoped>
.chartGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.panel { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
.panelTitle { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.compareList { display: grid; gap: 10px; }
.compareRow { border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; padding: 10px; }
.stateName { font-weight: 700; margin-bottom: 8px; }
.bars { display: grid; gap: 8px; }
.barItem { display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; font-size: 12px; }
.barTrack { height: 8px; background: #eef2ff; border-radius: 999px; overflow: hidden; }
.barTrack.large { height: 10px; }
.barFill { height: 100%; border-radius: 999px; }
.typeOccupancyList { display: grid; gap: 12px; }
.typeRow { border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; padding: 10px; display: grid; gap: 8px; }
.typeRowHead { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.typePercent { text-align: right; font-size: 13px; color: #646a73; }
@media (max-width:1200px) { .chartGrid { grid-template-columns: 1fr 1fr; } }
@media (max-width:700px) { .chartGrid { grid-template-columns: 1fr; } }
</style>
