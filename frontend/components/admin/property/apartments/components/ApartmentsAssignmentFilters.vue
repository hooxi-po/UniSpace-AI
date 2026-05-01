<template>
    <div class="filterCard">
      <div class="filterRow">
        <div class="field field--grow">
          <label class="fieldLabel">关键词</label>
          <input
            :value="draftKeyword"
            class="input"
            placeholder="请输入关键词（楼栋、房号、类型）"
            @input="$emit('update:draftKeyword', ($event.target as HTMLInputElement).value)"
          />
        </div>
  
        <div class="field">
          <label class="fieldLabel">宿舍类型</label>
          <select
            :value="selectedType"
            class="input"
            @change="$emit('update:selectedType', ($event.target as HTMLSelectElement).value)"
          >
            <option value="all">全部状态</option>
            <option value="Student">学生宿舍</option>
            <option value="TeacherApartment">教师宿舍</option>
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
  defineProps<{
    draftKeyword: string
    selectedType: 'all' | 'Student' | 'TeacherApartment'
    count: number
  }>()
  
  defineEmits<{
    'update:draftKeyword': [string]
    'update:selectedType': [string]
    search: []
    reset: []
  }>()
  </script>
  
  <style scoped>
  .filterCard {
    background: #fff;
    border: 1px solid var(--border, #dfe3ea);
    border-radius: 12px;
    padding: 12px;
    display: grid;
    gap: 10px;
  }
  
  .filterRow {
    display: grid;
    gap: 10px;
    grid-template-columns: 2fr 1fr;
  }
  
  .field {
    display: grid;
    gap: 6px;
  }
  
  .field--grow {
    min-width: 0;
  }
  
  .fieldLabel {
    font-size: 12px;
    color: #646a73;
  }
  
  .input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border, #dfe3ea);
    border-radius: 8px;
    font-size: 13px;
    outline: none;
  }
  
  .filterActions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .countHint {
    margin-left: auto;
    font-size: 13px;
    color: #646a73;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border, #dfe3ea);
    background: #fff;
  }
  
  .btn--primary {
    background: #3370ff;
    border-color: #3370ff;
    color: #fff;
  }
  
  @media (max-width: 700px) {
    .filterRow {
      grid-template-columns: 1fr;
    }
  
    .filterActions {
      flex-wrap: wrap;
    }
  
    .countHint {
      margin-left: 0;
    }
  }
  </style>