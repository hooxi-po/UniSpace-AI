<template>
  <div ref="chartContainer" class="base-chart"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  options: echarts.EChartsOption
}>()

const chartContainer = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const initChart = () => {
  if (chartContainer.value) {
    chartInstance = echarts.init(chartContainer.value, 'dark', {
      renderer: 'canvas',
      useDirtyRect: false
    })
    chartInstance.setOption(props.options)
  }
}

const resizeChart = () => {
  chartInstance?.resize()
}

watch(
  () => props.options,
  (newOptions) => {
    chartInstance?.setOption(newOptions)
  },
  { deep: true }
)

onMounted(async () => {
  await nextTick()
  initChart()
  window.addEventListener('resize', resizeChart)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  chartInstance?.dispose()
})

// Expose resize method if needed by parent
defineExpose({
  resize: resizeChart
})
</script>

<style scoped>
.base-chart {
  width: 100%;
  height: 100%;
  min-height: 150px;
}
</style>
