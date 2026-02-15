<template>
  <div class="filters">
    <div class="row">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input
          class="searchInput"
          type="text"
          placeholder="搜索部门/账单编号..."
          :value="searchTerm"
          @input="$emit('update:searchTerm', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <select
        class="select"
        :value="statusFilter"
        @change="$emit('update:statusFilter', ($event.target as HTMLSelectElement).value as any)"
      >
        <option value="all">全部状态</option>
        <option value="Confirmed">已确认</option>
        <option value="Pending">待确认</option>
        <option value="Rejected">已拒绝</option>
      </select>

      <div class="spacer" />

      <button class="btn" @click="$emit('export')">
        <Download :size="14" /> 导出
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Search } from 'lucide-vue-next'
import type { PaymentRecord } from '~/server/utils/charging-db'

defineEmits<{
  'update:searchTerm': [val: string]
  'update:statusFilter': [val: PaymentRecord['status'] | 'all']
  export: []
}>()

defineProps<{
  searchTerm: string
  statusFilter: PaymentRecord['status'] | 'all'
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

