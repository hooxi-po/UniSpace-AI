<template>
  <Teleport to="body">
    <div 
      v-if="showBuildingPopup && buildingInfo.length > 0"
      class="info-popup" 
      :style="popupStyle"
    >
      <div class="popup-header">
        <span>建筑信息</span>
        <button class="close-btn" @click="closeBuildingPopup">×</button>
      </div>
      <ul>
        <li v-for="(item, index) in buildingInfo" :key="index">
          <strong>{{ item.label }}:</strong>
          <span :class="getValueClass(item)">{{ item.value }}</span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMapState } from '../../composables/useMapState'

const { 
  showBuildingPopup, 
  buildingInfo, 
  popupPosition, 
  closeBuildingPopup 
} = useMapState()

// 计算弹窗位置，确保不超出屏幕
const popupStyle = computed(() => {
  const x = popupPosition.value.x
  const y = popupPosition.value.y
  
  // 弹窗宽度约 260px，高度约 200px
  const popupWidth = 260
  const popupHeight = 200
  const padding = 20
  
  // 获取窗口尺寸
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
  
  // 计算最终位置，避免超出屏幕
  let finalX = x + 15 // 偏移一点避免遮挡点击位置
  let finalY = y + 15
  
  // 右边界检测
  if (finalX + popupWidth > windowWidth - padding) {
    finalX = x - popupWidth - 15
  }
  
  // 下边界检测
  if (finalY + popupHeight > windowHeight - padding) {
    finalY = y - popupHeight - 15
  }
  
  // 确保不小于 0
  finalX = Math.max(padding, finalX)
  finalY = Math.max(padding, finalY)
  
  return {
    left: `${finalX}px`,
    top: `${finalY}px`
  }
})

// 根据内容返回样式类
const getValueClass = (item: { label: string; value: string }) => {
  if (item.label === '状态' && item.value.includes('异常')) {
    return 'status-abnormal'
  }
  return ''
}
</script>

<style scoped>
.info-popup {
  position: fixed;
  background: rgba(10, 22, 41, 0.95);
  border: 1px solid rgba(0, 191, 255, 0.5);
  border-radius: 8px;
  color: white;
  z-index: 2000;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  font-size: 14px;
  min-width: 240px;
  max-width: 320px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(0, 191, 255, 0.3);
  font-weight: bold;
  color: #00bfff;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.info-popup ul {
  list-style: none;
  padding: 12px 14px;
  margin: 0;
}

.info-popup li {
  padding: 6px 0;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-popup li:last-child {
  border-bottom: none;
}

.info-popup strong {
  color: #8899aa;
  margin-right: 10px;
  flex-shrink: 0;
}

.info-popup span {
  text-align: right;
  word-break: break-word;
}

.status-abnormal {
  color: #ffc107;
  font-weight: bold;
}
</style>
