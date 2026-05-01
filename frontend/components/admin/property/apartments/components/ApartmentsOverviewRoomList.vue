<template>
  <div class="section">
    <div class="sectionTitle">房源明细</div>
    <div v-if="loading" class="loadingText">加载中...</div>
    <div v-else-if="rooms.length === 0" class="emptyText">暂无宿舍房源数据</div>

    <div v-else-if="viewMode === 'card'" class="cardGrid listScroll">
      <article v-for="room in rooms" :key="room.id" class="roomCard">
        <div class="roomCard__header">
          <h3 class="roomCard__title">{{ room.building }} · {{ room.roomNo }}</h3>
          <span class="statusTag" :style="{ backgroundColor: getStatusMeta(room.status).bg, color: getStatusMeta(room.status).text }">{{ room.status }}</span>
        </div>
        <div class="roomCard__meta">{{ room.type }} · {{ room.floor }}层</div>
        <div class="roomCard__body">
          <div class="metric"><span>床位</span><strong>{{ room.beds }}</strong></div>
          <div class="metric"><span>已住</span><strong>{{ room.occupiedBeds }}</strong></div>
          <div class="metric"><span>入住率</span><strong>{{ room.beds ? Math.round((room.occupiedBeds / room.beds) * 100) : 0 }}%</strong></div>
        </div>
      </article>
    </div>

    <div v-else class="tableWrap listScroll">
      <table class="table">
        <thead>
          <tr><th>类型</th><th>楼栋</th><th>房号</th><th>楼层</th><th>床位</th><th>已住</th><th>状态</th></tr>
        </thead>
        <tbody>
          <tr v-for="room in rooms" :key="room.id" class="tableRow">
            <td>{{ room.type }}</td><td>{{ room.building }}</td><td>{{ room.roomNo }}</td><td>{{ room.floor }}</td><td>{{ room.beds }}</td><td>{{ room.occupiedBeds }}</td>
            <td><span class="statusTag" :style="{ backgroundColor: getStatusMeta(room.status).bg, color: getStatusMeta(room.status).text }">{{ room.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DormOverviewRoom, DormStatus } from '~/services/apartments'

defineProps<{
  loading: boolean
  viewMode: 'card' | 'list'
  rooms: DormOverviewRoom[]
  getStatusMeta: (status: DormStatus) => { dot: string; bg: string; text: string }
}>()
</script>

<style scoped>
.section { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
.listScroll { max-height: 520px; overflow: auto; }
.sectionTitle { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.loadingText,.emptyText { color: #646a73; font-size: 13px; }
.cardGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.roomCard { border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 16px; background: #fff; transition: all .2s; display: grid; gap: 10px; }
.roomCard:hover { box-shadow: 0 4px 12px rgba(0,0,0,.05); border-color: #3370ff; }
.roomCard__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.roomCard__title { margin: 0; font-size: 15px; font-weight: 700; color: #1f2329; }
.roomCard__meta { color: #646a73; font-size: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-light, #edf0f5); }
.roomCard__body { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.metric { background: #f8fafc; border-radius: 8px; padding: 8px; text-align: center; }
.metric span { display: block; color: #646a73; font-size: 12px; }
.metric strong { font-size: 14px; }
.statusTag { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.tableWrap { overflow-x: auto; border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; }
.table { width: 100%; border-collapse: collapse; }
.table th,.table td { border-bottom: 1px solid var(--border-light, #edf0f5); padding: 10px 8px; font-size: 13px; text-align: left; }
.table th { color: #646a73; font-weight: 600; background: #f8fafc; }
.tableRow:nth-child(even) { background: #fcfdff; }
.tableRow:hover { background: #f3f7ff; }
@media (max-width:1200px) { .cardGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width:700px) { .cardGrid { grid-template-columns: 1fr; } }
</style>
