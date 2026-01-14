<template>
  <Transition name="slide-left">
    <aside v-if="showLeftSidebar" class="left-sidebar">
      <div class="corner top-left"></div>
      <div class="corner top-right"></div>
      <div class="corner bottom-left"></div>
      <div class="corner bottom-right"></div>
      <div class="sidebar-header">
        <h3><component :is="currentPanel.icon" /><span>{{ currentPanel.title }}</span></h3>
        <button class="close-button" @click="toggleLeftSidebar">×</button>
      </div>
      <div class="sidebar-content">
        <template v-if="activeNavItem === '管网类型'">
          <section class="layer-section" :class="{ collapsed: collapsedSections.pipe }">
            <h4 @click="toggleSection('pipe')"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg><span>管网分类</span><span class="toggle-arrow"></span></h4>
            <ul>
              <li><label><span class="color-indicator" style="background-color: #00bfff;"></span><input type="checkbox" :checked="layers.pipes" @change="toggleLayer('pipes')"> 水量管网</label></li>
              <li><label><span class="color-indicator" style="background-color: #00ff7f;"></span><input type="checkbox" :checked="layers.waterSupply" @change="toggleLayer('waterSupply')"> 供水管网</label></li>
              <li><label><span class="color-indicator" style="background-color: #ffc107;"></span><input type="checkbox" :checked="layers.pressure" @change="toggleLayer('pressure')"> 压力管网</label></li>
              <li><label><span class="color-indicator" style="background-color: #dc3545;"></span><input type="checkbox" :checked="layers.power" @change="toggleLayer('power')"> 电力管网</label></li>
            </ul>
          </section>
        </template>
        <template v-else-if="activeNavItem === '物联网设备'">
          <section class="info-section">
            <div class="stat-card"><div class="stat-value">128</div><div class="stat-label">设备总数</div></div>
            <div class="stat-card online"><div class="stat-value">115</div><div class="stat-label">在线设备</div></div>
            <div class="stat-card warning"><div class="stat-value">8</div><div class="stat-label">告警设备</div></div>
            <div class="stat-card offline"><div class="stat-value">5</div><div class="stat-label">离线设备</div></div>
          </section>
          <section class="layer-section"><h4><span>设备列表</span></h4>
            <!-- Loading 骨架屏 -->
            <div v-if="isLoadingDevices" class="skeleton-list">
              <div class="skeleton-item" v-for="i in 5" :key="i">
                <div class="skeleton-dot"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-value"></div>
              </div>
            </div>
            <ul v-else class="device-list"><li v-for="device in iotDevices" :key="device.id"><span class="device-status" :class="device.status"></span><span class="device-name">{{ device.name }}</span><span class="device-value">{{ device.value }}</span></li></ul>
          </section>
        </template>
        <template v-else-if="activeNavItem === '建筑模型'">
          <section class="layer-section"><h4><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span>显示控制</span></h4><ul><li><label><input type="checkbox" :checked="layers.buildings" @change="toggleLayer('buildings')"> 3D建筑模型</label></li></ul></section>
          <section class="info-section"><div class="info-item"><span>建筑总数</span><span class="value">42</span></div><div class="info-item"><span>教学楼</span><span class="value">12</span></div><div class="info-item"><span>宿舍楼</span><span class="value">18</span></div><div class="info-item"><span>其他建筑</span><span class="value">12</span></div></section>
        </template>
        <template v-else-if="activeNavItem === '关联模型'">
          <section class="info-section"><p class="panel-desc">管网与建筑的关联关系</p><div class="relation-list"><div class="relation-item" v-for="item in relationModels" :key="item.building"><div class="relation-building">{{ item.building }}</div><div class="relation-pipes"><span v-for="pipe in item.pipes" :key="pipe" class="pipe-tag">{{ pipe }}</span></div></div></div></section>
        </template>
        <template v-else-if="activeNavItem === '关联楼宇'">
          <section class="info-section"><p class="panel-desc">选择楼宇查看关联管网</p><div class="building-list"><div class="building-item" v-for="building in buildings" :key="building.name" :class="{ active: selectedBuilding === building.name }" @click="selectedBuilding = building.name"><span class="building-name">{{ building.name }}</span><span class="building-count">{{ building.pipeCount }} 条管网</span></div></div></section>
        </template>
        <template v-else-if="activeNavItem === '实时压力'">
          <section class="info-section">
            <div class="pressure-gauge">
              <div class="gauge-value" :class="realtimePressure.status">{{ realtimePressure.value.toFixed(2) }}<span class="unit">{{ realtimePressure.unit }}</span></div>
              <div class="gauge-status">状态: {{ realtimePressure.status }}</div>
            </div>
            <!-- Loading 骨架屏 -->
            <div v-if="isLoadingPressure" class="skeleton-list">
              <div class="skeleton-item" v-for="i in 5" :key="i">
                <div class="skeleton-text long"></div>
                <div class="skeleton-value"></div>
              </div>
            </div>
            <div v-else class="pressure-list">
              <div class="pressure-item" v-for="point in pressurePoints" :key="point.name">
                <span class="point-name">{{ point.name }}</span>
                <span class="point-value" :class="point.status">{{ point.value }} MPa</span>
              </div>
            </div>
          </section>
        </template>
      </div>
    </aside>
  </Transition>
  <Transition name="fade"><button v-if="!showLeftSidebar" class="expand-button left" @click="toggleLeftSidebar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg></button></Transition>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useMapState } from '../../composables/useMapState'

const { layers, toggleLayer, showLeftSidebar, toggleLeftSidebar, activeNavItem, realtimePressure } = useMapState()

const collapsedSections = ref({ pipe: false })
type Section = keyof typeof collapsedSections.value
const toggleSection = (section: Section) => { collapsedSections.value[section] = !collapsedSections.value[section] }

const panelConfig = {
  '管网类型': { title: '管网类型', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' })]) },
  '物联网设备': { title: '物联网设备', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }), h('rect', { x: 9, y: 9, width: 6, height: 6 })]) },
  '建筑模型': { title: '建筑模型', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' })]) },
  '关联模型': { title: '关联模型', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('circle', { cx: 12, cy: 12, r: 10 }), h('line', { x1: 2, y1: 12, x2: 22, y2: 12 })]) },
  '关联楼宇': { title: '关联楼宇', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('rect', { x: 4, y: 2, width: 16, height: 20, rx: 2 }), h('path', { d: 'M9 22v-4h6v4' })]) },
  '实时压力': { title: '实时压力', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('circle', { cx: 12, cy: 12, r: 10 }), h('path', { d: 'M12 6v6l4 2' })]) }
}
const currentPanel = computed(() => panelConfig[activeNavItem.value] || panelConfig['管网类型'])

// Loading 状态
const isLoadingDevices = ref(true)
const isLoadingPressure = ref(true)

// 模拟数据加载
const iotDevices = ref<Array<{ id: number; name: string; value: string; status: string }>>([])
const pressurePoints = ref<Array<{ name: string; value: string; status: string }>>([])

onMounted(() => {
  // 模拟设备数据加载
  setTimeout(() => {
    iotDevices.value = [
      { id: 1, name: '流量计-001', value: '28.5 m³/h', status: 'online' },
      { id: 2, name: '压力传感器-002', value: '0.45 MPa', status: 'warning' },
      { id: 3, name: '水位计-003', value: '2.3 m', status: 'online' },
      { id: 4, name: '阀门控制器-004', value: '开启', status: 'online' },
      { id: 5, name: '温度传感器-005', value: '18.5°C', status: 'offline' }
    ]
    isLoadingDevices.value = false
  }, 1200)

  // 模拟压力数据加载
  setTimeout(() => {
    pressurePoints.value = [
      { name: '主入口阀门', value: '0.52', status: '正常' },
      { name: '图书馆分支', value: '0.45', status: '低' },
      { name: '教学区主管', value: '0.48', status: '正常' },
      { name: '宿舍区分支', value: '0.38', status: '低' },
      { name: '食堂供水点', value: '0.55', status: '正常' }
    ]
    isLoadingPressure.value = false
  }, 1500)
})

const relationModels = ref([{ building: '图书馆', pipes: ['供水主管', '消防管道', '排水管'] },{ building: '教学楼A', pipes: ['供水支管', '暖气管道'] },{ building: '学生宿舍1号楼', pipes: ['供水管', '排污管', '燃气管'] }])
const buildings = ref([{ name: '图书馆', pipeCount: 5 },{ name: '教学楼A', pipeCount: 3 },{ name: '教学楼B', pipeCount: 4 },{ name: '学生宿舍1号楼', pipeCount: 6 },{ name: '食堂', pipeCount: 8 }])
const selectedBuilding = ref('')
</script>

<style scoped>
.left-sidebar { position: fixed; top: 72px; left: 20px; width: 300px; max-height: calc(100vh - 150px); background: rgba(10, 22, 41, 0.9); border: 1px solid rgba(0, 191, 255, 0.3); border-radius: 8px; color: white; z-index: 1000; backdrop-filter: blur(10px); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; }
.expand-button { position: fixed; top: 72px; background: rgba(10, 22, 41, 0.9); border: 1px solid rgba(0, 191, 255, 0.5); border-radius: 8px; color: #00bfff; padding: 12px; cursor: pointer; z-index: 1000; transition: all 0.3s; }
.expand-button.left { left: 20px; }
.expand-button:hover { background: rgba(0, 191, 255, 0.2); transform: scale(1.05); }
.slide-left-enter-active, .slide-left-leave-active { transition: all 0.3s ease; }
.slide-left-enter-from, .slide-left-leave-to { opacity: 0; transform: translateX(-100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.corner { position: absolute; width: 15px; height: 15px; border-color: #00bfff; border-style: solid; }
.top-left { top: -2px; left: -2px; border-width: 2px 0 0 2px; }
.top-right { top: -2px; right: -2px; border-width: 2px 2px 0 0; }
.bottom-left { bottom: -2px; left: -2px; border-width: 0 0 2px 2px; }
.bottom-right { bottom: -2px; right: -2px; border-width: 0 2px 2px 0; }
.sidebar-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(0, 191, 255, 0.3); flex-shrink: 0; }
.sidebar-header h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 10px; color: #00bfff; }
.close-button { background: none; border: none; color: #aaa; font-size: 24px; cursor: pointer; transition: color 0.2s; }
.close-button:hover { color: #fff; }

/* 自定义滚动条样式 */
.sidebar-content { 
  padding: 12px; 
  overflow-y: auto; 
  flex: 1; 
}
.sidebar-content::-webkit-scrollbar {
  width: 6px;
}
.sidebar-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}
.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(0, 191, 255, 0.4);
  border-radius: 3px;
}
.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 191, 255, 0.6);
}

.layer-section h4 { display: flex; align-items: center; padding: 10px 8px; margin: 0; cursor: pointer; background: rgba(0, 191, 255, 0.1); border-radius: 4px; transition: background 0.3s; font-size: 14px; }
.layer-section h4:hover { background: rgba(0, 191, 255, 0.2); }
.layer-section h4 svg { margin-right: 10px; }

/* 箭头方向：展开时向下，折叠时向右 */
.toggle-arrow { 
  margin-left: auto; 
  border: solid white; 
  border-width: 0 2px 2px 0; 
  display: inline-block; 
  padding: 3px; 
  transform: rotate(45deg); /* 向下 = 展开状态 */
  transition: transform 0.3s; 
}
.layer-section.collapsed .toggle-arrow { 
  transform: rotate(-45deg); /* 向右 = 折叠状态 */
}

.layer-section ul { list-style: none; padding: 0 0 0 16px; margin: 10px 0; max-height: 500px; overflow: hidden; transition: ma    x-height 0.5s ease-in-out; }
.layer-section.collapsed ul { max-height: 0; margin: 0; }
.layer-section li { padding: 8px 0; }
.layer-section label { display: flex; align-items: center; cursor: pointer; font-size: 14px; }
.color-indicator { width: 14px; height: 14px; border-radius: 3px; margin-right: 10px; flex-shrink: 0; }
.layer-section input[type="checkbox"] { margin-right: 10px; cursor: pointer; }
.info-section { padding: 8px 0; }
.stat-card { display: inline-flex; flex-direction: column; align-items: center; width: calc(50% - 8px); margin: 4px; padding: 12px; background: rgba(0, 191, 255, 0.1); border: 1px solid rgba(0, 191, 255, 0.2); border-radius: 6px; }
.stat-card .stat-value { font-size: 24px; font-weight: bold; color: #00bfff; }
.stat-card .stat-label { font-size: 12px; color: #aaa; margin-top: 4px; }
.stat-card.online .stat-value { color: #00ff7f; }
.stat-card.warning .stat-value { color: #ffc107; }
.stat-card.offline .stat-value { color: #dc3545; }
.device-list { padding: 0 !important; }
.device-list li { display: flex; align-items: center; padding: 10px 8px !important; border-bottom: 1px solid rgba(255,255,255,0.1); }
.device-status { width: 8px; height: 8px; border-radius: 50%; margin-right: 10px; }
.device-status.online { background: #00ff7f; box-shadow: 0 0 6px #00ff7f; }
.device-status.warning { background: #ffc107; box-shadow: 0 0 6px #ffc107; }
.device-status.offline { background: #dc3545; }
.device-name { flex: 1; font-size: 13px; }
.device-value { color: #00bfff; font-size: 12px; }
.info-item { display: flex; justify-content: space-between; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 14px; }
.info-item .value { color: #00bfff; font-weight: bold; }
.panel-desc { color: #aaa; font-size: 13px; margin: 0 0 12px; padding: 0 8px; }
.relation-item { padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 8px; }
.relation-building { font-weight: bold; margin-bottom: 6px; color: #fff; }
.relation-pipes { display: flex; flex-wrap: wrap; gap: 6px; }
.pipe-tag { background: rgba(0, 191, 255, 0.2); border: 1px solid rgba(0, 191, 255, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.building-item { display: flex; justify-content: space-between; padding: 10px 12px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
.building-item:hover { background: rgba(0, 191, 255, 0.1); }
.building-item.active { border-color: #00bfff; background: rgba(0, 191, 255, 0.15); }
.building-name { font-size: 14px; }
.building-count { color: #aaa; font-size: 12px; }
.pressure-gauge { text-align: center; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 12px; }
.gauge-value { font-size: 36px; font-weight: bold; color: #00bfff; }
.gauge-value.低 { color: #ffc107; }
.gauge-value.高 { color: #dc3545; }
.gauge-value .unit { font-size: 16px; font-weight: normal; }
.gauge-status { color: #aaa; margin-top: 8px; }
.pressure-list { margin-top: 8px; }
.pressure-item { display: flex; justify-content: space-between; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 13px; }
.point-value { font-weight: bold; }
.point-value.正常 { color: #00ff7f; }
.point-value.低 { color: #ffc107; }
.point-value.高 { color: #dc3545; }

/* 骨架屏 Loading 样式 */
.skeleton-list {
  padding: 0 8px;
}
.skeleton-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.skeleton-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(0, 191, 255, 0.2);
  margin-right: 10px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-text {
  flex: 1;
  height: 14px;
  background: rgba(0, 191, 255, 0.15);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-text.long {
  max-width: 120px;
}
.skeleton-value {
  width: 60px;
  height: 14px;
  background: rgba(0, 191, 255, 0.15);
  border-radius: 4px;
  margin-left: 10px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
