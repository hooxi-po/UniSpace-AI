<template>
  <div :class="['chart-container', !noCard ? 'card' : '']">
    <div v-if="!noCard" class="card__title">租金收入趋势 (万元)</div>

    <div v-if="!data.length" class="empty">暂无数据</div>

    <div v-else class="chart" role="img" aria-label="租金收入趋势图">
      <div class="chart__grid">
        <div v-for="(row, i) in 4" :key="i" class="chart__grid-row" />
      </div>

      <div class="chart__bars">
        <div v-for="d in data" :key="d.month" class="bar-group">
          <div class="bar-group__bars">
            <div
              class="bar is-paid"
              :style="{ height: barHeight(d.paid) }"
              :title="`实收 ${d.paid.toFixed(2)} 万`"
            />
            <div
              class="bar is-receivable"
              :style="{ height: barHeight(d.receivable) }"
              :title="`应收 ${d.receivable.toFixed(2)} 万`"
            />
          </div>
          <div class="bar-group__label">{{ d.month }}</div>
        </div>
      </div>

      <div class="legend">
        <div class="legend__item"><span class="dot is-paid" /> 实收</div>
        <div class="legend__item"><span class="dot is-receivable" /> 应收</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface RentTrendItem {
  month: string
  receivable: number
  paid: number
}

const props = defineProps<{
  data: RentTrendItem[]
  noCard?: boolean
}>()

const maxValue = computed(() => {
  const m = Math.max(0, ...props.data.map((d) => d.receivable), ...props.data.map((d) => d.paid))
  return m <= 0 ? 1 : m
})

const barHeight = (v: number) => `${Math.max(2, Math.round((v / maxValue.value) * 160))}px`
</script>

<style scoped>
.chart-container.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}

.card__title {
  font-weight: 700;
  margin-bottom: 10px;
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

.chart {
  position: relative;
  height: 220px;
  padding: 10px 10px 30px;
}

.chart__grid {
  position: absolute;
  inset: 10px 10px 30px 10px;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
}

.chart__grid-row {
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.chart__bars {
  position: absolute;
  inset: 10px 10px 30px 10px;
  display: grid;
  grid-template-columns: repeat(v-bind('data.length'), 1fr);
  gap: 10px;
  align-items: end;
}

.bar-group {
  display: grid;
  gap: 6px;
  align-items: end;
  justify-items: center;
}

.bar-group__bars {
  display: grid;
  grid-auto-flow: column;
  gap: 6px;
  align-items: end;
}

.bar {
  width: 14px;
  border-radius: 6px 6px 0 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.bar.is-paid {
  background: #3370ff;
}

.bar.is-receivable {
  background: #22c55e;
}

.bar-group__label {
  font-size: 12px;
  color: var(--muted);
}

.legend {
  position: absolute;
  left: 10px;
  bottom: 6px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
}

.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.dot.is-paid {
  background: #3370ff;
}

.dot.is-receivable {
  background: #22c55e;
}
</style>


