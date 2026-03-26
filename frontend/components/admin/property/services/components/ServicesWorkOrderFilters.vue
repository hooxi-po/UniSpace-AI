<template>
    <div class="filterCard">
      <div class="row">
        <div class="field field--grow">
          <label class="label">关键词</label>
          <input
            :value="draftKeyword"
            class="input"
            placeholder="工单号/房间/报修人/资产"
            @input="$emit('update:draftKeyword', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label class="label">状态</label>
          <select :value="selectedStatus" class="input" @change="$emit('update:selectedStatus', ($event.target as HTMLSelectElement).value)">
            <option value="all">全部</option>
            <option value="待派单">待派单</option>
            <option value="已派单">已派单</option>
            <option value="处理中">处理中</option>
            <option value="待验收">待验收</option>
            <option value="已完成">已完成</option>
            <option value="已关闭">已关闭</option>
          </select>
        </div>
        <div class="field">
          <label class="label">优先级</label>
          <select :value="selectedPriority" class="input" @change="$emit('update:selectedPriority', ($event.target as HTMLSelectElement).value)">
            <option value="all">全部</option>
            <option value="低">低</option>
            <option value="中">中</option>
            <option value="高">高</option>
            <option value="紧急">紧急</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn--primary" @click="$emit('search')">搜索</button>
        <button class="btn" @click="$emit('reset')">重置</button>
        <span class="hint">当前 {{ count }} 条</span>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  defineProps<{
    draftKeyword: string
    selectedStatus: string
    selectedPriority: string
    count: number
  }>()
  
  defineEmits<{
    'update:draftKeyword': [string]
    'update:selectedStatus': [string]
    'update:selectedPriority': [string]
    search: []
    reset: []
  }>()
  </script>
  
  <style scoped>
  .filterCard{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:12px;display:grid;gap:10px}
  .row{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}
  .field{display:grid;gap:6px}.field--grow{min-width:0}
  .label{font-size:12px;color:#646a73}
  .input{border:1px solid var(--border,#dfe3ea);border-radius:8px;padding:8px 10px;font-size:13px}
  .actions{display:flex;gap:8px;align-items:center}
  .hint{margin-left:auto;color:#646a73;font-size:13px}
  .btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn--primary{background:#3370ff;border-color:#3370ff;color:#fff}
  </style>