<template>
  <aside class="left-sidebar">
    <div class="corner top-left"></div>
    <div class="corner top-right"></div>
    <div class="corner bottom-left"></div>
    <div class="corner bottom-right"></div>

    <div class="sidebar-header">
      <h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        <span>图层</span>
      </h3>
      <button class="close-button">×</button>
    </div>
    <div class="sidebar-content">
      <section class="layer-section" :class="{ collapsed: collapsedSections.pipe }">
        <h4 @click="toggleSection('pipe')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
          <span>管网类型</span>
          <span class="toggle-arrow"></span>
        </h4>
        <ul>
          <li><label><span class="color-indicator" style="background-color: #00bfff;"></span><input type="checkbox" :checked="layers.pipes" @change="() => toggleLayer('pipes')"> 水量</label></li>
          <li><label><span class="color-indicator" style="background-color: #00ff7f;"></span><input type="checkbox" :checked="layers.waterSupply" @change="() => toggleLayer('waterSupply')"> 供水</label></li>
          <li><label><span class="color-indicator" style="background-color: #ffc107;"></span><input type="checkbox" :checked="layers.pressure" @change="() => toggleLayer('pressure')"> 压力常</label></li>
          <li><label><span class="color-indicator" style="background-color: #dc3545;"></span><input type="checkbox" :checked="layers.power" @change="() => toggleLayer('power')"> 电源</label></li>
        </ul>
      </section>

      <section class="layer-section" :class="{ collapsed: collapsedSections.iot }">
        <h4 @click="toggleSection('iot')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
          <span>物联网设备</span>
          <span class="toggle-arrow"></span>
        </h4>
        <ul>
          <li><label><input type="checkbox" :checked="layers.iotDevices" @change="() => toggleLayer('iotDevices')"> 物联网设备</label></li>
        </ul>
      </section>

      <section class="layer-section" :class="{ collapsed: collapsedSections.building }">
        <h4 @click="toggleSection('building')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>建筑模型</span>
          <span class="toggle-arrow"></span>
        </h4>
        <ul>
          <li><label><input type="checkbox" :checked="layers.buildings" @change="() => toggleLayer('buildings')"> 建筑模型</label></li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMapState } from '../../composables/useMapState'

const { layers, toggleLayer } = useMapState()

const collapsedSections = ref({
  pipe: false,
  iot: false,
  building: false
})

type Section = keyof typeof collapsedSections.value

const toggleSection = (section: Section) => {
  collapsedSections.value[section] = !collapsedSections.value[section]
}
</script>

<style scoped>
.left-sidebar {
  position: fixed;
  top: 80px;
  left: 20px;
  width: 280px;
  height: auto;
  background: rgba(10, 22, 41, 0.85);
  border: 1px solid rgba(0, 191, 255, 0.3);
  border-radius: 8px;
  color: white;
  z-index: 1000;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.corner {
  position: absolute;
  width: 15px;
  height: 15px;
  border-color: #00bfff;
  border-style: solid;
}
.top-left {
  top: -2px;
  left: -2px;
  border-width: 2px 0 0 2px;
}
.top-right {
  top: -2px;
  right: -2px;
  border-width: 2px 2px 0 0;
}
.bottom-left {
  bottom: -2px;
  left: -2px;
  border-width: 0 0 2px 2px;
}
.bottom-right {
  bottom: -2px;
  right: -2px;
  border-width: 0 2px 2px 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 191, 255, 0.3);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
}

.sidebar-header h3 svg {
  margin-right: 10px;
}

.close-button {
  background: none;
  border: none;
  color: #aaa;
  font-size: 24px;
  cursor: pointer;
}

.sidebar-content {
  padding: 8px;
}

.layer-section h4 {
  display: flex;
  align-items: center;
  padding: 10px 8px;
  margin: 0;
  cursor: pointer;
  background: rgba(0, 191, 255, 0.1);
  border-radius: 4px;
  transition: background 0.3s;
}

.layer-section h4:hover {
  background: rgba(0, 191, 255, 0.2);
}

.layer-section h4 svg {
  margin-right: 10px;
}

.toggle-arrow {
  margin-left: auto;
  border: solid white;
  border-width: 0 2px 2px 0;
  display: inline-block;
  padding: 3px;
  transform: rotate(45deg);
  transition: transform 0.3s;
}

.layer-section.collapsed .toggle-arrow {
  transform: rotate(-135deg);
}

.layer-section ul {
  list-style: none;
  padding: 0 0 0 20px;
  margin: 10px 0;
  max-height: 500px;
  overflow: hidden;
  transition: max-height 0.5s ease-in-out, margin 0.5s ease-in-out;
}

.layer-section.collapsed ul {
  max-height: 0;
  margin: 0;
}

.layer-section li {
  padding: 8px 0;
}

.layer-section label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.color-indicator {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  margin-right: 10px;
  flex-shrink: 0;
}

.layer-section input[type="checkbox"] {
  margin-right: 10px;
}
</style>