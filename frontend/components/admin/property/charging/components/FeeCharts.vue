<template>
  <div class="chartsGrid">
    <div class="chartCard">
      <div class="cardHeader">
        <h3 class="cardTitle">各单位定额与实占对比</h3>
      </div>
      <div class="chartContent scrollable">
        <div class="barChart">
          <div v-for="item in data" :key="item.name" class="barGroup">
            <div class="barLabel">{{ item.name }}</div>
            <div class="barArea">
              <!-- 定额条 -->
              <div class="barRow">
                <div class="barFill quota" :style="{ width: getWidth(item.quota) + '%' }"></div>
                <span class="barValue">{{ item.quota }}</span>
              </div>
              <!-- 实占条 -->
              <div class="barRow">
                <div 
                  class="barFill actual" 
                  :class="{ over: item.actual > item.quota }"
                  :style="{ width: getWidth(item.actual) + '%' }"
                ></div>
                <span class="barValue">{{ item.actual }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="chartLegend">
        <span class="legendItem"><i class="dot quota"></i> 定额面积</span>
        <span class="legendItem"><i class="dot actual"></i> 实际占用</span>
        <span class="legendItem"><i class="dot actual over"></i> 超额占用</span>
      </div>
    </div>

    <div class="chartCard">
      <div class="cardHeader">
        <h3 class="cardTitle">账单状态分布</h3>
      </div>
      <div class="chartContent flexCenter">
        <div class="statusRing">
          <div v-for="(val, label) in statusDist" :key="label" class="statusItem">
            <div class="statusInfo">
              <span class="sLabel">{{ label }}</span>
              <span class="sValue">{{ val }}</span>
            </div>
            <div class="sBarWrap">
              <div :class="['sBar', getStatusColorClass(label)]" :style="{ width: (val / totalBills * 100) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: {
    name: string
    quota: number
    actual: number
    cost: number
  }[]
}>()

const maxArea = computed(() => {
  const values = props.data.flatMap(d => [d.quota, d.actual])
  return Math.max(...values, 100)
})

function getWidth(val: number) {
  return (val / maxArea.value) * 85
}

const statusDist = computed(() => {
  return {
    '已完结': props.data.length - 1, // 模拟数据
    '待处理': 1,
    '争议中': 0
  }
})

const totalBills = computed(() => Object.values(statusDist.value).reduce((a, b) => a + b, 0))

function getStatusColorClass(label: string) {
  if (label === '已完结') return 'bgGreen'
  if (label === '待处理') return 'bgAmber'
  return 'bgRed'
}
</script>

<style scoped>
.chartsGrid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.chartCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.cardHeader {
  padding: 16px;
  border-bottom: 1px solid #eef0f2;
}

.cardTitle {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.chartContent {
  padding: 16px;
  flex: 1;
}

.chartContent.scrollable {
  max-height: 320px;
  overflow-y: auto;
}

.flexCenter {
  display: flex;
  align-items: center;
  justify-content: center;
}

.barChart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.barGroup {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  align-items: center;
}

.barLabel {
  font-size: 12px;
  color: #646a73;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.barArea {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.barRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.barFill {
  height: 8px;
  border-radius: 4px;
  transition: width 0.3s;
}

.barFill.quota { background: #e5e7eb; }
.barFill.actual { background: #3370ff; }
.barFill.actual.over { background: #f54a45; }

.barValue {
  font-size: 11px;
  color: #8f959e;
  min-width: 30px;
}

.chartLegend {
  padding: 12px 16px;
  border-top: 1px solid #eef0f2;
  display: flex;
  gap: 16px;
  justify-content: center;
}

.legendItem {
  font-size: 11px;
  color: #646a73;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot.quota { background: #e5e7eb; }
.dot.actual { background: #3370ff; }
.dot.actual.over { background: #f54a45; }

.statusRing {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.statusItem {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.statusInfo {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.sLabel { color: #646a73; }
.sValue { font-weight: 600; color: #1f2329; }

.sBarWrap {
  height: 6px;
  background: #f2f3f5;
  border-radius: 3px;
  overflow: hidden;
}

.sBar { height: 100%; border-radius: 3px; }
.bgGreen { background: #22c55e; }
.bgAmber { background: #f59e0b; }
.bgRed { background: #ef4444; }

@media (max-width: 900px) {
  .chartsGrid { grid-template-columns: 1fr; }
}
</style>

