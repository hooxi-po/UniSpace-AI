<template>
  <div class="filters">
    <div class="searchBox">
      <Search :size="16" class="searchIcon" />
      <input
        :value="searchTerm"
        type="text"
        placeholder="搜索部门名称..."
        class="searchInput"
        @input="$emit('update:searchTerm', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <select
      :value="year"
      class="select"
      @change="$emit('update:year', Number(($event.target as HTMLSelectElement).value))"
    >
      <option :value="2025">2025年度</option>
      <option :value="2024">2024年度</option>
      <option :value="2023">2023年度</option>
    </select>

    <select
      :value="status"
      class="select"
      @change="$emit('update:status', (($event.target as HTMLSelectElement).value as any))"
    >
      <option value="all">全部状态</option>
      <option v-for="s in statusOptions" :key="s" :value="s">
        {{ getStatusLabel(s) }}
      </option>
    </select>

    <button class="btnGhost" @click="$emit('export')">
      <Download :size="14" /> 导出
    </button>
  </div>
</template>

<script setup lang="ts">
import { Download, Search } from 'lucide-vue-next'
import type { FeeStatus } from '~/server/utils/charging-db'

defineEmits<{
  'update:searchTerm': [val: string]
  'update:year': [val: number]
  'update:status': [val: FeeStatus | 'all']
  export: []
}>()

const props = defineProps<{
  searchTerm: string
  year: number
  status: FeeStatus | 'all'
  statusOptions: FeeStatus[]
  getStatusLabel: (s: FeeStatus) => string
}>()
</script>

<style scoped>
.filters {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.searchBox {
  position: relative;
  flex: 1;
  min-width: 220px;
}

.searchIcon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #8f959e;
}

.searchInput {
  width: 100%;
  padding: 8px 10px 8px 34px;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}

.select {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  color: #1f2329;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
</style>

