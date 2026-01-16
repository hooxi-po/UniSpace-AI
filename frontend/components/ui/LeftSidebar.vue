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
            <h4 @click="toggleSection('pipe')">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
              <span>管网分类</span>
              <span class="toggle-arrow"></span>
            </h4>
            <ul>
              <li><label><span class="color-indicator" style="background-color: #00bfff;"></span><input type="checkbox" :checked="layers.pipes" @change="toggleLayer('pipes')"> 水量管网</label></li>
              <li><label><span class="color-indicator" style="background-color: #00ff7f;"></span><input type="checkbox" :checked="layers.waterSupply" @change="toggleLayer('waterSupply')"> 供水管网</label></li>
              <li><label><span class="color-indicator" style="background-color: #ffc107;"></span><input type="checkbox" :checked="layers.pressure" @change="toggleLayer('pressure')"> 压力管网</label></li>
              <li><label><span class="color-indicator" style="background-color: #dc3545;"></span><input type="checkbox" :checked="layers.power" @change="toggleLayer('power')"> 电力管网</label></li>
            </ul>
          </section>
        </template>

        <template v-else-if="activeNavItem === '管网编辑器'">
          <template v-if="showInlineEditor">
            <section class="inline-editor">
              <div class="editor-header">
                <h4>{{ isEditMode ? '编辑管道' : '添加管道' }}</h4>
                <button class="back-btn" @click="closeInlineEditor">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  返回
                </button>
              </div>
              <div class="editor-form">
                <div class="form-group">
                  <label>管道名称 <span class="required">*</span></label>
                  <input v-model="pipeForm.name" type="text" placeholder="请输入管道名称" />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>管道类型 <span class="required">*</span></label>
                    <select v-model="pipeForm.type">
                      <option value="water">供水管道</option>
                      <option value="sewage">污水管道</option>
                      <option value="drainage">排水管道</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>状态</label>
                    <select v-model="pipeForm.status">
                      <option value="正常">正常</option>
                      <option value="维修中">维修中</option>
                      <option value="待检修">待检修</option>
                      <option value="报废">报废</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>管径 (mm) <span class="required">*</span></label>
                    <input v-model.number="pipeForm.diameter" type="number" placeholder="200" min="50" max="2000" />
                  </div>
                  <div class="form-group">
                    <label>长度 (m) <span class="required">*</span></label>
                    <input v-model.number="pipeForm.length" type="number" placeholder="150" min="1" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>埋深 (m)</label>
                    <input v-model.number="pipeForm.depth" type="number" placeholder="1.5" step="0.1" min="0" />
                  </div>
                  <div class="form-group">
                    <label>材质</label>
                    <select v-model="pipeForm.material">
                      <option value="PE">PE管</option>
                      <option value="PVC">PVC管</option>
                      <option value="球墨铸铁">球墨铸铁</option>
                      <option value="钢管">钢管</option>
                      <option value="混凝土">混凝土管</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>压力 (MPa)</label>
                    <input v-model.number="pipeForm.pressure" type="number" placeholder="0.6" step="0.01" min="0" />
                  </div>
                  <div class="form-group">
                    <label>坡度 (%)</label>
                    <input v-model.number="pipeForm.slope" type="number" placeholder="0.3" step="0.01" />
                  </div>
                </div>
                <div class="form-group">
                  <label>安装日期</label>
                  <input v-model="pipeForm.installDate" type="date" />
                </div>
                <div class="form-group">
                  <label>管道路径</label>
                  <div class="coord-section">
                    <button class="draw-btn" :class="{ active: isDrawingMode }" @click="toggleDrawingMode">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg>
                      {{ isDrawingMode ? '停止绘制' : '在地图上绘制' }}
                    </button>
                    <div v-if="isDrawingMode" class="draw-hint">点击地图添加节点，双击完成</div>
                    <div v-if="pipeForm.coordinates && pipeForm.coordinates.length > 0" class="coord-info">
                      <span class="coord-count">已绘制 {{ pipeForm.coordinates.length }} 个节点</span>
                      <button class="clear-coord-btn" @click="clearCoordinates">清除</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="editor-footer">
                <button class="btn-cancel" @click="closeInlineEditor">取消</button>
                <button class="btn-submit" @click="submitPipeForm" :disabled="!isFormValid">{{ isEditMode ? '保存' : '添加' }}</button>
              </div>
            </section>
          </template>
          <template v-else>
            <section class="editor-actions">
              <button class="action-btn primary" @click="openAddForm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                添加管道
              </button>
            </section>
            <section class="info-section">
              <h4 class="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>
                <span>管道列表 ({{ allPipes.length }})</span>
              </h4>
              <div class="pipe-list">
                <div v-for="pipe in allPipes" :key="pipe.id" class="pipe-item" @click="selectPipe(pipe)">
                  <div class="pipe-info">
                    <span class="pipe-name">{{ pipe.name }}</span>
                    <span class="pipe-spec">
                      <span :class="['pipe-type-badge', pipe.type]">{{ getPipeTypeName(pipe.type) }}</span>
                      Ø{{ pipe.diameter }}mm · {{ pipe.length }}m
                    </span>
                  </div>
                  <div class="pipe-actions">
                    <span :class="['pipe-status-tag', getStatusClass(pipe.status)]">{{ pipe.status }}</span>
                    <button class="icon-btn" @click.stop="editPipe(pipe)" title="编辑">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="icon-btn danger" @click.stop="confirmDeletePipe(pipe)" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
                <div v-if="allPipes.length === 0" class="empty-state">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  <p>暂无管道数据</p>
                  <p class="hint">点击"添加管道"创建</p>
                </div>
              </div>
            </section>
          </template>
        </template>

        <template v-else-if="activeNavItem === '建筑模型'">
          <section class="layer-section">
            <h4>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
              <span>显示控制</span>
            </h4>
            <ul>
              <li><label><input type="checkbox" :checked="layers.buildings" @change="toggleLayer('buildings')"> 3D建筑模型</label></li>
            </ul>
          </section>
        </template>

        <template v-else-if="activeNavItem === '关联模型'">
          <section class="info-section">
            <p class="panel-desc">管网与建筑的关联关系（开发中）</p>
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <p>功能开发中</p>
            </div>
          </section>
        </template>

        <template v-else-if="activeNavItem === '关联楼宇'">
          <section class="info-section">
            <p class="panel-desc">选择楼宇查看关联管网（开发中）</p>
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <p>功能开发中</p>
            </div>
          </section>
        </template>

        <template v-else-if="activeNavItem === '实时压力'">
          <section class="info-section">
            <div class="pressure-gauge">
              <div class="gauge-value" :class="realtimePressure.status">
                {{ realtimePressure.value.toFixed(2) }}
                <span class="unit">{{ realtimePressure.unit }}</span>
              </div>
              <div class="gauge-status">状态: {{ realtimePressure.status }}</div>
            </div>
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
  
  <Transition name="fade">
    <button v-if="!showLeftSidebar" class="expand-button left" @click="toggleLeftSidebar">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
    </button>
  </Transition>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-content confirm-modal">
          <div class="modal-header"><h3>确认删除</h3></div>
          <div class="modal-body">
            <p>确定要删除管道 <strong>{{ pipeToDelete?.name }}</strong> 吗？</p>
            <p class="warning-text">此操作不可撤销</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="cancelDelete">取消</button>
            <button class="btn-danger" @click="doDeletePipe">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useMapState } from '../../composables/useMapState'
import type { PipeData } from '../../utils/cesium/pipes'

const { layers, toggleLayer, showLeftSidebar, toggleLeftSidebar, activeNavItem, realtimePressure, pipes, addPipe, updatePipeData, deletePipe } = useMapState()

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

const isLoadingPressure = ref(true)
const pressurePoints = ref<Array<{ name: string; value: string; status: string }>>([])
const allPipes = computed(() => pipes.value)

const showInlineEditor = ref(false)
const isEditMode = ref(false)
const editingPipeId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const pipeToDelete = ref<PipeData | null>(null)
const isDrawingMode = ref(false)
const drawingPoints = ref<number[][]>([])

const defaultPipeForm = (): Partial<PipeData> => ({ name: '', type: 'water', diameter: 200, material: 'PE', length: 100, depth: 1.5, pressure: 0.4, slope: 0.3, installDate: new Date().toISOString().split('T')[0], status: '正常', coordinates: [] })
const pipeForm = ref<Partial<PipeData>>(defaultPipeForm())
const isFormValid = computed(() => pipeForm.value.name && pipeForm.value.type && pipeForm.value.diameter && pipeForm.value.diameter > 0 && pipeForm.value.length && pipeForm.value.length > 0)

const getPipeTypeName = (type: string) => ({ water: '供水', sewage: '污水', drainage: '排水' }[type] || type)
const getStatusClass = (status: string) => ({ '正常': 'normal', '维修中': 'repairing', '待检修': 'pending', '报废': 'disabled' }[status] || 'normal')

const openAddForm = () => { isEditMode.value = false; editingPipeId.value = null; pipeForm.value = defaultPipeForm(); showInlineEditor.value = true }
const editPipe = (pipe: PipeData) => { isEditMode.value = true; editingPipeId.value = pipe.id; pipeForm.value = { ...pipe }; showInlineEditor.value = true }
const closeInlineEditor = () => { showInlineEditor.value = false; pipeForm.value = defaultPipeForm(); editingPipeId.value = null; if (isDrawingMode.value) { isDrawingMode.value = false; window.dispatchEvent(new CustomEvent('stop-pipe-drawing')) }; drawingPoints.value = [] }

const submitPipeForm = () => {
  if (!isFormValid.value) return
  if (isEditMode.value && editingPipeId.value) { updatePipeData(editingPipeId.value, pipeForm.value) }
  else {
    const newPipe: PipeData = { id: `pipe_${Date.now()}`, name: pipeForm.value.name || '', type: pipeForm.value.type as 'water' | 'sewage' | 'drainage', diameter: pipeForm.value.diameter || 200, material: pipeForm.value.material || 'PE', length: pipeForm.value.length || 100, depth: pipeForm.value.depth || 1.5, pressure: pipeForm.value.pressure, slope: pipeForm.value.slope, installDate: pipeForm.value.installDate || new Date().toISOString().split('T')[0], status: pipeForm.value.status || '正常', coordinates: pipeForm.value.coordinates }
    addPipe(newPipe)
  }
  closeInlineEditor()
}

const confirmDeletePipe = (pipe: PipeData) => { pipeToDelete.value = pipe; showDeleteConfirm.value = true }
const cancelDelete = () => { showDeleteConfirm.value = false; pipeToDelete.value = null }
const doDeletePipe = () => { if (pipeToDelete.value) deletePipe(pipeToDelete.value.id); cancelDelete() }
const selectPipe = (pipe: PipeData) => { window.dispatchEvent(new CustomEvent('highlight-pipe', { detail: pipe.id })) }

const toggleDrawingMode = () => {
  isDrawingMode.value = !isDrawingMode.value
  if (isDrawingMode.value) { drawingPoints.value = []; pipeForm.value.coordinates = []; window.dispatchEvent(new CustomEvent('start-pipe-drawing')) }
  else { window.dispatchEvent(new CustomEvent('stop-pipe-drawing')) }
}
const clearCoordinates = () => { pipeForm.value.coordinates = []; drawingPoints.value = []; if (isDrawingMode.value) { window.dispatchEvent(new CustomEvent('stop-pipe-drawing')); isDrawingMode.value = false } }

const calculatePathLength = (coords: number[][]): number => {
  if (coords.length < 2) return 0
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1], [lon2, lat2] = coords[i]
    const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return Math.round(total)
}

onMounted(() => {
  window.addEventListener('pipe-point-added', ((e: CustomEvent) => { drawingPoints.value.push(e.detail); pipeForm.value.coordinates = [...drawingPoints.value]; if (drawingPoints.value.length >= 2) pipeForm.value.length = calculatePathLength(drawingPoints.value) }) as EventListener)
  window.addEventListener('pipe-drawing-complete', (() => { if (drawingPoints.value.length >= 2) { isDrawingMode.value = false; pipeForm.value.coordinates = [...drawingPoints.value]; pipeForm.value.length = calculatePathLength(drawingPoints.value) } }) as EventListener)
  setTimeout(() => { pressurePoints.value = [{ name: '主入口阀门', value: '0.52', status: '正常' }, { name: '图书馆分支', value: '0.45', status: '低' }, { name: '教学区主管', value: '0.48', status: '正常' }, { name: '宿舍区分支', value: '0.38', status: '低' }, { name: '食堂供水点', value: '0.55', status: '正常' }]; isLoadingPressure.value = false }, 1500)
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
.sidebar-content { padding: 12px; overflow-y: auto; flex: 1; }
.sidebar-content::-webkit-scrollbar { width: 6px; }
.sidebar-content::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 3px; }
.sidebar-content::-webkit-scrollbar-thumb { background: rgba(0, 191, 255, 0.4); border-radius: 3px; }
.layer-section h4 { display: flex; align-items: center; padding: 10px 8px; margin: 0; cursor: pointer; background: rgba(0, 191, 255, 0.1); border-radius: 4px; transition: background 0.3s; font-size: 14px; }
.layer-section h4:hover { background: rgba(0, 191, 255, 0.2); }
.layer-section h4 svg { margin-right: 10px; }
.toggle-arrow { margin-left: auto; border: solid white; border-width: 0 2px 2px 0; display: inline-block; padding: 3px; transform: rotate(45deg); transition: transform 0.3s; }
.layer-section.collapsed .toggle-arrow { transform: rotate(-45deg); }
.layer-section ul { list-style: none; padding: 0 0 0 16px; margin: 10px 0; max-height: 500px; overflow: hidden; transition: max-height 0.5s ease-in-out; }
.layer-section.collapsed ul { max-height: 0; margin: 0; }
.layer-section li { padding: 8px 0; }
.layer-section label { display: flex; align-items: center; cursor: pointer; font-size: 14px; }
.color-indicator { width: 14px; height: 14px; border-radius: 3px; margin-right: 10px; flex-shrink: 0; }
.layer-section input[type="checkbox"] { margin-right: 10px; cursor: pointer; }
.info-section { padding: 8px 0; }
.panel-desc { color: #aaa; font-size: 13px; margin: 0 0 12px; padding: 0 8px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: bold; color: #00bfff; margin-bottom: 12px; padding: 8px; background: rgba(0, 191, 255, 0.1); border-radius: 4px; }
.pipe-list { max-height: 300px; overflow-y: auto; }
.pipe-list::-webkit-scrollbar { width: 4px; }
.pipe-list::-webkit-scrollbar-thumb { background: rgba(0, 191, 255, 0.4); border-radius: 2px; }
.pipe-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s; }
.pipe-item:hover { background: rgba(0, 191, 255, 0.1); border-color: rgba(0, 191, 255, 0.3); }
.pipe-info { display: flex; flex-direction: column; gap: 4px; }
.pipe-name { font-size: 13px; font-weight: bold; color: #fff; }
.pipe-spec { font-size: 11px; color: #888; display: flex; align-items: center; gap: 4px; }
.pipe-actions { display: flex; align-items: center; gap: 4px; }
.pipe-type-badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
.pipe-type-badge.water { background: rgba(0, 255, 127, 0.2); color: #00ff7f; }
.pipe-type-badge.sewage { background: rgba(139, 69, 19, 0.3); color: #cd853f; }
.pipe-type-badge.drainage { background: rgba(65, 105, 225, 0.3); color: #6495ed; }
.pipe-status-tag { font-size: 10px; padding: 2px 6px; border-radius: 3px; }
.pipe-status-tag.normal { background: rgba(0, 255, 127, 0.15); color: #00ff7f; }
.pipe-status-tag.repairing { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
.pipe-status-tag.pending { background: rgba(255, 152, 0, 0.15); color: #ff9800; }
.pipe-status-tag.disabled { background: rgba(220, 53, 69, 0.15); color: #dc3545; }
.icon-btn { background: none; border: none; color: #666; padding: 4px; cursor: pointer; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
.icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.icon-btn.danger:hover { background: rgba(220, 53, 69, 0.2); color: #dc3545; }
.empty-state { text-align: center; padding: 40px 20px; color: #666; }
.empty-state svg { margin-bottom: 12px; opacity: 0.5; }
.empty-state p { margin: 0; font-size: 13px; }
.empty-state .hint { font-size: 11px; color: #555; margin-top: 8px; }
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
.skeleton-list { padding: 0 8px; }
.skeleton-item { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.skeleton-text { flex: 1; height: 14px; background: rgba(0, 191, 255, 0.15); border-radius: 4px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
.skeleton-text.long { max-width: 120px; }
.skeleton-value { width: 60px; height: 14px; background: rgba(0, 191, 255, 0.15); border-radius: 4px; margin-left: 10px; animation: skeleton-pulse 1.5s ease-in-out infinite; animation-delay: 0.2s; }
@keyframes skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.editor-actions { display: flex; gap: 8px; margin-bottom: 12px; }
.action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; background: rgba(0, 191, 255, 0.1); border: 1px solid rgba(0, 191, 255, 0.3); border-radius: 6px; color: #00bfff; font-size: 13px; cursor: pointer; transition: all 0.2s; }
.action-btn:hover { background: rgba(0, 191, 255, 0.2); }
.action-btn.primary { background: rgba(0, 191, 255, 0.2); }
.inline-editor { display: flex; flex-direction: column; height: 100%; }
.editor-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid rgba(0, 191, 255, 0.2); margin-bottom: 12px; }
.editor-header h4 { margin: 0; font-size: 15px; color: #00bfff; }
.back-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; color: #888; font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
.back-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.editor-form { flex: 1; overflow-y: auto; padding-right: 4px; }
.editor-form::-webkit-scrollbar { width: 4px; }
.editor-form::-webkit-scrollbar-thumb { background: rgba(0, 191, 255, 0.3); border-radius: 2px; }
.editor-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(0, 191, 255, 0.2); margin-top: 12px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; margin-bottom: 4px; font-size: 12px; color: #aaa; }
.form-group .required { color: #dc3545; }
.form-group input, .form-group select { width: 100%; padding: 8px 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.form-group input:focus, .form-group select:focus { border-color: #00bfff; }
.form-group input::placeholder { color: #666; }
.form-row { display: flex; gap: 10px; }
.form-row .form-group { flex: 1; }
.coord-section { display: flex; flex-direction: column; gap: 8px; }
.draw-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; background: rgba(0, 191, 255, 0.1); border: 1px dashed rgba(0, 191, 255, 0.4); border-radius: 6px; color: #00bfff; font-size: 12px; cursor: pointer; transition: all 0.2s; }
.draw-btn:hover { background: rgba(0, 191, 255, 0.2); border-style: solid; }
.draw-btn.active { background: rgba(0, 191, 255, 0.25); border-style: solid; border-color: #00bfff; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(0, 191, 255, 0.4); } 50% { box-shadow: 0 0 0 6px rgba(0, 191, 255, 0); } }
.draw-hint { font-size: 11px; color: #888; text-align: center; padding: 4px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
.coord-info { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(0, 191, 255, 0.1); border-radius: 4px; }
.coord-count { font-size: 12px; color: #00bfff; }
.clear-coord-btn { background: none; border: none; color: #dc3545; font-size: 11px; cursor: pointer; padding: 2px 6px; }
.clear-coord-btn:hover { text-decoration: underline; }
.btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; color: #aaa; cursor: pointer; transition: all 0.2s; font-size: 13px; }
.btn-cancel:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.btn-submit { padding: 8px 16px; background: #00bfff; border: none; border-radius: 4px; color: #0a1629; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 13px; }
.btn-submit:hover { background: #00d4ff; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger { padding: 8px 16px; background: #dc3545; border: none; border-radius: 4px; color: #fff; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 13px; }
.btn-danger:hover { background: #e04555; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); }
.modal-content { background: rgba(10, 22, 41, 0.98); border: 1px solid rgba(0, 191, 255, 0.4); border-radius: 12px; width: 90%; max-width: 360px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
.modal-header { padding: 16px 20px; border-bottom: 1px solid rgba(0, 191, 255, 0.2); }
.modal-header h3 { margin: 0; font-size: 16px; color: #00bfff; }
.modal-body { padding: 20px; }
.modal-body p { color: #ccc; margin: 0 0 12px; font-size: 14px; }
.warning-text { color: #ffc107 !important; font-size: 12px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid rgba(0, 191, 255, 0.2); }
.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-content, .modal-leave-to .modal-content { transform: scale(0.9) translateY(-20px); }
</style>
