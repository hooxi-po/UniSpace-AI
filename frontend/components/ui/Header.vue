<template>
  <header class="main-header" :class="{ 'sidebar-collapsed': !showRightSidebar }">
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
        <button class="control-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6m10-10h-6V4m0 6l7-7M3 21l7-7"></path></svg>
        </button>
        <button class="control-btn" title="设置" @click="showSettings = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
        </button>
      </div>
    </div>

    <!-- 设置面板 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
          <div class="settings-panel">
            <div class="settings-header">
              <h3>系统设置</h3>
              <button class="close-btn" @click="showSettings = false">×</button>
            </div>
            <div class="settings-content">
              <div class="setting-item">
                <span>深色模式</span>
                <label class="switch">
                  <input type="checkbox" v-model="darkMode">
                  <span class="slider"></span>
                </label>
              </div>
              <div class="setting-item">
                <span>显示性能信息</span>
                <label class="switch">
                  <input type="checkbox" v-model="showPerformance">
                  <span class="slider"></span>
                </label>
              </div>
              <div class="setting-item">
                <span>动画效果</span>
                <label class="switch">
                  <input type="checkbox" v-model="enableAnimations">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMapState } from '../../composables/useMapState'

const { showRightSidebar } = useMapState()

// 日期时间
const currentDate = ref('')
const currentTime = ref('')

const updateDateTime = () => {
  const now = new Date()
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// 全屏功能
const isFullscreen = ref(false)

const toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch (err) {
    console.error('全屏切换失败:', err)
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// 设置面板
const showSettings = ref(false)
const darkMode = ref(true)
const showPerformance = ref(false)
const enableAnimations = ref(true)

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  updateDateTime()
  timer = setInterval(updateDateTime, 1000)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
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
  transition: right 0.3s ease;
}

/* 侧边栏折叠时扩展 Header */
.main-header.sidebar-collapsed {
  right: 0;
}

.title-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0; /* 允许收缩 */
  flex: 1;
}

.main-header h1 {
  margin: 0;
  color: #ffffff;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 3px;
  text-shadow: 0 0 20px rgba(0, 180, 255, 0.4), 0 0 40px rgba(0, 180, 255, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 响应式标题 */
@media (max-width: 1200px) {
  .main-header h1 {
    font-size: 16px;
    letter-spacing: 2px;
  }
}

@media (max-width: 900px) {
  .main-header h1 {
    font-size: 14px;
    letter-spacing: 1px;
  }
}

@media (max-width: 700px) {
  .main-header h1 {
    white-space: normal;
    line-height: 1.3;
    font-size: 13px;
  }
  
  .main-header {
    height: auto;
    min-height: 60px;
    padding: 10px 16px;
  }
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
  flex-shrink: 0;
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

/* 设置面板样式 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.settings-panel {
  background: rgba(10, 22, 41, 0.95);
  border: 1px solid rgba(0, 191, 255, 0.4);
  border-radius: 12px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 191, 255, 0.2);
}

.settings-header h3 {
  margin: 0;
  color: #00bfff;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.settings-content {
  padding: 16px 20px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #ddd;
  font-size: 14px;
}

.setting-item:last-child {
  border-bottom: none;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.2);
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #00bfff;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

@media (max-width: 700px) {
  .datetime {
    display: none;
  }
}
</style>
