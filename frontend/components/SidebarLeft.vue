<template>
  <div class="absolute left-4 bottom-4 flex flex-col gap-3 pointer-events-none z-20" style="top: 88px; width: 320px;">

    <!-- 1. 系统状态概览 -->
    <TechPanel title="系统状态概览" class="pointer-events-auto shrink-0">
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-white/5 p-2 rounded flex flex-col items-center border border-white/5">
          <Droplet class="text-tech-water w-5 h-5 mb-1" />
          <span class="text-[10px] text-gray-400">供水管网</span>
          <span class="font-mono text-tech-water font-bold">98%</span>
        </div>
        <div class="bg-white/5 p-2 rounded flex flex-col items-center border border-white/5">
          <Activity class="text-tech-sewage w-5 h-5 mb-1" />
          <span class="text-[10px] text-gray-400">污水管网</span>
          <span class="font-mono text-tech-sewage font-bold">正常</span>
        </div>
        <div class="bg-white/5 p-2 rounded flex flex-col items-center border border-white/5">
          <AlertTriangle class="text-tech-drain w-5 h-5 mb-1" />
          <span class="text-[10px] text-gray-400">排水管网</span>
          <span class="font-mono text-tech-red animate-pulse font-bold">警告</span>
        </div>
        <div class="bg-white/5 p-2 rounded flex flex-col items-center border border-white/5">
          <Zap class="text-yellow-400 w-5 h-5 mb-1" />
          <span class="text-[10px] text-gray-400">电力供应</span>
          <span class="font-mono text-yellow-400 font-bold">稳定</span>
        </div>
      </div>
    </TechPanel>

    <!-- 2. 压力实时曲线（ECharts） -->
    <TechPanel title="管网压力实时曲线 (Bar)" class="pointer-events-auto" style="flex: 1; min-height: 200px;">
      <ClientOnly>
        <div ref="pressureChartEl" class="w-full" style="height: 180px;" />
      </ClientOnly>
    </TechPanel>

    <!-- 3. 事件日志 -->
    <TechPanel title="事件日志" class="pointer-events-auto shrink-0">
      <div class="space-y-2 max-h-48 overflow-hidden">
        <div
          v-for="alert in MOCK_ALERTS"
          :key="alert.id"
          class="group border-l-2 border-tech-red bg-tech-red/5 p-2 text-xs font-mono relative overflow-hidden transition-all hover:bg-tech-red/10 cursor-pointer"
        >
          <div class="flex justify-between text-gray-400 mb-0.5">
            <span>[{{ alert.timestamp }}]</span>
            <span>{{ alert.id }}</span>
          </div>
          <div class="text-white group-hover:text-tech-red transition-colors">{{ alert.message }}</div>
          <div v-if="alert.level === 'critical'" class="absolute inset-0 bg-tech-red/10 animate-pulse pointer-events-none" />
        </div>
      </div>
    </TechPanel>

  </div>
</template>

<script setup lang="ts">
import { Droplet, Activity, AlertTriangle, Zap } from 'lucide-vue-next'
import { MOCK_ALERTS } from '~/composables/useConstants'
import * as echarts from 'echarts'

const pressureChartEl = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const buildPressureOption = () => ({
  grid: { left: '2%', right: '6%', bottom: '0%', top: '8%', containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#000',
    borderColor: '#333',
    textStyle: { color: '#fff', fontSize: 11 },
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#aaa', fontSize: 10, margin: 6 },
    data: ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#aaa', fontSize: 10 },
    splitLine: { lineStyle: { color: '#ffffff15', type: 'dashed' } },
  },
  series: [
    {
      name: '供水',
      type: 'line',
      symbol: 'none',
      smooth: true,
      lineStyle: { width: 2, color: '#00fea9' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(0,254,169,0.3)' },
        { offset: 1, color: 'rgba(0,254,169,0)' },
      ])},
      data: [2.8, 3.1, 2.9, 3.4, 3.2, 2.7, 3.0],
    },
    {
      name: '排水',
      type: 'line',
      symbol: 'none',
      smooth: true,
      lineStyle: { width: 2, color: '#5799d6' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(87,153,214,0.25)' },
        { offset: 1, color: 'rgba(87,153,214,0)' },
      ])},
      data: [1.2, 1.5, 1.1, 1.7, 1.4, 1.3, 1.6],
    },
  ],
})

onMounted(() => {
  nextTick(() => {
    if (pressureChartEl.value) {
      chartInstance = echarts.init(pressureChartEl.value, 'dark')
      chartInstance.setOption(buildPressureOption())
    }
  })
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<style scoped>
.text-tech-water { color: #10B981; }
.text-tech-sewage { color: #8B5CF6; }
.text-tech-drain { color: #3B82F6; }
.text-tech-red { color: #FF4D4F; }
</style>
