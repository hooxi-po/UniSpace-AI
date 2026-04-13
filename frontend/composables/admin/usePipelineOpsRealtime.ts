import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'

export interface RealtimeConfig {
  enabled: Ref<boolean>
  interval: number // 轮询间隔（毫秒）
  onUpdate: () => void | Promise<void> // 检测到更新时的回调
}

export function usePipelineOpsRealtime(config: RealtimeConfig) {
  const lastUpdateTime = ref<number>(Date.now())
  const timerId = ref<number | null>(null)
  const isPolling = ref(false)

  async function runUpdate() {
    if (isPolling.value) return
    isPolling.value = true
    try {
      await config.onUpdate()
      lastUpdateTime.value = Date.now()
    } finally {
      isPolling.value = false
    }
  }

  // 开始轮询
  function startPolling() {
    if (timerId.value !== null) return
    if (!config.enabled.value) return

    timerId.value = window.setInterval(() => {
      if (!config.enabled.value) return
      void runUpdate()
    }, config.interval)
  }

  // 停止轮询
  function stopPolling() {
    if (timerId.value !== null) {
      clearInterval(timerId.value)
      timerId.value = null
    }
  }

  // 手动触发更新
  function triggerUpdate() {
    void runUpdate()
  }

  // 监听 enabled 变化
  watch(() => config.enabled.value, (enabled) => {
    if (enabled) {
      startPolling()
      triggerUpdate()
    } else {
      stopPolling()
    }
  })

  // 页面可见性变化时暂停/恢复轮询
  function handleVisibilityChange() {
    if (document.hidden) {
      stopPolling()
    } else if (config.enabled.value) {
      startPolling()
      // 页面重新可见时立即触发一次更新
      triggerUpdate()
    }
  }

  onMounted(() => {
    if (config.enabled.value) {
      startPolling()
      triggerUpdate()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    lastUpdateTime,
    isPolling,
    startPolling,
    stopPolling,
    triggerUpdate,
  }
}
