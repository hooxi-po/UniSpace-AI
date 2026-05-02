<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">数据分析</h2>
        <p class="page__subtitle">经营收益深度分析、收缴率统计与承租方价值评估</p>
      </div>
    </div>

    <!-- 顶层指标卡片 -->
    <div class="stats">
      <OperatingStatCard title="活跃合同" :value="stats.activeContracts">
        <template #icon><span class="icon">📄</span></template>
      </OperatingStatCard>

      <OperatingStatCard title="待租房源" :value="stats.availableSpaces" icon-bg="rgba(168, 85, 247, 0.12)">
        <template #icon><span class="icon">🏢</span></template>
      </OperatingStatCard>

      <OperatingStatCard title="本月实收" :value="toWan(stats.monthlyIncome)" subtitle="单位：万元" icon-bg="rgba(34, 197, 94, 0.12)">
        <template #icon><span class="icon">💰</span></template>
      </OperatingStatCard>

      <OperatingStatCard title="逾期欠费" :value="toWan(stats.overdueAmount, 2)" subtitle="单位：万元" icon-bg="rgba(239, 68, 68, 0.12)">
        <template #icon><span class="icon">⚠️</span></template>
      </OperatingStatCard>
    </div>

    <!-- 中间层：趋势图与收缴分布 -->
    <div class="grid">
      <div class="card card--main">
        <div class="card__header">
          <h3 class="card__title">租金收入趋势 (万元)</h3>
        </div>
        <div class="card__body">
          <OperatingRentTrendChart :data="rentTrend" />
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <h3 class="card__title">本月收缴情况</h3>
        </div>
        <div class="card__body scrollable">
          <OperatingCollectionRateList :items="collectionRates" />
        </div>
      </div>
    </div>

    <!-- 底层：承租方排名 -->
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">承租方贡献排名</h3>
      </div>
      <div class="card__body">
        <OperatingTenantRankingTable :items="tenantRankings" />
      </div>
    </div>

    <div class="tips">
      <span class="tips__icon">💡</span>
      <span>数据分析页面已留好后端接口位，当前由 `useOperatingOverview` 汇总计算。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import OperatingStatCard from '~/components/admin/property/operating/components/OperatingStatCard.vue'
import OperatingRentTrendChart from '~/components/admin/property/operating/components/OperatingRentTrendChart.vue'
import OperatingCollectionRateList from '~/components/admin/property/operating/components/OperatingCollectionRateList.vue'
import OperatingTenantRankingTable from '~/components/admin/property/operating/components/OperatingTenantRankingTable.vue'
import { useOperatingOverview } from '~/composables/property/useOperatingOverview'

const {
  stats,
  rentTrend,
  collectionRates,
  tenantRankings
} = useOperatingOverview()

const toWan = (amount: number, fixed = 1) => `¥${(amount / 10000).toFixed(fixed)}`
</script>

<style scoped>
.page {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.page__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}

.page__subtitle {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.icon {
  font-size: 16px;
}

.grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}

.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.card__header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
}

.card__title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.card__body {
  padding: 16px;
}

.scrollable {
  max-height: 340px;
  overflow-y: auto;
}

.tips {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 8px;
  background: #f8fafc;
  border-radius: 8px;
}

@media (max-width: 1024px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
