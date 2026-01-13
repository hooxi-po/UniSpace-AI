<template>
  <footer class="bottom-bar" :class="{ 'sidebar-collapsed': !showRightSidebar }">
    <div class="left-info">
      <div class="pressure-display">
        <div class="pressure-label">实时压力</div>
        <div class="pressure-value">
          {{ realtimePressure.value.toFixed(2) }} 
          <span class="unit" :class="statusClass">{{ realtimePressure.unit }} ({{ realtimePressure.status }})</span>
        </div>
      </div>
      <div class="media-controls">
        <button :class="{ active: isPlaying }" @click="togglePlay">
          {{ isPlaying ? '❚❚' : '►' }}
        </button>
        <button @click="resetView">⟲</button>
      </div>
    </div>

    <nav class="main-nav">
      <a 
        v-for="item in navItems" 
        :key="item"
        href="#" 
        :class="{ active: activeNavItem === item }"
        @click.prevent="setActiveNavItem(item)"
      >
        {{ item }}
      </a>
    </nav>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapState } from '../../composables/useMapState'

const { 
  realtimePressure, 
  activeNavItem, 
  setActiveNavItem,
  showRightSidebar 
} = useMapState()

const navItems = ['管网类型', '物联网设备', '建筑模型', '关联模型', '关联楼宇', '实时压力']

const isPlaying = ref(true)

const statusClass = computed(() => {
  switch (realtimePressure.value.status) {
    case '低': return 'status-low'
    case '高': return 'status-high'
    default: return 'status-normal'
  }
})

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const resetView = () => {
  // 触发重置视角事件（可以通过 emit 或全局状态）
  console.log('Reset view')
}
</script>

<style scoped>
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 25%;
  height: 60px;
  background: rgba(10, 22, 41, 0.9);
  border-top: 1px solid rgba(0, 191, 255, 0.3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 1000;
  backdrop-filter: blur(10px);
  transition: right 0.3s ease;
}

.bottom-bar.sidebar-collapsed {
  right: 0;
}

.left-info {
  display: flex;
  align-items: center;
}

.pressure-display {
  text-align: center;
  margin-right: 20px;
}

.pressure-label {
  font-size: 12px;
  color: #aaa;
}

.pressure-value {
  font-size: 18px;
  font-weight: bold;
}

.pressure-value .unit {
  font-size: 12px;
  font-weight: normal;
}

.status-low { color: #ffc107; }
.status-high { color: #dc3545; }
.status-normal { color: #28a745; }

.media-controls {
  display: flex;
  gap: 8px;
}

.media-controls button {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.media-controls button:hover {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
}

.media-controls button.active {
  background: rgba(0, 191, 255, 0.3);
  border-color: #00bfff;
}

.main-nav {
  display: flex;
  gap: 8px;
}

.main-nav a {
  color: #aaa;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 14px;
}

.main-nav a:hover {
  color: white;
  background: rgba(0, 191, 255, 0.15);
}

.main-nav a.active {
  color: white;
  background: rgba(0, 191, 255, 0.25);
  border: 1px solid rgba(0, 191, 255, 0.4);
}
</style>
