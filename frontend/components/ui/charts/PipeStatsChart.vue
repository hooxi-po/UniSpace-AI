<template>
  <div class="chart-container" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import * as echarts from 'echarts'
import { useMapState } from '../../../composables/useMapState'

const { pipes } = useMapState()
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)

const initChart = () => {
  if (!chartRef.value) return

  chartInstance.value = echarts.init(chartRef.value)
  updateChart()

  window.addEventListener('resize', handleResize)
}

const handleResize = () => {
  chartInstance.value?.resize()
}

const updateChart = () => {
  if (!chartInstance.value) return

  // Calculate stats
  const stats = {
    water: 0,
    sewage: 0,
    drainage: 0
  }

  pipes.value.forEach(pipe => {
    if (stats[pipe.type as keyof typeof stats] !== undefined) {
      stats[pipe.type as keyof typeof stats]++
    }
  })

  const total = pipes.value.length
  const data = [
    { value: stats.water, name: '供水', itemStyle: { color: '#00ff7f' } },
    { value: stats.sewage, name: '污水', itemStyle: { color: '#8b4513' } },
    { value: stats.drainage, name: '排水', itemStyle: { color: '#4169e1' } }
  ]

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 22, 41, 0.9)',
      borderColor: '#00bfff',
      textStyle: { color: '#fff' }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      textStyle: { color: '#aaa', fontSize: 10 },
      itemWidth: 8,
      itemHeight: 8
    },
    series: [
      {
        name: '管网统计',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#0a1629',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            color: '#fff'
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  }

  chartInstance.value.setOption(option)
}

watch(() => pipes.value, () => {
  updateChart()
}, { deep: true })

onMounted(() => {
  // Use a small delay to ensure container size is correct
  setTimeout(initChart, 200)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 200px;
}
</style>
