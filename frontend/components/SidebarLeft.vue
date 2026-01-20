<template>
  <div class="absolute left-4 top-20 bottom-4 w-80 flex flex-col gap-4 pointer-events-none">
    
    <!-- 1. Statistics Cards -->
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

    <!-- 2. Real-time Chart -->
    <TechPanel title="压力指标 (Bar)" class="flex-grow min-h-[200px] pointer-events-auto">
      <ClientOnly>
        <div class="h-full w-full -ml-4">
          <PressureChart :data="PRESSURE_DATA" />
        </div>
      </ClientOnly>
    </TechPanel>

    <!-- 3. Alert Log -->
    <TechPanel title="事件日志" class="pointer-events-auto">
      <div class="space-y-3">
        <div 
          v-for="alert in MOCK_ALERTS" 
          :key="alert.id" 
          class="group border-l-2 border-tech-red bg-tech-red/5 p-2 text-xs font-mono relative overflow-hidden transition-all hover:bg-tech-red/10 cursor-pointer"
        >
          <div class="flex justify-between text-gray-400 mb-1">
            <span>[{{ alert.timestamp }}]</span>
            <span>{{ alert.id }}</span>
          </div>
          <div class="text-white group-hover:text-tech-red transition-colors">
            {{ alert.message }}
          </div>
          <div 
            v-if="alert.level === 'critical'" 
            class="absolute inset-0 bg-tech-red/10 animate-pulse pointer-events-none" 
          />
        </div>
      </div>
    </TechPanel>
  </div>
</template>

<script setup lang="ts">
import { Droplet, Activity, AlertTriangle, Zap } from 'lucide-vue-next'
import { PRESSURE_DATA, MOCK_ALERTS } from '~/composables/useConstants'
</script>

<style scoped>
.text-tech-water {
  color: #10B981;
}
.text-tech-sewage {
  color: #8B5CF6;
}
.text-tech-drain {
  color: #3B82F6;
}
.text-tech-red {
  color: #FF4D4F;
}
</style>
