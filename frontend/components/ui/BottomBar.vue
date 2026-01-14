<template>
  <footer class="bottom-bar" :class="{ 'sidebar-collapsed': !showRightSidebar }">
    <div class="left-info">
      <div class="pressure-display clickable" @click="setActiveNavItem('实时压力')" title="点击查看详情">
        <div class="pressure-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          实时压力
        </div>
        <div class="pressure-value">
          {{ realtimePressure.value.toFixed(2) }} 
          <span class="unit" :class="statusClass">{{ realtimePressure.unit }} ({{ realtimePressure.status }})</span>
        </div>
      </div>
      <div class="media-controls">
        <button 
          :class="{ active: isPlaying }" 
          @click="togglePlay" 
          :title="isPlaying ? '暂停数据模拟' : '开始数据模拟'"
        >
          {{ isPlaying ? '❚❚' : '►' }}
        </button>
        <span class="control-label">{{ isPlaying ? '模拟中' : '已暂停' }}</span>
        <button @click="resetView" title="重置视角">⟲</button>
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

    <!-- 窄屏下拉菜单 -->
    <div class="nav-dropdown">
      <button class="dropdown-trigger" @click="showDropdown = !showDropdown">
        {{ activeNavItem }}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <Transition name="dropdown">
        <div v-if="showDropdown" class="dropdown-menu" @click="showDropdown = false">
          <a 
            v-for="item in navItems" 
            :key="item"
            href="#" 
            :class="{ active: activeNavItem === item }"
            @click.prevent="setActiveNavItem(item)"
          >
            {{ item }}
          </a>
        </div>
      </Transition>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapState, type NavItemType } from '../../composables/useMapState'

const { 
  realtimePressure, 
  activeNavItem, 
  setActiveNavItem,
  showRightSidebar 
} = useMapState()

const navItems: NavItemType[] = ['管网类型', '管网编辑器', '建筑模型', '关联模型', '关联楼宇', '实时压力']

const isPlaying = ref(true)
const showDropdown = ref(false)

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

/* 可点击的压力显示 */
.pressure-display {
  text-align: center;
  margin-right: 20px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.pressure-display.clickable {
  cursor: pointer;
  border: 1px solid transparent;
}

.pressure-display.clickable:hover {
  background: rgba(0, 191, 255, 0.15);
  border-color: rgba(0, 191, 255, 0.3);
}

.pressure-label {
  font-size: 12px;
  color: #aaa;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.pressure-label svg {
  opacity: 0.7;
}

.pressure-display.clickable:hover .pressure-label {
  color: #00bfff;
}

.pressure-display.clickable:hover .pressure-label svg {
  opacity: 1;
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
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 11px;
  color: #888;
  min-width: 45px;
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

/* 正常导航 - 宽屏显示 */
.main-nav {
  display: flex;
  gap: 6px;
}

.main-nav a {
  color: #aaa;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 14px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.main-nav a:hover {
  color: white;
  background: rgba(0, 191, 255, 0.15);
}

.main-nav a.active {
  color: #00bfff;
  background: rgba(0, 191, 255, 0.2);
  border-color: rgba(0, 191, 255, 0.4);
}

/* 窄屏下拉菜单 - 默认隐藏 */
.nav-dropdown {
  display: none;
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 191, 255, 0.1);
  border: 1px solid rgba(0, 191, 255, 0.3);
  color: #00bfff;
  padding: 8px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.dropdown-trigger:hover {
  background: rgba(0, 191, 255, 0.2);
}

.dropdown-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: rgba(10, 22, 41, 0.95);
  border: 1px solid rgba(0, 191, 255, 0.3);
  border-radius: 8px;
  padding: 8px 0;
  margin-bottom: 8px;
  min-width: 140px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
}

.dropdown-menu a {
  display: block;
  color: #aaa;
  text-decoration: none;
  padding: 10px 16px;
  transition: all 0.2s;
  font-size: 14px;
}

.dropdown-menu a:hover {
  color: white;
  background: rgba(0, 191, 255, 0.15);
}

.dropdown-menu a.active {
  color: #00bfff;
  background: rgba(0, 191, 255, 0.1);
}

/* 下拉动画 */
.dropdown-enter-active, .dropdown-leave-active {
  transition: all 0.2s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 响应式处理 */
@media (max-width: 1100px) {
  .main-nav a {
    padding: 8px 10px;
    font-size: 13px;
  }
}

@media (max-width: 900px) {
  .main-nav {
    display: none;
  }
  
  .nav-dropdown {
    display: block;
  }
  
  .control-label {
    display: none;
  }
}

@media (max-width: 600px) {
  .pressure-display {
    margin-right: 10px;
  }
  
  .pressure-value {
    font-size: 14px;
  }
  
  .bottom-bar {
    padding: 0 12px;
  }
}
</style>
