<template>
  <div class="statsGrid">
    <div class="statCard">
      <div class="statIcon bgBlue"><DollarSign :size="20" /></div>
      <div class="statInfo">
        <div class="statValue">¥{{ (stats.totalAmount / 10000).toFixed(1) }}万</div>
        <div class="statLabel">应收总额</div>
      </div>
    </div>
    <div class="statCard">
      <div class="statIcon bgGreen"><CheckCircle :size="20" /></div>
      <div class="statInfo">
        <div class="statValue">¥{{ (stats.paidAmount / 10000).toFixed(1) }}万</div>
        <div class="statLabel">已收金额</div>
        <div class="statSub">收缴率 {{ collectRate }}%</div>
      </div>
    </div>
    <div class="statCard">
      <div class="statIcon bgAmber"><Clock :size="20" /></div>
      <div class="statInfo">
        <div class="statValue">{{ stats.pendingCount }}</div>
        <div class="statLabel">待处理账单</div>
      </div>
    </div>
    <div class="statCard">
      <div class="statIcon bgRed"><AlertTriangle :size="20" /></div>
      <div class="statInfo">
        <div class="statValue">{{ stats.overQuotaCount }}</div>
        <div class="statLabel">超额占用单位</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  stats: {
    totalAmount: number
    paidAmount: number
    pendingCount: number
    overQuotaCount: number
  }
}>()

const collectRate = computed(() => {
  if (props.stats.totalAmount === 0) return 0
  return ((props.stats.paidAmount / props.stats.totalAmount) * 100).toFixed(0)
})
</script>

<style scoped>
.statsGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.statCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.statIcon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bgBlue { background: #eff6ff; color: #1d4ed8; }
.bgGreen { background: #ecfdf5; color: #047857; }
.bgAmber { background: #fff7ed; color: #c2410c; }
.bgRed { background: #fef2f2; color: #dc2626; }

.statValue {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.statLabel {
  font-size: 12px;
  color: #8f959e;
  margin-top: 2px;
}

.statSub {
  font-size: 11px;
  color: #646a73;
  margin-top: 2px;
}

@media (max-width: 1200px) {
  .statsGrid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .statsGrid { grid-template-columns: 1fr; }
}
</style>
