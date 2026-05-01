<template>
  <div class="rates">
    <div v-for="r in items" :key="r.contractId" class="rate">
      <div class="rate__top">
        <div class="rate__name">{{ r.tenant }}</div>
        <div class="rate__pct" :class="pctClass(r.rate)">{{ r.rate.toFixed(0) }}%</div>
      </div>
      <div class="rate__bar">
        <div class="rate__bar-inner" :class="barClass(r.rate)" :style="{ width: `${Math.min(r.rate, 100)}%` }" />
      </div>
    </div>
    <div v-if="items.length === 0" class="empty">暂无收缴数据</div>
  </div>
</template>

<script setup lang="ts">
import type { CollectionRateItem } from '~/services/operating'

defineProps<{
  items: CollectionRateItem[]
}>()

const pctClass = (rate: number) => (rate >= 100 ? 'is-good' : rate >= 50 ? 'is-warn' : 'is-bad')
const barClass = (rate: number) => (rate >= 100 ? 'is-good' : rate >= 50 ? 'is-warn' : 'is-bad')
</script>

<style scoped>
.rates {
  display: grid;
  gap: 12px;
}

.rate__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.rate__name {
  color: var(--text-2);
  font-weight: 500;
}

.rate__pct {
  font-weight: 700;
}

.rate__pct.is-good { color: #16a34a; }
.rate__pct.is-warn { color: #d97706; }
.rate__pct.is-bad { color: #dc2626; }

.rate__bar {
  margin-top: 6px;
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.rate__bar-inner {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.rate__bar-inner.is-good { background: #16a34a; }
.rate__bar-inner.is-warn { background: #f59e0b; }
.rate__bar-inner.is-bad { background: #dc2626; }

.empty {
  padding: 20px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
</style>























