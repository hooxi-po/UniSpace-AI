<template>
  <div class="page">
    <div class="page__header">
      <div>
        <div class="page__title">经营概览</div>
        <div class="page__subtitle">租金收缴、合同预警、收入趋势快速总览</div>
      </div>
    </div>

    <div class="stats">
      <OperatingStatCard title="活跃合同" :value="stats.activeContracts">
        <template #icon>
          <span class="icon">📄</span>
        </template>
      </OperatingStatCard>

      <OperatingStatCard title="即将到期" :value="stats.expiringContracts" icon-bg="rgba(245, 158, 11, 0.12)">
        <template #icon>
          <span class="icon">⏳</span>
        </template>
      </OperatingStatCard>

      <OperatingStatCard title="待租房源" :value="stats.availableSpaces" icon-bg="rgba(168, 85, 247, 0.12)">
        <template #icon>
          <span class="icon">🏢</span>
        </template>
      </OperatingStatCard>

      <OperatingStatCard title="本月收入" :value="toWan(stats.monthlyIncome)" subtitle="单位：万元" icon-bg="rgba(34, 197, 94, 0.12)">
        <template #icon>
          <span class="icon">💰</span>
        </template>
      </OperatingStatCard>

      <OperatingStatCard title="应收租金" :value="toWan(stats.totalRentReceivable)" subtitle="单位：万元" icon-bg="rgba(249, 115, 22, 0.12)">
        <template #icon>
          <span class="icon">🧾</span>
        </template>
      </OperatingStatCard>

      <OperatingStatCard title="逾期欠费" :value="toWan(stats.overdueAmount, 2)" subtitle="单位：万元" icon-bg="rgba(239, 68, 68, 0.12)">
        <template #icon>
          <span class="icon">⚠️</span>
        </template>
      </OperatingStatCard>
    </div>

    <OperatingExpiryWarning :items="expiringItems" />

    <div class="grid">
      <OperatingRentTrendChart :data="rentTrend" />

      <div class="card">
        <div class="card__title">本月收缴情况</div>

        <div v-if="collectionRates.length" class="rates ratesScroll">
          <div v-for="r in collectionRates" :key="r.contractId" class="rate">
            <div class="rate__top">
              <div class="rate__name">{{ r.tenant }}</div>
              <div class="rate__pct" :class="pctClass(r.rate)">{{ r.rate.toFixed(0) }}%</div>
            </div>
            <div class="rate__bar">
              <div class="rate__bar-inner" :class="barClass(r.rate)" :style="{ width: `${Math.min(r.rate, 100)}%` }" />
            </div>
          </div>
        </div>

        <div v-else class="empty">暂无合同/账单数据</div>
      </div>
    </div>

    <div class="tips">
      <span class="tips__icon">⚠️</span>
      <span>本页为原型数据展示，后续可接入后端接口替换本地 mock。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import OperatingStatCard from '~/components/admin/property/operating/components/OperatingStatCard.vue'
import OperatingExpiryWarning from '~/components/admin/property/operating/components/OperatingExpiryWarning.vue'
import OperatingRentTrendChart from '~/components/admin/property/operating/components/OperatingRentTrendChart.vue'
import { useOperatingOverview } from '~/composables/property/useOperatingOverview'

const {
  stats,
  expiringItems,
  rentTrend,
  collectionRates
} = useOperatingOverview()

const toWan = (amount: number, fixed = 1) => `¥${(amount / 10000).toFixed(fixed)}`

const pctClass = (rate: number) => (rate >= 100 ? 'is-good' : rate >= 50 ? 'is-warn' : 'is-bad')
const barClass = (rate: number) => (rate >= 100 ? 'is-good' : rate >= 50 ? 'is-warn' : 'is-bad')
</script>

<style scoped>
.page {
  padding: 14px;
  display: grid;
  gap: 14px;
}

.page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page__title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}

.page__subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--muted);
}

.stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1200px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.icon {
  font-size: 16px;
  line-height: 1;
}

.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 12px;
}

@media (max-width: 980px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.card {
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

.rates {
  display: grid;
  gap: 10px;
}

/* 固定高度 + 超出滚动，避免列表过长撑坏布局 */
.ratesScroll {
  max-height: 320px;
  overflow-y: auto;
  padding-right: 6px;
}

/* 滚动条（可选，美化） */
.ratesScroll::-webkit-scrollbar {
  width: 8px;
}

.ratesScroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 999px;
}

.ratesScroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
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
}

.rate__pct {
  font-weight: 700;
}

.rate__pct.is-good {
  color: #16a34a;
}

.rate__pct.is-warn {
  color: #d97706;
}

.rate__pct.is-bad {
  color: #dc2626;
}

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
}

.rate__bar-inner.is-good {
  background: #16a34a;
}

.rate__bar-inner.is-warn {
  background: #f59e0b;
}

.rate__bar-inner.is-bad {
  background: #dc2626;
}

.tips {
  font-size: 12px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tips__icon {
  font-size: 14px;
}
</style>
