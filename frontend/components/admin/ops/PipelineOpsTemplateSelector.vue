<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PipelineOrderType } from '~/types/pipeline-ops'
import { BUILTIN_TEMPLATES, type PipelineWorkOrderTemplate } from '~/types/pipeline-ops-template'

const props = defineProps<{
  allowedType?: PipelineOrderType
}>()

const emit = defineEmits<{
  'select': [template: PipelineWorkOrderTemplate]
  'close': []
}>()

const searchQuery = ref('')
const selectedCategory = ref<string>('all')

const categories = [
  { value: 'all', label: '全部模板', icon: '📋' },
  { value: 'inspection', label: '巡检', icon: '🔍' },
  { value: 'maintenance', label: '维修', icon: '🔧' },
  { value: 'retrofit', label: '改造', icon: '🏗️' },
  { value: 'retire', label: '报废', icon: '🗑️' },
]

const visibleCategories = computed(() => {
  if (!props.allowedType) return categories
  return categories.filter(cat => cat.value === 'all' || cat.value === props.allowedType)
})

const filteredTemplates = computed(() => {
  let templates = BUILTIN_TEMPLATES

  if (props.allowedType) {
    templates = templates.filter(t => t.preset.type === props.allowedType)
  }

  // 分类筛选
  if (selectedCategory.value !== 'all') {
    templates = templates.filter(t => t.category === selectedCategory.value)
  }

  // 搜索筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    )
  }

  return templates
})

function selectTemplate(template: PipelineWorkOrderTemplate) {
  emit('select', template)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="template-selector">
    <div class="template-selector__header">
      <h3 class="template-selector__title">选择工单模板</h3>
      <button
        class="template-selector__close"
        @click="handleClose"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>

    <div class="template-selector__search">
      <input
        v-model="searchQuery"
        type="text"
        class="template-selector__search-input"
        placeholder="搜索模板..."
      >
    </div>

    <div class="template-selector__categories">
      <button
        v-for="cat in visibleCategories"
        :key="cat.value"
        class="template-category-chip"
        :class="{ 'template-category-chip--active': selectedCategory === cat.value }"
        @click="selectedCategory = cat.value"
      >
        <span class="template-category-chip__icon">{{ cat.icon }}</span>
        <span class="template-category-chip__label">{{ cat.label }}</span>
      </button>
    </div>

    <div class="template-selector__list">
      <div
        v-if="filteredTemplates.length === 0"
        class="template-selector__empty"
      >
        <div class="template-selector__empty-icon">🔍</div>
        <div class="template-selector__empty-text">未找到匹配的模板</div>
      </div>

      <button
        v-for="template in filteredTemplates"
        :key="template.id"
        class="template-card"
        @click="selectTemplate(template)"
      >
        <div class="template-card__icon">{{ template.icon }}</div>
        <div class="template-card__content">
          <div class="template-card__name">{{ template.name }}</div>
          <div class="template-card__description">{{ template.description }}</div>
          <div class="template-card__meta">
            <span class="template-card__priority" :class="`template-card__priority--${template.preset.priority}`">
              {{ template.preset.priority === 'urgent' ? '紧急' : template.preset.priority === 'high' ? '高' : template.preset.priority === 'medium' ? '中' : '低' }}
            </span>
            <span class="template-card__medium">
              {{ template.preset.pipelineMedium === 'water' ? '供水' : template.preset.pipelineMedium === 'drainage' ? '排水' : template.preset.pipelineMedium === 'sewage' ? '污水' : '其他' }}
            </span>
          </div>
        </div>
        <div class="template-card__arrow">→</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.template-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
}

.template-selector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.template-selector__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.template-selector__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.template-selector__close:hover {
  background: #e5e7eb;
  color: #111827;
}

.template-selector__search {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.template-selector__search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.template-selector__search-input:focus {
  border-color: #3b82f6;
}

.template-selector__categories {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}

.template-category-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 16px;
  font-size: 13px;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.template-category-chip:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #1e40af;
}

.template-category-chip--active {
  border-color: #3b82f6;
  background: #3b82f6;
  color: #ffffff;
}

.template-category-chip__icon {
  font-size: 14px;
}

.template-category-chip__label {
  font-weight: 500;
}

.template-selector__list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.template-selector__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: #9ca3af;
}

.template-selector__empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.template-selector__empty-text {
  font-size: 14px;
}

.template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.template-card:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
  transform: translateX(4px);
}

.template-card__icon {
  font-size: 32px;
  flex-shrink: 0;
}

.template-card__content {
  flex: 1;
  min-width: 0;
}

.template-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.template-card__description {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.template-card__priority {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.template-card__priority--urgent {
  background: #fee2e2;
  color: #dc2626;
}

.template-card__priority--high {
  background: #ffedd5;
  color: #ea580c;
}

.template-card__priority--medium {
  background: #fef3c7;
  color: #ca8a04;
}

.template-card__priority--low {
  background: #dcfce7;
  color: #65a30d;
}

.template-card__medium {
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 11px;
  color: #4b5563;
}

.template-card__arrow {
  font-size: 18px;
  color: #9ca3af;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.template-card:hover .template-card__arrow {
  transform: translateX(4px);
  color: #3b82f6;
}
</style>
