<template>
  <div class="filterCard">
    <div class="filterRow">
      <div class="field field--grow">
        <label class="fieldLabel">关键词</label>
        <input :value="draftKeyword" class="input" placeholder="请输入关键词（如：学生、教师、1号楼、101）" @input="onKeywordInput" />
      </div>


      <div class="field">
        <label class="fieldLabel">类型筛选</label>
        <select :value="selectedType" class="input" @change="onTypeChange">
          <option value="all">全部类型</option>
          <option value="学生宿舍">学生宿舍</option>
          <option value="教师宿舍">教师宿舍</option>
        </select>
      </div>

      <div class="field">
        <label class="fieldLabel">楼栋筛选</label>
        <select :value="selectedBuilding" class="input" @change="onBuildingChange">
          <option value="all">全部楼栋</option>
          <option v-for="b in buildingOptions" :key="b" :value="b">{{ b }}</option>
        </select>
      </div>
    </div>

    <div class="filterActions">
      <button class="btn btn--primary" @click="$emit('search')">搜索</button>
      <button class="btn" @click="$emit('reset')">重置</button>
      <span class="countHint">筛选结果：{{ count }} 间</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DormType } from '~/services/apartments'

defineProps<{
  draftKeyword: string
  selectedType: 'all' | DormType
  selectedBuilding: string
  buildingOptions: string[]
  count: number
}>()

const emit = defineEmits<{
  'update:draftKeyword': [value: string]
  'update:selectedType': [value: 'all' | DormType]
  'update:selectedBuilding': [value: string]
  search: []
  reset: []
}>()

const onKeywordInput = (event: Event) => {
  emit('update:draftKeyword', (event.target as HTMLInputElement).value)
}

const onTypeChange = (event: Event) => {
  emit('update:selectedType', (event.target as HTMLSelectElement).value as 'all' | DormType)
}

const onBuildingChange = (event: Event) => {
  emit('update:selectedBuilding', (event.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.filterCard { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 10px; }
.filterRow { display: grid; gap: 10px; grid-template-columns: 2fr 1fr 1fr; }
.field { display: grid; gap: 6px; }
.field--grow { min-width: 0; }
.fieldLabel { font-size: 12px; color: #646a73; }
.input { width: 100%; padding: 8px 10px; border: 1px solid var(--border, #dfe3ea); border-radius: 8px; font-size: 13px; outline: none; }
.filterActions { display: flex; align-items: center; gap: 8px; }
.countHint { margin-left: auto; font-size: 13px; color: #646a73; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border, #dfe3ea); background: #fff; }
.btn--primary { background: #3370ff; border-color: #3370ff; color: #fff; }
@media (max-width: 1200px) { .filterRow { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px) { .filterRow { grid-template-columns: 1fr; } .filterActions { flex-wrap: wrap; } .countHint { margin-left: 0; } }
</style>
