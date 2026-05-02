<template>
  <div class="page">
    <div class="pageHeader">
      <div>
        <h2 class="title">综合分析</h2>
        <p class="subtitle">从申请、库存、借用多维度查看房源配置效率</p>
      </div>
      <button class="btn" :disabled="loading" @click="fetchData">
        <RefreshCw :size="16" :class="loading ? 'spinning' : ''" />
        刷新数据
      </button>
    </div>

    <div class="statGrid">
      <div class="statCard">
        <div class="statCard__label"><Clock :size="16" /> 待审批申请</div>
        <div class="statCard__value">{{ stats.pendingApproval }}</div>
      </div>
      <div class="statCard">
        <div class="statCard__label"><Home :size="16" /> 空置房间</div>
        <div class="statCard__value">{{ stats.availableRooms }}</div>
      </div>
      <div class="statCard">
        <div class="statCard__label"><Building :size="16" /> 可分配面积</div>
        <div class="statCard__value">{{ stats.totalAvailableArea }}㎡</div>
      </div>
      <div class="statCard">
        <div class="statCard__label"><Calendar :size="16" /> 临借将到期</div>
        <div class="statCard__value">{{ stats.expiringBorrows }}</div>
      </div>
    </div>

    <div class="chartRow">
      <div class="panel">
        <div class="panel__title"><BarChart3 :size="16" /> 房间占用率</div>
        <div class="rateWrap">
          <div class="rateValue">{{ occupancyRate }}%</div>
          <div class="rateBar">
            <div class="rateBar__inner" :style="{ width: `${occupancyRate}%` }" />
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__title"><PieChart :size="16" /> 建筑分布</div>
        <div class="list">
          <div v-for="it in buildingDistribution" :key="it.name" class="listItem">
            <div class="listItem__name">{{ it.name }}</div>
            <div class="listItem__meta">
              总{{ it.total }} · 空{{ it.available }}
              <span class="percent">{{ getPercent(it.available, it.total) }}%</span>
            </div>
          </div>
          <div v-if="buildingDistribution.length === 0" class="empty">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw, Clock, Home, Calendar, BarChart3, PieChart, Building } from 'lucide-vue-next'
import { useAllocationAnalysis } from '~/composables/property/useAllocationAnalysis'

const { loading, stats, buildingDistribution, fetchData } = useAllocationAnalysis()

const occupancyRate = computed(() => {
  if (stats.value.totalRooms === 0) return 0
  return Number(((stats.value.occupiedRooms / stats.value.totalRooms) * 100).toFixed(1))
})

function getPercent(val: number, total: number) {
  if (!total) return 0
  return Number(((val / total) * 100).toFixed(1))
}
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.pageHeader { display: flex; justify-content: space-between; align-items: center; }
.title { margin: 0; font-size: 20px; font-weight: 800; }
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); background: #fff; border-radius: 8px;
  padding: 8px 12px; cursor: pointer;
}

.statGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.statCard {
  background: #fff; border: 1px solid var(--border);
  border-radius: 12px; padding: 14px;
}

.statCard__label { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.statCard__value { margin-top: 8px; font-size: 22px; font-weight: 800; }

.chartRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.panel { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
.panel__title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; margin-bottom: 12px; }

.rateWrap { display: grid; gap: 8px; }
.rateValue { font-size: 28px; font-weight: 800; }
.rateBar { height: 8px; border-radius: 999px; background: #eef2ff; overflow: hidden; }
.rateBar__inner { height: 100%; background: var(--primary); }

.list { display: grid; gap: 8px; }
.listItem { padding: 8px; border: 1px solid var(--border-light); border-radius: 8px; }
.listItem__name { font-weight: 600; }
.listItem__meta { color: var(--muted); font-size: 12px; margin-top: 4px; }
.percent { margin-left: 6px; color: var(--primary); font-weight: 700; }

.empty { color: var(--muted); font-size: 13px; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
