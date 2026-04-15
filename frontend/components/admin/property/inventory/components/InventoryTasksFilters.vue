<template>
  <div class="filterCard">
    <div class="row">
      <div class="field grow">
        <label>关键词</label>
        <input :value="draftKeyword" class="input" placeholder="任务名/楼宇/责任部门/负责人" @input="$emit('update:draftKeyword', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="field">
        <label>年度</label>
        <select :value="String(selectedYear)" class="input" @change="onYearChange">
          <option v-for="y in yearOptions" :key="String(y)" :value="String(y)">{{ y === 'all' ? '全部年度' : `${y} 年` }}</option>
        </select>
      </div>
      <div class="field">
        <label>任务状态</label>
        <select :value="selectedStatus" class="input" @change="$emit('update:selectedStatus', ($event.target as HTMLSelectElement).value)">
          <option v-for="s in statusOptions" :key="s" :value="s">{{ s === 'all' ? '全部状态' : s }}</option>
        </select>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn--primary" @click="$emit('search')">搜索</button>
      <button class="btn" @click="$emit('reset')">重置</button>
      <span class="hint">筛选结果：{{ count }} 项任务</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  draftKeyword: string
  selectedYear: number | 'all'
  selectedStatus: string
  yearOptions: Array<'all' | number>
  statusOptions: string[]
  count: number
}>()

const emit = defineEmits<{
  'update:draftKeyword': [string]
  'update:selectedYear': [number | 'all']
  'update:selectedStatus': [string]
  search: []
  reset: []
}>()

const onYearChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update:selectedYear', value === 'all' ? 'all' : Number(value))
}
</script>

<style scoped>
.filterCard{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:12px;display:grid;gap:10px}
.row{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}
.field{display:grid;gap:6px;font-size:12px;color:#646a73}.grow{min-width:0}
.input{border:1px solid var(--border,#dfe3ea);border-radius:8px;padding:8px 10px;font-size:13px}
.actions{display:flex;gap:8px;align-items:center}.hint{margin-left:auto;font-size:13px;color:#646a73}
.btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:13px}
.btn--primary{background:#3370ff;border-color:#3370ff;color:#fff}
@media (max-width:900px){.row{grid-template-columns:1fr 1fr}}
@media (max-width:640px){.row{grid-template-columns:1fr}.actions{flex-wrap:wrap}.hint{margin-left:0}}
</style>