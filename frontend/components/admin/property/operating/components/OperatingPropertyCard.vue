<template>
  <div class="propertyCard">
    <div class="propertyCard__header">
      <h3 class="propertyCard__title">{{ property.name }}</h3>
      <span :class="['propertyCard__status', statusClass]">
        {{ property.status }}
      </span>
    </div>
    
    <div class="propertyCard__body">
      <div class="propertyCard__info">
        <span class="propertyCard__label">面积</span>
        <span class="propertyCard__value">{{ property.area }} m²</span>
      </div>
      <div v-if="property.monthlyRent" class="propertyCard__info">
        <span class="propertyCard__label">月租金</span>
        <span class="propertyCard__value propertyCard__value--primary">
          ¥{{ property.monthlyRent.toLocaleString() }}
        </span>
      </div>
      <div class="propertyCard__info">
        <span class="propertyCard__label">竞标数</span>
        <span class="propertyCard__value">{{ (property.bids || []).length }} 条</span>
      </div>
    </div>

    <div class="propertyCard__actions">
      <button 
        class="propertyCard__btn" 
        :disabled="property.status === '已出租'"
        @click="$emit('edit', property)"
      >
        编辑
      </button>
      <button 
        class="propertyCard__btn"
        @click="$emit('view-bids', property)"
      >
        {{ property.status === '已出租' ? '查看竞标(只读)' : '查看竞标' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OperatingSpaceItem } from '~/services/operating'

const props = defineProps<{
  property: OperatingSpaceItem
}>()

defineEmits<{
  (e: 'edit', property: OperatingSpaceItem): void
  (e: 'view-bids', property: OperatingSpaceItem): void
}>()

const statusClass = computed(() => {
  switch (props.property.status) {
    case '已出租': return 'is-rented'
    case '公开招租': return 'is-available'
    default: return ''
  }
})
</script>

<style scoped>
.propertyCard {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  transition: all 0.2s;
}

.propertyCard:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: var(--primary);
}

.propertyCard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.propertyCard__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.propertyCard__status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f2f3;
  color: var(--muted);
}

.propertyCard__status.is-rented {
  background: #eefdf3;
  color: #16a34a;
}

.propertyCard__status.is-available {
  background: #eff6ff;
  color: #3b82f6;
}

.propertyCard__body {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.propertyCard__info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.propertyCard__label {
  color: var(--muted);
}

.propertyCard__value {
  color: var(--text);
  font-weight: 500;
}

.propertyCard__value--primary {
  color: var(--primary);
}

.propertyCard__actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.propertyCard__btn {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.propertyCard__btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: var(--primary);
  color: var(--primary);
}

.propertyCard__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>








