<template>
  <div class="filterCard">
    <div class="row">
      <div class="field grow">
        <label>关键词</label>
        <input :value="draftKeyword" class="input" placeholder="住户/账单号/房间ID" @input="$emit('update:draftKeyword', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="field">
        <label>月份</label>
        <select :value="selectedMonth" class="input" @change="$emit('update:selectedMonth', ($event.target as HTMLSelectElement).value)">
          <option v-for="m in monthOptions" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn--primary" @click="$emit('search')">搜索</button>
      <button class="btn" @click="$emit('reset')">重置</button>
      <button class="btn" @click="$emit('sync')">同步表计</button>
      <span class="hint">共 {{ count }} 条账单</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ draftKeyword: string; selectedMonth: string; monthOptions: string[]; count: number }>()
defineEmits<{ 'update:draftKeyword':[string]; 'update:selectedMonth':[string]; search:[]; reset:[]; sync:[] }>()
</script>

<style scoped>
.filterCard { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 10px; }
.row { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; }
.field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
.grow { min-width: 0; }
.input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.actions { display: flex; gap: 8px; align-items: center; }
.hint { margin-left: auto; color: #646a73; font-size: 13px; }
.btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px; }
.btn--primary { background: #3370ff; border-color: #3370ff; color: #fff; }
</style>

