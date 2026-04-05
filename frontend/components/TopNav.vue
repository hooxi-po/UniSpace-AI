<template>
  <div class="absolute top-0 left-0 right-0 h-20 z-30 pointer-events-auto" style="background-image: linear-gradient(180deg, rgba(0,11,26,0.95) 0%, rgba(0,11,26,0.7) 100%);">
    <!-- 顶部发光线 -->
    <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-tech-cyan/60 to-transparent" />
    <!-- 底部边框 -->
    <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

    <!-- 左侧：通知滚动 -->
    <div class="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-3 w-[360px]">
      <div class="flex items-center gap-2 shrink-0">
        <div class="w-1.5 h-1.5 bg-tech-cyan rounded-full animate-pulse" />
        <span class="text-tech-cyan text-xs font-mono uppercase tracking-widest">Notice</span>
      </div>
      <div class="overflow-hidden flex-1">
        <div class="notice-scroll text-xs text-white/70 font-mono whitespace-nowrap">
          【系统通知】校园地下管网运维系统已上线，实时监控供水、污水、排水三大管网，守护校园基础设施安全运行。&nbsp;&nbsp;&nbsp;&nbsp;【系统通知】校园地下管网运维系统已上线，实时监控供水、污水、排水三大管网，守护校园基础设施安全运行。
        </div>
      </div>
    </div>

    <!-- 中间：主标题 -->
    <div class="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center">
      <h1 class="text-2xl font-bold tracking-widest title-gradient font-mono">校园地下管网运维系统</h1>
      <p class="text-[10px] tracking-[0.3em] text-white/50 font-mono uppercase mt-0.5">Campus Underground Network Operations System</p>
    </div>

    <!-- 右侧：时间/状态 -->
    <div class="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-5">
      <NuxtLink
        to="/admin"
        class="flex items-center gap-1.5 px-3 py-1 rounded border border-tech-cyan/40 bg-tech-cyan/5 hover:bg-tech-cyan/15 text-xs text-tech-cyan font-mono transition-colors"
      >
        后台大厅
      </NuxtLink>
      <div class="flex items-center gap-4 text-xs font-mono">
        <div class="flex items-center gap-1.5">
          <div class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span class="text-green-400">系统在线</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="text-white/90 text-sm font-bold">{{ currentTime }}</span>
          <span class="text-white/40 text-[10px]">{{ currentDate }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const currentTime = ref('')
const currentDate = ref('')

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(() => {
  updateTime()
  const interval = setInterval(updateTime, 1000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<style scoped>
.title-gradient {
  background: linear-gradient(0deg, #7eb3ff 0%, #ffffff 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes notice-roll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.notice-scroll {
  animation: notice-roll 20s linear infinite;
  display: inline-block;
}
</style>
