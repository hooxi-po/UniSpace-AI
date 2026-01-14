<template>
  <header class="main-header">
    <div class="title-section">
      <h1>基于GIS和数字孪生的校园地下管网运维系统</h1>
      <div class="glow-line">
        <div class="line-segment left"></div>
        <div class="line-center"></div>
        <div class="line-segment right"></div>
      </div>
    </div>
    
    <div class="header-controls">
      <div class="datetime">
        <span class="date">{{ currentDate }}</span>
        <span class="time">{{ currentTime }}</span>
      </div>
      <div class="control-buttons">
        <button class="control-btn" title="全屏">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        </button>
        <button class="control-btn" title="设置">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentDate = ref('')
const currentTime = ref('')

const updateDateTime = () => {
  const now = new Date()
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  updateDateTime()
  timer = setInterval(updateDateTime, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.main-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 25%;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: linear-gradient(180deg, rgba(8, 18, 35, 0.9) 0%, rgba(8, 18, 35, 0.6) 70%, transparent 100%);
  z-index: 1001;
  pointer-events: none;
}

.title-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.main-header h1 {
  margin: 0;
  color: #ffffff;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 3px;
  text-shadow: 0 0 20px rgba(0, 180, 255, 0.4), 0 0 40px rgba(0, 180, 255, 0.2);
}

.glow-line {
  display: flex;
  align-items: center;
  width: 100%;
  height: 2px;
}

.line-segment {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 180, 255, 0.6));
  flex: 1;
}

.line-segment.right {
  background: linear-gradient(90deg, rgba(0, 180, 255, 0.6), transparent);
}

.line-center {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, rgba(0, 180, 255, 0.3), #00b4ff, rgba(0, 180, 255, 0.3));
  box-shadow: 0 0 8px rgba(0, 180, 255, 0.8), 0 0 16px rgba(0, 180, 255, 0.4);
  border-radius: 1px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  pointer-events: auto;
}

.datetime {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: 'Roboto Mono', 'Consolas', monospace;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  line-height: 1.4;
}

.datetime .time {
  color: #00b4ff;
  font-size: 14px;
  text-shadow: 0 0 10px rgba(0, 180, 255, 0.5);
}

.control-buttons {
  display: flex;
  gap: 8px;
}

.control-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 180, 255, 0.1);
  border: 1px solid rgba(0, 180, 255, 0.3);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: rgba(0, 180, 255, 0.2);
  border-color: rgba(0, 180, 255, 0.6);
  color: #00b4ff;
  box-shadow: 0 0 12px rgba(0, 180, 255, 0.3);
}
</style>
