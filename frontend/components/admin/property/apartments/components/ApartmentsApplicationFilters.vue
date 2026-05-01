<template>
  <div class="filterCard">
    <div class="filterRow">
      <div class="field field--grow">
        <label class="fieldLabel">关键词</label>
        <input :value="draftKeyword" class="input" placeholder="请输入关键词（申请人、学工号、部门、房间）" @input="onKeywordInput" />
      </div>
      <div class="field">
        <label class="fieldLabel">状态筛选</label>
        <select :value="selectedStatus" class="input" @change="onStatusChange">
          <option value="all">全部状态</option>
          <option value="待处理">待处理</option>
          <option value="已分配">已分配</option>
        </select>
      </div>
    </div>
    <div class="filterActions">
      <button class="btn btn--primary" @click="$emit('search')">搜索</button>
      <button class="btn" @click="$emit('reset')">重置</button>
      <span class="countHint">筛选结果：{{ count }} 条</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApplicationStatus } from '~/services/apartments'

defineProps<{ draftKeyword: string; selectedStatus: 'all' | ApplicationStatus; count: number }>()
const emit = defineEmits<{ 'update:draftKeyword': [value: string]; 'update:selectedStatus': [value: 'all' | ApplicationStatus]; search: []; reset: [] }>()
const onKeywordInput = (event: Event) => emit('update:draftKeyword', (event.target as HTMLInputElement).value)
const onStatusChange = (event: Event) => emit('update:selectedStatus', (event.target as HTMLSelectElement).value as 'all' | ApplicationStatus)
</script>

<style scoped>
.filterCard { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 10px; }
.filterRow { display: grid; gap: 10px; grid-template-columns: 2fr 1fr; }
.field { display: grid; gap: 6px; }
.field--grow { min-width: 0; }
.fieldLabel { font-size: 12px; color: #646a73; }
.input { width: 100%; padding: 8px 10px; border: 1px solid var(--border, #dfe3ea); border-radius: 8px; font-size: 13px; outline: none; }
.filterActions { display: flex; align-items: center; gap: 8px; }
.countHint { margin-left: auto; font-size: 13px; color: #646a73; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border, #dfe3ea); background: #fff; }
.btn--primary { background: #3370ff; border-color: #3370ff; color: #fff; }
@media (max-width: 700px) { .filterRow { grid-template-columns: 1fr; } .filterActions { flex-wrap: wrap; } .countHint { margin-left: 0; } }
</style>
