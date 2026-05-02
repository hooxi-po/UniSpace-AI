<template>
  <section class="section">
    <div class="sectionTitle">申请列表</div>
    <div v-if="loading" class="emptyText">加载中...</div>
    <div v-else-if="items.length === 0" class="emptyText">暂无入住申请</div>

    <div v-else class="tableWrap listScroll">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>申请人</th>
            <th>宿舍类型</th>
            <th>部门</th>
            <th>状态</th>
            <th>已分配房间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="tableRow">
            <td>#{{ item.id }}</td>
            <td>
              <div class="name">{{ item.applicantName }}</div>
              <div class="meta">{{ item.applicantNo || '—' }} · {{ item.applicantPhone || '—' }}</div>
            </td>
            <td>{{ item.applicantType }}</td>
            <td>{{ item.department || '—' }}</td>
            <td>
              <span class="statusTag" :class="item.status === '已分配' ? 'is-assigned' : 'is-pending'">{{ item.status }}</span>
            </td>
            <td>{{ roomText(item) }}</td>
            <td>
              <div class="actions">
                <button class="btn" @click="$emit('edit', item)">编辑</button>
                <button class="btn" @click="$emit('assign', item)">分配</button>
                <button class="btn btn--danger" @click="$emit('delete', item)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ApartmentApplicationItem } from '~/services/apartments'

defineProps<{ loading: boolean; items: ApartmentApplicationItem[] }>()
defineEmits<{ edit: [item: ApartmentApplicationItem]; assign: [item: ApartmentApplicationItem]; delete: [item: ApartmentApplicationItem] }>()

const roomText = (item: ApartmentApplicationItem) => {
  if (!item.assignedRoom?.roomNo) return '—'
  return `${item.assignedRoom.buildingName || ''} ${item.assignedRoom.roomNo}`.trim()
}
</script>

<style scoped>
.section { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
.sectionTitle { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.emptyText { color: #646a73; font-size: 13px; }
.listScroll { max-height: 560px; overflow: auto; }
.tableWrap { overflow-x: auto; border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { border-bottom: 1px solid var(--border-light, #edf0f5); padding: 10px 8px; font-size: 13px; text-align: left; }
.table th { color: #646a73; font-weight: 600; background: #f8fafc; }
.tableRow:nth-child(even) { background: #fcfdff; }
.name { font-weight: 600; }
.meta { color: #8c939c; font-size: 12px; margin-top: 2px; }
.statusTag { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
.statusTag.is-pending { background: #fff7e6; color: #b76e00; }
.statusTag.is-assigned { background: #e8f5e9; color: #207245; }
.actions { display: flex; align-items: center; gap: 6px; }
.btn { border: 1px solid var(--border, #dfe3ea); background: #fff; color: #1f2329; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.btn--danger { color: #c52828; border-color: #f3caca; }
</style>








