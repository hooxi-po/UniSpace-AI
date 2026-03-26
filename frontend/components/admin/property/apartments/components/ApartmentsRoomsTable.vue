<template>
    <section class="section">
      <div class="title">房间管理</div>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="rooms.length === 0" class="empty">暂无房间数据</div>
      <div v-else class="wrap">
        <table class="table">
          <thead>
            <tr>
              <th>楼栋</th>
              <th>房号</th>
              <th>类型</th>
              <th>状态</th>
              <th>部门/住户</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rooms" :key="r.id">
              <td>{{ r.buildingName }}</td>
              <td>{{ r.roomNo }}</td>
              <td>{{ r.type === 'TeacherApartment' ? '教师宿舍' : '学生宿舍' }}</td>
              <td>
                <span class="tag" :class="r.status === 'Occupied' ? 'occupied' : 'empty'">
                  {{ r.statusCn || (r.status === 'Occupied' ? '在住' : '空置') }}
                </span>
              </td>
              <td>{{ r.department || '—' }}</td>
              <td>
                <div class="actions">
                  <button class="btn" @click="$emit('vacate', r)">腾退</button>
                  <button class="btn btn--primary" @click="$emit('reassign', r)">再分配</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  import type { ApartmentRoom } from '~/services/apartments'
  defineProps<{ loading: boolean; rooms: ApartmentRoom[] }>()
  defineEmits<{ vacate: [ApartmentRoom]; reassign: [ApartmentRoom] }>()
  </script>
  
  <style scoped>
  .section { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
  .title { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
  .empty { color: #646a73; font-size: 13px; }
  .wrap { overflow: auto; border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; max-height: 620px; }
  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { border-bottom: 1px solid var(--border-light, #edf0f5); padding: 10px 8px; font-size: 13px; text-align: left; }
  .table th { background: #f8fafc; color: #646a73; }
  .tag { border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
  .tag.occupied { background: #e8f5e9; color: #207245; }
  .tag.empty { background: #eef5ff; color: #225fbe; }
  .actions { display: flex; gap: 6px; }
  .btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  .btn--primary { border-color: #3370ff; color: #3370ff; }
  </style>