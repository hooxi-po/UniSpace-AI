<template>
  <div class="filters">
    <div class="row">
      <div class="field">
        <label class="label">展示年度</label>
        <select
          class="select"
          :value="year"
          @change="$emit('update:year', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年度</option>
        </select>
      </div>

      <div class="field">
        <label class="label">账单月份</label>
        <input
          class="input"
          type="month"
          :value="month"
          @change="$emit('update:month', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="spacer" />

      <button class="btn" @click="$emit('export')">
        <Download :size="14" /> 导出
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download } from 'lucide-vue-next'

defineEmits<{
  'update:year': [val: number]
  'update:month': [val: string]
  export: []
}>()

defineProps<{
  year: number
  month: string
  yearOptions: number[]
}>()
</script>

<style scoped>
.filters {
  background: #fff;
  border-bottom: 1px solid #dee0e3;
  padding: 12px;
}

.row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  color: #8f959e;
}

.input {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.select {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: #fff;
}

.spacer {
  flex: 1;
}

.btn {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.btn:hover {
  background: #f5f6f7;
}
</style>

