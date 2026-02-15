<template>
  <div class="filters">
    <div class="row">
      <div class="field">
        <label class="label">账单月份</label>
        <input
          class="input"
          type="month"
          :value="month"
          @change="$emit('update:month', ($event.target as HTMLInputElement).value)"
        />
      </div>

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

      <div class="spacer"></div>

      <button class="btnPrimary" :disabled="creatingBills" @click="$emit('generate')">
        <FileSpreadsheet :size="14" /> {{ creatingBills ? '生成中...' : '生成当月账单' }}
      </button>
    </div>

    <div class="row">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input
          class="searchInput"
          type="text"
          placeholder="搜索姓名/部门..."
          :value="searchTerm"
          @input="$emit('update:searchTerm', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <select
        class="select"
        :value="deptFilter"
        @change="$emit('update:deptFilter', ($event.target as HTMLSelectElement).value)"
      >
        <option value="all">全部部门</option>
        <option v-for="d in departmentOptions" :key="d" :value="d">{{ d }}</option>
      </select>

      <select
        class="select"
        :value="titleFilter"
        @change="$emit('update:titleFilter', ($event.target as HTMLSelectElement).value as any)"
      >
        <option value="all">全部职称</option>
        <option v-for="t in titleOptions" :key="t" :value="t">{{ titleLabel(t) }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileSpreadsheet, Search } from 'lucide-vue-next'
import type { PersonTitle } from '~/server/utils/charging-db'

defineEmits<{
  'update:month': [val: string]
  'update:year': [val: number]
  'update:searchTerm': [val: string]
  'update:deptFilter': [val: string]
  'update:titleFilter': [val: PersonTitle | 'all']
  generate: []
}>()

const props = defineProps<{
  month: string
  year: number
  yearOptions: number[]
  searchTerm: string
  deptFilter: string
  titleFilter: PersonTitle | 'all'
  departmentOptions: string[]
  titleOptions: PersonTitle[]
  creatingBills: boolean
}>()

function titleLabel(t: PersonTitle) {
  const map: Record<PersonTitle, string> = {
    Assistant: '助教',
    Lecturer: '讲师',
    AssociateProfessor: '副教授',
    Professor: '教授',
    Other: '其他',
  }
  return map[t] || t
}
</script>

<style scoped>
.filters {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.btnPrimary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>

