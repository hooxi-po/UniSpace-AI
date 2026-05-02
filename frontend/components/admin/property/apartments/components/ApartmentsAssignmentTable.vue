<template>
    <section class="section">
      <div class="title">空闲房间分配列表（最小单位：床位）</div>
  
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="rooms.length === 0" class="empty">暂无可分配房间</div>
  
      <div v-else class="list">
        <div v-for="room in rooms" :key="room.id" class="row">
          <div class="info">
            <div class="main">{{ room.buildingName }} {{ room.roomNo }}</div>
            <div class="sub">
              {{ room.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍' }}
              · 可分配床位 {{ room.availableBeds }}/{{ room.totalBeds }}
            </div>
          </div>
  
          <div class="right">
            <button class="btn btn--primary" @click="$emit('assign', room)">分配床位</button>
          </div>
        </div>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  type AssignmentRoom = {
    id: string
    buildingName: string
    roomNo: string
    type: 'Student' | 'TeacherApartment'
    totalBeds: number
    availableBeds: number
  }
  
  defineProps<{
    loading: boolean
    rooms: AssignmentRoom[]
  }>()
  
  defineEmits<{
    assign: [AssignmentRoom]
  }>()
  </script>
  
  <style scoped>
  .section { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
  .title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
  .empty { color: #646a73; font-size: 13px; }
  .list { border-top: 1px solid var(--border-light, #edf0f5); }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 2px;
    border-bottom: 1px solid var(--border-light, #edf0f5); /* 每行横线 */
  }
  .info { min-width: 0; }
  .main { font-weight: 700; color: #1f2329; }
  .sub { margin-top: 4px; color: #646a73; font-size: 12px; }
  .btn { border: 1px solid #3370ff; background: #3370ff; color: #fff; border-radius: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
  </style>