<template>
  <div class="absolute right-4 bottom-4 flex flex-col gap-3 pointer-events-none z-20" style="top: 88px; width: 320px;">

    <!-- 1. 管网故障对比（柱状图） -->
    <TechPanel title="管网故障对比" class="pointer-events-auto shrink-0">
      <ClientOnly>
        <div ref="faultChartEl" class="w-full" style="height: 160px;" />
      </ClientOnly>
    </TechPanel>

    <!-- 2. 设备规模统计 -->
    <TechPanel title="设备规模" class="pointer-events-auto shrink-0">
      <div class="grid grid-cols-3 gap-2">
        <div v-for="item in deviceStats" :key="item.label" class="flex flex-col items-center p-2 bg-white/5 rounded border border-white/5">
          <span class="text-tech-cyan text-lg font-bold font-mono">{{ item.value }}</span>
          <span class="text-[10px] text-gray-400 text-center mt-0.5 leading-tight">{{ item.label }}</span>
        </div>
      </div>
    </TechPanel>

    <!-- 3. 预警情况 -->
    <TechPanel title="预警情况" class="pointer-events-auto" style="flex: 1; overflow: hidden;">
      <div class="overflow-hidden" style="max-height: 260px;">
        <div ref="warningListEl" class="flex flex-col gap-1.5">
          <div
            v-for="item in warningList"
            :key="item.name + item.time"
            class="flex items-center text-xs px-2 py-1.5 rounded-sm"
            :style="{ background: getTypeGradient(item.type) }"
          >
            <div class="w-1 h-3 rounded-full mr-2 shrink-0" :style="{ backgroundColor: getTypeColor(item.type) }" />
            <span class="flex-1 text-white/90 truncate">{{ item.name }}</span>
            <span class="text-white/50 mx-2 shrink-0">{{ item.event }}</span>
            <span class="text-white/40 shrink-0 font-mono">{{ item.time }}</span>
          </div>
        </div>
      </div>
    </TechPanel>

  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'

const faultChartEl = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const deviceStats = [
  { label: '供水节点', value: '127' },
  { label: '污水节点', value: '89' },
  { label: '排水节点', value: '63' },
  { label: '阀门', value: '234' },
  { label: '泵站', value: '18' },
  { label: '测点', value: '312' },
]

const warningList = ref([
  { name: '供水管道 #A12', event: '压力异常', type: 1, time: '08:21' },
  { name: '排水节点 #B07', event: '流量低', type: 2, time: '09:44' },
  { name: '污水泵站 #C03', event: '设备失联', type: 3, time: '10:12' },
  { name: '供水阀门 #D19', event: '开度异常', type: 1, time: '11:30' },
  { name: '排水管道 #E05', event: '水位高', type: 2, time: '12:53' },
  { name: '供水测点 #F11', event: '数据超限', type: 3, time: '14:15' },
  { name: '污水管道 #G02', event: '堵塞预警', type: 1, time: '14:45' },
  { name: '排水节点 #H08', event: '检测到异常', type: 2, time: '15:59' },
])

const typeColors: Record<number, string> = {
  1: '#74fabd',
  2: '#5bc7fa',
  3: '#f1bd49',
}

const getTypeColor = (type: number) => typeColors[type] ?? '#aaa'
const getTypeGradient = (type: number) => {
  const c = typeColors[type] ?? '#aaa'
  return `linear-gradient(90deg, ${c}33, transparent)`
}

const buildFaultOption = () => ({
  grid: { left: '2%', right: '4%', bottom: '0%', top: '16%', containLabel: true },
  legend: {
    show: true,
    right: 0,
    top: 0,
    textStyle: { color: '#fff', fontSize: 10 },
    itemWidth: 10,
    itemHeight: 10,
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#000',
    borderColor: '#333',
    textStyle: { color: '#fff', fontSize: 11 },
  },
  xAxis: {
    type: 'category',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#aaa', fontSize: 10, margin: 6 },
    data: ['08月', '09月', '10月', '11月', '12月'],
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#aaa', fontSize: 10 },
    splitLine: { lineStyle: { color: '#ffffff15', type: 'dashed' } },
  },
  series: [
    {
      name: '2024年',
      type: 'bar',
      barWidth: 12,
      data: [12, 18, 9, 15, 22],
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(0,254,169,1)' },
          { offset: 1, color: 'rgba(0,254,169,0.1)' },
        ]),
      },
    },
    {
      name: '2025年',
      type: 'bar',
      barWidth: 12,
      data: [8, 11, 7, 10, 14],
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(87,153,214,1)' },
          { offset: 1, color: 'rgba(87,153,214,0.1)' },
        ]),
      },
    },
  ],
})

onMounted(() => {
  nextTick(() => {
    if (faultChartEl.value) {
      chartInstance = echarts.init(faultChartEl.value, 'dark')
      chartInstance.setOption(buildFaultOption())
    }
  })
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>
