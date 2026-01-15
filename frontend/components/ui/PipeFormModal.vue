<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showPipeForm" class="modal-overlay" @click.self="handleCancel">
        <div class="modal-container">
          <div class="modal-header">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              添加{{ currentPipeType.name }}
            </h3>
            <button class="close-btn" @click="handleCancel">×</button>
          </div>
          
          <div class="modal-body">
            <!-- 绘制信息摘要 -->
            <div class="draw-summary">
              <div class="summary-item">
                <span class="label">节点数</span>
                <span class="value">{{ drawnPipeData?.nodes.length || 0 }}</span>
              </div>
              <div class="summary-item">
                <span class="label">管段数</span>
                <span class="value">{{ drawnPipeData?.segments.length || 0 }}</span>
              </div>
              <div class="summary-item">
                <span class="label">总长度</span>
                <span class="value highlight">{{ drawnPipeData?.totalLength || 0 }} m</span>
              </div>
            </div>

            <!-- 管道类型选择 -->
            <div class="form-section">
              <label class="section-label">管道类型</label>
              <div class="pipe-type-grid">
                <button 
                  v-for="type in pipeTypes" 
                  :key="type.id"
                  :class="['type-btn', { active: selectedPipeType === type.id }]"
                  @click="selectedPipeType = type.id"
                >
                  <span class="type-dot" :style="{ background: type.color }"></span>
                  {{ type.name }}
                </button>
              </div>
            </div>

            <!-- 基本信息 -->
            <div class="form-section">
              <label class="section-label">基本信息</label>
              <div class="form-grid">
                <div class="form-group">
                  <label>管道名称 <span class="required">*</span></label>
                  <input type="text" v-model="formData.name" placeholder="例如：主供水管-3">
                </div>
                <div class="form-group">
                  <label>管径 (mm) <span class="required">*</span></label>
                  <input type="number" v-model="formData.diameter" placeholder="300">
                </div>
                <div class="form-group">
                  <label>材质 <span class="required">*</span></label>
                  <select v-model="formData.material">
                    <option value="">请选择</option>
                    <option value="PVC">PVC</option>
                    <option value="PE">PE</option>
                    <option value="钢管">钢管</option>
                    <option value="铸铁">铸铁</option>
                    <option value="混凝土">混凝土</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>埋深 (m) <span class="required">*</span></label>
                  <input type="number" v-model="formData.depth" step="0.1" placeholder="1.5">
                </div>
              </div>
            </div>

            <!-- 特定属性 -->
            <div class="form-section">
              <label class="section-label">{{ selectedPipeType === 'water' ? '压力参数' : '坡度参数' }}</label>
              <div class="form-grid">
                <div class="form-group" v-if="selectedPipeType === 'water'">
                  <label>设计压力 (MPa)</label>
                  <input type="number" v-model="formData.pressure" step="0.01" placeholder="0.45">
                </div>
                <div class="form-group" v-else>
                  <label>坡度 (‰)</label>
                  <input type="number" v-model="formData.slope" step="0.1" placeholder="2.5">
                </div>
                <div class="form-group">
                  <label>安装日期</label>
                  <input type="date" v-model="formData.installDate">
                </div>
              </div>
            </div>

            <!-- 显示粗细调整 -->
            <div class="form-section">
              <label class="section-label">显示设置</label>
              <div class="width-control">
                <label>管道显示粗细</label>
                <div class="slider-container">
                  <input 
                    type="range" 
                    v-model.number="displayWidth" 
                    min="2" 
                    max="20" 
                    step="1"
                    @input="updateDisplayWidth"
                  >
                  <span class="width-value">{{ displayWidth }}px</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="handleCancel">取消</button>
            <button class="btn-confirm" :disabled="!isFormValid" @click="handleConfirm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              确认添加
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import * as Cesium from 'cesium'
import { usePipeDrawing } from '../../composables/usePipeDrawing'
import { useMapState } from '../../composables/useMapState'
import type { PipeData } from '../../utils/cesium/pipes'

const { 
  showPipeForm, 
  drawnPipeData, 
  closePipeForm, 
  confirmPipeForm,
  setAllSegmentsWidth 
} = usePipeDrawing()

const { addPipe, getPipesByType } = useMapState()

// 管道类型
const pipeTypes = [
  { id: 'water', name: '供水管道', color: '#00ff7f' },
  { id: 'sewage', name: '污水管道', color: '#8b4513' },
  { id: 'drainage', name: '排水管道', color: '#4169e1' }
]

const selectedPipeType = ref('water')
const displayWidth = ref(5)

const currentPipeType = computed(() => {
  return pipeTypes.find(t => t.id === selectedPipeType.value) || pipeTypes[0]
})

// 表单数据
const formData = ref({
  name: '',
  diameter: null as number | null,
  material: '',
  depth: null as number | null,
  pressure: null as number | null,
  slope: null as number | null,
  installDate: new Date().toISOString().split('T')[0]
})

// 表单验证
const isFormValid = computed(() => {
  return formData.value.name && 
         formData.value.diameter && 
         formData.value.material && 
         formData.value.depth
})

// 更新显示粗细
const updateDisplayWidth = () => {
  setAllSegmentsWidth(displayWidth.value)
}

// 生成管道ID
const generatePipeId = () => {
  const prefix = selectedPipeType.value === 'water' ? 'W' : 
                 selectedPipeType.value === 'sewage' ? 'S' : 'D'
  const existingPipes = getPipesByType(selectedPipeType.value)
  const existingIds = existingPipes.map(p => parseInt(p.id.substring(1)))
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0
  return `${prefix}${String(maxId + 1).padStart(3, '0')}`
}

// 取消
const handleCancel = () => {
  resetForm()
  closePipeForm()
}

// 确认
const handleConfirm = () => {
  if (!isFormValid.value || !drawnPipeData.value) return

  // 收集所有坐标点（包括曲线采样点）
  const allCoordinates: number[][] = []
  
  for (const segment of drawnPipeData.value.segments) {
    // 添加起点
    if (allCoordinates.length === 0) {
      allCoordinates.push(segment.startNode.coordinates)
    }
    
    // 如果有控制点，添加控制点坐标
    for (const ctrlPoint of segment.controlPoints) {
      const cartographic = Cesium.Cartographic.fromCartesian(ctrlPoint)
      const lon = Cesium.Math.toDegrees(cartographic.longitude)
      const lat = Cesium.Math.toDegrees(cartographic.latitude)
      allCoordinates.push([lon, lat])
    }
    
    // 添加终点
    allCoordinates.push(segment.endNode.coordinates)
  }

  // 构建管道数据
  const pipeData: PipeData = {
    id: generatePipeId(),
    type: selectedPipeType.value as 'water' | 'sewage' | 'drainage',
    name: formData.value.name,
    diameter: formData.value.diameter!,
    material: formData.value.material,
    length: drawnPipeData.value.totalLength,
    depth: formData.value.depth!,
    installDate: formData.value.installDate,
    status: '正常',
    coordinates: allCoordinates
  }

  // 添加特定属性
  if (selectedPipeType.value === 'water' && formData.value.pressure) {
    pipeData.pressure = formData.value.pressure
  } else if (formData.value.slope) {
    pipeData.slope = formData.value.slope
  }

  // 添加管道
  addPipe(pipeData)
  
  // 重置并关闭
  resetForm()
  confirmPipeForm()
}

// 重置表单
const resetForm = () => {
  formData.value = {
    name: '',
    diameter: null,
    material: '',
    depth: null,
    pressure: null,
    slope: null,
    installDate: new Date().toISOString().split('T')[0]
  }
  selectedPipeType.value = 'water'
  displayWidth.value = 5
}

// 监听表单打开，重置数据
watch(showPipeForm, (show) => {
  if (show) {
    resetForm()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: rgba(10, 22, 41, 0.98);
  border: 1px solid rgba(0, 191, 255, 0.4);
  border-radius: 12px;
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 191, 255, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 191, 255, 0.2);
}

.modal-header h3 {
  margin: 0;
  color: #00bfff;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* 绘制摘要 */
.draw-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.summary-item {
  flex: 1;
  background: rgba(0, 191, 255, 0.1);
  border: 1px solid rgba(0, 191, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.summary-item .label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.summary-item .value {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.summary-item .value.highlight {
  color: #00bfff;
}

/* 表单区块 */
.form-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 13px;
  color: #00bfff;
  margin-bottom: 10px;
  font-weight: bold;
}

/* 管道类型选择 */
.pipe-type-grid {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.type-btn.active {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
}

.type-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

/* 表单网格 */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  color: #aaa;
}

.form-group .required {
  color: #ff6b6b;
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 191, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #00bfff;
  box-shadow: 0 0 8px rgba(0, 191, 255, 0.3);
}

.form-group select option {
  background: #0a1629;
}

/* 粗细控制 */
.width-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.width-control > label {
  font-size: 12px;
  color: #aaa;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-container input[type="range"] {
  flex: 1;
  height: 6px;
  background: rgba(0, 191, 255, 0.2);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.slider-container input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #00bfff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(0, 191, 255, 0.5);
}

.width-value {
  min-width: 45px;
  text-align: right;
  color: #00bfff;
  font-weight: bold;
  font-size: 14px;
}

/* 底部按钮 */
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(0, 191, 255, 0.2);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-confirm {
  background: linear-gradient(135deg, #00bfff, #0099cc);
  color: #fff;
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #00d4ff, #00b3e6);
  box-shadow: 0 0 15px rgba(0, 191, 255, 0.5);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9) translateY(-20px);
}

/* 滚动条 */
.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(0, 191, 255, 0.4);
  border-radius: 3px;
}
</style>
