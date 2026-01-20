<template>
  <div class="h-full w-full flex items-center justify-center text-[10px] text-gray-500 border border-dashed border-white/20">
    [压力曲线占位 - 已移除 React 图表依赖]
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: Array<{ time: string; value: number }>
}

defineProps<Props>()
</script>
