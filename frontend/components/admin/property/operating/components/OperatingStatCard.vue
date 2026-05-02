<template>
  <div class="stat-card">
    <div class="stat-card__head">
      <div class="stat-card__icon" :style="{ background: iconBgComputed }">
        <slot name="icon" />
      </div>
      <div v-if="trend" class="stat-card__trend" :class="trend.isUp ? 'is-up' : 'is-down'">
        <span class="stat-card__trend-arrow">{{ trend.isUp ? '↑' : '↓' }}</span>
        <span>{{ trend.value }}%</span>
      </div>
    </div>

    <div class="stat-card__body">
      <div class="stat-card__value">{{ value }}</div>
      <div class="stat-card__title">{{ title }}</div>
      <div v-if="subtitle" class="stat-card__subtitle">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Trend {
  value: number
  isUp: boolean
}

const props = defineProps<{
  title: string
  value: string | number
  subtitle?: string
  iconBg?: string
  trend?: Trend
}>()

const iconBgComputed = computed(() => props.iconBg || 'rgba(51, 112, 255, 0.08)')
</script>

<style scoped>
.stat-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}

.stat-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stat-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #3370ff;
}

.stat-card__trend {
  font-size: 12px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
}

.stat-card__trend.is-up {
  color: #16a34a;
  background: #dcfce7;
}

.stat-card__trend.is-down {
  color: #dc2626;
  background: #fee2e2;
}

.stat-card__trend-arrow {
  font-weight: 700;
}

.stat-card__body {
  margin-top: 10px;
}

.stat-card__value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.stat-card__title {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.stat-card__subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-2);
}
</style>
