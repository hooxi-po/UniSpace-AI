<template>
    <div class="filterCard">
      <div class="row">
        <div class="field grow">
          <label>关键词</label>
          <input :value="draftKeyword" class="input" placeholder="楼栋/房号/部门" @input="$emit('update:draftKeyword', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <label>宿舍类型</label>
          <select :value="selectedType" class="input" @change="$emit('update:selectedType', ($event.target as HTMLSelectElement).value)">
            <option value="all">全部</option>
            <option value="Student">学生宿舍</option>
            <option value="TeacherApartment">教师宿舍</option>
          </select>
        </div>
        <div class="field">
          <label>房间状态</label>
          <select :value="selectedStatus" class="input" @change="$emit('update:selectedStatus', ($event.target as HTMLSelectElement).value)">
            <option value="all">全部</option>
            <option value="Empty">空置</option>
            <option value="Occupied">在住</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn--primary" @click="$emit('search')">搜索</button>
        <button class="btn" @click="$emit('reset')">重置</button>
        <span class="hint">共 {{ count }} 间</span>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  defineProps<{
    draftKeyword: string
    selectedType: 'all' | 'Student' | 'TeacherApartment'
    selectedStatus: 'all' | 'Empty' | 'Occupied'
    count: number
  }>()
  
  defineEmits<{
    'update:draftKeyword': [string]
    'update:selectedType': [string]
    'update:selectedStatus': [string]
    search: []
    reset: []
  }>()
  </script>
  
  <style scoped>
  .filterCard { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 10px; }
  .row { display: grid; gap: 10px; grid-template-columns: 2fr 1fr 1fr; }
  .field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
  .grow { min-width: 0; }
  .input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
  .actions { display: flex; align-items: center; gap: 8px; }
  .hint { margin-left: auto; color: #646a73; font-size: 13px; }
  .btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  .btn--primary { background: #3370ff; border-color: #3370ff; color: #fff; }
  </style>