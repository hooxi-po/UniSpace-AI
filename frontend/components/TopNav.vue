<template>
  <div class="absolute top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-30 pointer-events-auto">
    <!-- Logo & Title -->
    <div class="flex items-center gap-4">
      <div class="w-10 h-10 bg-tech-blue/20 border border-tech-cyan rounded flex items-center justify-center">
        <Network :size="20" class="text-tech-cyan" />
      </div>
      <div>
        <h1 class="text-lg font-bold text-white tracking-wide">校园地下管网运维系统</h1>
        <p class="text-xs text-gray-400 font-mono">CAMPUS UNDERGROUND NETWORK OPS</p>
      </div>
    </div>

    <!-- Status Indicators -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span class="text-xs text-gray-400 font-mono">系统在线</span>
      </div>
      <div class="flex items-center gap-2">
        <Activity :size="16" class="text-tech-cyan" />
        <span class="text-xs text-gray-400 font-mono">{{ currentTime }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Network, Activity } from 'lucide-vue-next'

const currentTime = ref('')

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
}

onMounted(() => {
  updateTime()
  const interval = setInterval(updateTime, 1000)
  
  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>
