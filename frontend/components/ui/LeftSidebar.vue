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
        <template v-else-if="activeNavItem === '管网编辑器'">
          <!-- 管道类型选择 -->
          <section class="layer-section">
            <h4><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg><span>管道类型</span></h4>
            <div class="pipe-type-selector">
              <button 
                v-for="type in pipeTypes" 
                :key="type.id"
                :class="['pipe-type-btn', { active: selectedPipeType === type.id }]"
                @click="selectedPipeType = type.id"
              >
                <span class="type-indicator" :style="{ background: type.color }"></span>
                <span>{{ type.name }}</span>
              </button>
            </div>
          </section>

          <!-- 编辑工具 -->
          <section class="info-section">
            <p class="panel-desc">{{ currentPipeType.name }}编辑工具</p>
            <div class="editor-tools">
              <button class="tool-btn primary" @click="startDrawPipe">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                <span>在地图上绘制</span>
              </button>
              <button class="tool-btn" @click="showAddPipeForm = true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>手动添加</span>
              </button>
              <button class="tool-btn" :class="{ active: activeTool === 'node' }" @click="activeTool = activeTool === 'node' ? null : 'node'">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <span>添加节点</span>
              </button>
              <button class="tool-btn" :class="{ active: activeTool === 'edit' }" @click="activeTool = activeTool === 'edit' ? null : 'edit'">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span>编辑属性</span>
              </button>
              <button class="tool-btn danger" @click="deleteSelected">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>删除选中</span>
              </button>
            </div>
            
            <!-- 绘制模式提示 -->
            <div v-if="activeTool === 'pipe'" class="drawing-hint">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>左键点击添加点，右键完成绘制</span>
            </div>
            <div v-if="activeTool === 'node'" class="drawing-hint">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>左键点击添加节点，右键取消</span>
            </div>
            <div v-if="activeTool === 'edit'" class="drawing-hint">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>点击地图上的管道进行编辑</span>
            </div>
          </section>

          <!-- 添加管道表单 -->
          <section class="info-section" v-if="showAddPipeForm">
            <h4 class="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>添加{{ currentPipeType.name }}</span>
            </h4>
            <div class="property-form">
              <div class="form-group">
                <label>管道名称 *</label>
                <input type="text" v-model="newPipe.name" class="form-input" placeholder="例如：主供水管-3">
              </div>
              <div class="form-group">
                <label>管径 (mm) *</label>
                <input type="number" v-model="newPipe.diameter" class="form-input" placeholder="例如：300">
              </div>
              <div class="form-group">
                <label>材质 *</label>
                <select v-model="newPipe.material" class="form-input">
                  <option value="">请选择材质</option>
                  <option value="PVC">PVC</option>
                  <option value="PE">PE</option>
                  <option value="钢管">钢管</option>
                  <option value="铸铁">铸铁</option>
                  <option value="混凝土">混凝土</option>
                </select>
              </div>
              <div class="form-group">
                <label>长度 (m) *</label>
                <input type="number" v-model="newPipe.length" class="form-input" placeholder="例如：150">
              </div>
              <div class="form-group">
                <label>埋深 (m) *</label>
                <input type="number" v-model="newPipe.depth" step="0.1" class="form-input" placeholder="例如：1.5">
              </div>
              <div class="form-group" v-if="selectedPipeType === 'water'">
                <label>设计压力 (MPa)</label>
                <input type="number" v-model="newPipe.pressure" step="0.01" class="form-input" placeholder="例如：0.45">
              </div>
              <div class="form-group" v-if="selectedPipeType === 'sewage' || selectedPipeType === 'drainage'">
                <label>坡度 (‰)</label>
                <input type="number" v-model="newPipe.slope" step="0.1" class="form-input" placeholder="例如：2.5">
              </div>
              <div class="form-group">
                <label>安装日期</label>
                <input type="date" v-model="newPipe.installDate" class="form-input">
              </div>
              <div class="form-actions">
                <button class="btn-save" @click="addNewPipe" :disabled="!isNewPipeValid">添加</button>
                <button class="btn-cancel" @click="cancelAddPipe">取消</button>
              </div>
            </div>
          </section>

          <!-- 管道属性编辑 -->
          <section class="info-section" v-if="selectedPipe">
            <h4 class="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path></svg>
              <span>管道属性</span>
            </h4>
            <div class="property-form">
              <div class="form-group">
                <label>管道编号</label>
                <input type="text" v-model="selectedPipe.id" readonly class="form-input disabled">
              </div>
              <div class="form-group">
                <label>管道名称</label>
                <input type="text" v-model="selectedPipe.name" class="form-input">
              </div>
              <div class="form-group">
                <label>管径 (mm)</label>
                <input type="number" v-model="selectedPipe.diameter" class="form-input">
              </div>
              <div class="form-group">
                <label>材质</label>
                <select v-model="selectedPipe.material" class="form-input">
                  <option value="PVC">PVC</option>
                  <option value="PE">PE</option>
                  <option value="钢管">钢管</option>
                  <option value="铸铁">铸铁</option>
                  <option value="混凝土">混凝土</option>
                </select>
              </div>
              <div class="form-group">
                <label>长度 (m)</label>
                <input type="number" v-model="selectedPipe.length" class="form-input">
              </div>
              <div class="form-group">
                <label>埋深 (m)</label>
                <input type="number" v-model="selectedPipe.depth" step="0.1" class="form-input">
              </div>
              <div class="form-group" v-if="selectedPipeType === 'water'">
                <label>设计压力 (MPa)</label>
                <input type="number" v-model="selectedPipe.pressure" step="0.01" class="form-input">
              </div>
              <div class="form-group" v-if="selectedPipeType === 'sewage' || selectedPipeType === 'drainage'">
                <label>坡度 (‰)</label>
                <input type="number" v-model="selectedPipe.slope" step="0.1" class="form-input">
              </div>
              <div class="form-group">
                <label>安装日期</label>
                <input type="date" v-model="selectedPipe.installDate" class="form-input">
              </div>
              <div class="form-group">
                <label>状态</label>
                <select v-model="selectedPipe.status" class="form-input">
                  <option value="正常">正常</option>
                  <option value="维修中">维修中</option>
                  <option value="待检修">待检修</option>
                  <option value="报废">报废</option>
                </select>
              </div>
              <div class="form-actions">
                <button class="btn-save" @click="savePipeProperties">保存</button>
                <button class="btn-cancel" @click="selectedPipe = null">取消</button>
              </div>
            </div>
          </section>

          <!-- 管道列表 -->
          <section class="info-section">
            <h4 class="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>
              <span>{{ currentPipeType.name }}列表</span>
            </h4>
            <div class="pipe-list">
              <div 
                v-for="pipe in filteredPipes" 
                :key="pipe.id"
                :class="['pipe-item', { active: selectedPipe?.id === pipe.id }]"
                @click="selectPipe(pipe)"
              >
                <div class="pipe-info">
                  <span class="pipe-name">{{ pipe.name }}</span>
                  <span class="pipe-spec">Ø{{ pipe.diameter }}mm · {{ pipe.length }}m</span>
                </div>
                <span :class="['pipe-status', pipe.status]">{{ pipe.status }}</span>
              </div>
              <div v-if="filteredPipes.length === 0" class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p>暂无{{ currentPipeType.name }}</p>
              </div>
            </div>
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
import { ref, computed, h, onMounted, watch } from 'vue'
import { useMapState } from '../../composables/useMapState'
import { usePipeDrawing } from '../../composables/usePipeDrawing'
import type { PipeData } from '../../utils/cesium/pipes'

const { 
  layers, 
  toggleLayer, 
  showLeftSidebar, 
  toggleLeftSidebar, 
  activeNavItem, 
  realtimePressure,
  pipes,
  addPipe,
  updatePipeData,
  deletePipe,
  getPipesByType
} = useMapState()

const {
  drawingMode,
  setDrawingMode,
  setOnPipeDrawComplete
} = usePipeDrawing()

const collapsedSections = ref({ pipe: false })
type Section = keyof typeof collapsedSections.value
const toggleSection = (section: Section) => { collapsedSections.value[section] = !collapsedSections.value[section] }

const panelConfig = {
  '管网类型': { title: '管网类型', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' })]) },
  '管网编辑器': { title: '管网编辑器', icon: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }), h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })]) },
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

// ==================== 管道编辑器状态 ====================

// 管道类型定义
const pipeTypes = [
  { id: 'water', name: '供水管道', color: '#00ff7f' },
  { id: 'sewage', name: '污水管道', color: '#8b4513' },
  { id: 'drainage', name: '排水管道', color: '#4169e1' }
]

// 当前选中的管道类型
const selectedPipeType = ref('water')

// 当前激活的工具
const activeTool = ref<'node' | 'pipe' | 'edit' | null>(null)

// 监听工具切换，同步到绘制模式
watch(activeTool, (tool) => {
  if (tool) {
    setDrawingMode(tool)
  } else {
    setDrawingMode('none')
  }
})

// 当前选中的管道
const selectedPipe = ref<any>(null)

// 是否显示添加管道表单
const showAddPipeForm = ref(false)

// 绘制完成的管道数据
const drawnPipeData = ref<{ coordinates: number[][], length: number } | null>(null)

// 新管道数据
const newPipe = ref({
  name: '',
  diameter: null as number | null,
  material: '',
  length: null as number | null,
  depth: null as number | null,
  pressure: null as number | null,
  slope: null as number | null,
  installDate: new Date().toISOString().split('T')[0],
  status: '正常'
})

// 计算当前管道类型信息
const currentPipeType = computed(() => {
  return pipeTypes.find(t => t.id === selectedPipeType.value) || pipeTypes[0]
})

// 过滤当前类型的管道
const filteredPipes = computed(() => {
  return getPipesByType(selectedPipeType.value)
})

// 选择管道
const selectPipe = (pipe: any) => {
  selectedPipe.value = { ...pipe }
  activeTool.value = 'edit'
}

// 保存管道属性
const savePipeProperties = () => {
  if (!selectedPipe.value) return
  
  updatePipeData(selectedPipe.value.id, selectedPipe.value)
  selectedPipe.value = null
  alert('管道属性已保存')
}

// 删除选中的管道
const deleteSelected = () => {
  if (selectedPipe.value) {
    const confirmed = confirm(`确定要删除管道 "${selectedPipe.value.name}" 吗？`)
    if (confirmed) {
      deletePipe(selectedPipe.value.id)
      selectedPipe.value = null
    }
  } else {
    alert('请先选择要删除的管道')
  }
}

// 生成管道ID
const generatePipeId = () => {
  const prefix = selectedPipeType.value === 'water' ? 'W' : 
                 selectedPipeType.value === 'sewage' ? 'S' : 'D'
  const existingIds = getPipesByType(selectedPipeType.value)
    .map(p => parseInt(p.id.substring(1)))
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0
  return `${prefix}${String(maxId + 1).padStart(3, '0')}`
}

// 验证新管道数据
const isNewPipeValid = computed(() => {
  return newPipe.value.name && 
         newPipe.value.diameter && 
         newPipe.value.material && 
         newPipe.value.length && 
         newPipe.value.depth
})

// 添加新管道
const addNewPipe = () => {
  if (!isNewPipeValid.value) {
    alert('请填写所有必填项（标记*的字段）')
    return
  }

  const newPipeData: PipeData = {
    id: generatePipeId(),
    type: selectedPipeType.value,
    name: newPipe.value.name,
    diameter: newPipe.value.diameter!,
    material: newPipe.value.material,
    length: newPipe.value.length!,
    depth: newPipe.value.depth!,
    installDate: newPipe.value.installDate,
    status: newPipe.value.status
  }

  // 如果有绘制的坐标，使用绘制的坐标
  if (drawnPipeData.value) {
    newPipeData.coordinates = drawnPipeData.value.coordinates
    // 使用绘制的实际长度
    newPipeData.length = drawnPipeData.value.length
  }

  // 根据管道类型添加特定属性
  if (selectedPipeType.value === 'water' && newPipe.value.pressure) {
    newPipeData.pressure = newPipe.value.pressure
  } else if ((selectedPipeType.value === 'sewage' || selectedPipeType.value === 'drainage') && newPipe.value.slope) {
    newPipeData.slope = newPipe.value.slope
  }

  addPipe(newPipeData)
  
  // 重置表单
  cancelAddPipe()
  
  // 提示成功
  alert(`成功添加${currentPipeType.value.name}：${newPipeData.name}`)
}

// 取消添加管道
const cancelAddPipe = () => {
  showAddPipeForm.value = false
  drawnPipeData.value = null
  newPipe.value = {
    name: '',
    diameter: null,
    material: '',
    length: null,
    depth: null,
    pressure: null,
    slope: null,
    installDate: new Date().toISOString().split('T')[0],
    status: '正常'
  }
  // 取消绘制模式
  activeTool.value = null
}

// 开始绘制管道
const startDrawPipe = () => {
  activeTool.value = 'pipe'
  alert('请在地图上点击绘制管道路径\n左键点击添加点，右键完成绘制')
}

// 设置绘制完成回调
onMounted(() => {
  setOnPipeDrawComplete((data) => {
    drawnPipeData.value = data
    // 自动填充长度
    newPipe.value.length = data.length
    // 显示添加表单
    showAddPipeForm.value = true
    // 取消绘制模式
    activeTool.value = null
    alert(`管道绘制完成！\n长度：${data.length}米\n请填写管道信息`)
  })
})
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

/* 管网编辑器工具样式 */
.editor-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}
.tool-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(0, 191, 255, 0.1);
  border: 1px solid rgba(0, 191, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}
.tool-btn:hover {
  background: rgba(0, 191, 255, 0.2);
  border-color: rgba(0, 191, 255, 0.5);
}
.tool-btn.active {
  background: rgba(0, 191, 255, 0.3);
  border-color: #00bfff;
  box-shadow: 0 0 10px rgba(0, 191, 255, 0.3);
}
.tool-btn.primary {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
}
.tool-btn.primary:hover {
  background: rgba(0, 191, 255, 0.3);
  box-shadow: 0 0 10px rgba(0, 191, 255, 0.4);
}
.tool-btn.danger {
  border-color: rgba(220, 53, 69, 0.3);
}
.tool-btn.danger:hover {
  background: rgba(220, 53, 69, 0.2);
  border-color: rgba(220, 53, 69, 0.5);
}

/* 管道类型选择器 */
.pipe-type-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}
.pipe-type-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}
.pipe-type-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}
.pipe-type-btn.active {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
  box-shadow: 0 0 10px rgba(0, 191, 255, 0.2);
}
.type-indicator {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* 管道属性表单 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: bold;
  color: #00bfff;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(0, 191, 255, 0.1);
  border-radius: 4px;
}
.property-form {
  padding: 8px;
}
.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 191, 255, 0.3);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: #00bfff;
  box-shadow: 0 0 8px rgba(0, 191, 255, 0.3);
}
.form-input.disabled {
  background: rgba(0, 0, 0, 0.5);
  color: #666;
  cursor: not-allowed;
}
.form-input option {
  background: #0a1629;
  color: #fff;
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.btn-save, .btn-cancel {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-save {
  background: #00bfff;
  color: #fff;
}
.btn-save:hover {
  background: #0099cc;
  box-shadow: 0 0 10px rgba(0, 191, 255, 0.5);
}
.btn-save:disabled {
  background: rgba(0, 191, 255, 0.3);
  cursor: not-allowed;
  opacity: 0.5;
}
.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* 管道列表 */
.pipe-list {
  max-height: 300px;
  overflow-y: auto;
}
.pipe-list::-webkit-scrollbar {
  width: 4px;
}
.pipe-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}
.pipe-list::-webkit-scrollbar-thumb {
  background: rgba(0, 191, 255, 0.4);
  border-radius: 2px;
}
.pipe-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.pipe-item:hover {
  background: rgba(0, 191, 255, 0.1);
  border-color: rgba(0, 191, 255, 0.3);
}
.pipe-item.active {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
  box-shadow: 0 0 8px rgba(0, 191, 255, 0.3);
}
.pipe-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pipe-name {
  font-size: 13px;
  font-weight: bold;
  color: #fff;
}
.pipe-spec {
  font-size: 11px;
  color: #888;
}
.pipe-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
}
.pipe-status.正常 {
  background: rgba(0, 255, 127, 0.2);
  color: #00ff7f;
}
.pipe-status.维修中 {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}
.pipe-status.待检修 {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}
.pipe-status.报废 {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}
.empty-state svg {
  margin-bottom: 12px;
  opacity: 0.5;
}
.empty-state p {
  margin: 0;
  font-size: 13px;
}

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
