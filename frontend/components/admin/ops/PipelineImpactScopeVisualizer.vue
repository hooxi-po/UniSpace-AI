<template>
  <div class="impact-visualizer">
    <!-- 统计概览 -->
    <div class="impact-stats">
      <div class="impact-stat-item">
        <div class="impact-stat-value">{{ stats.totalBuildings }}</div>
        <div class="impact-stat-label">受影响楼宇</div>
      </div>
      <div class="impact-stat-item">
        <div class="impact-stat-value">{{ stats.totalFloors }}</div>
        <div class="impact-stat-label">受影响楼层</div>
      </div>
      <div class="impact-stat-item">
        <div class="impact-stat-value">{{ stats.totalRooms }}</div>
        <div class="impact-stat-label">受影响房间</div>
      </div>
      <div class="impact-stat-item">
        <div class="impact-stat-value">{{ stats.totalEquipment }}</div>
        <div class="impact-stat-label">受影响设备</div>
      </div>
    </div>

    <!-- 受影响楼宇列表 -->
    <div class="impact-buildings">
      <div
        v-for="building in impactScope.impactedBuildings"
        :key="building.buildingId"
        class="impact-building-card"
      >
        <div class="impact-building-header">
          <div class="impact-building-title">
            <span class="impact-building-icon">🏢</span>
            <span class="impact-building-name">{{ building.buildingName }}</span>
            <span class="impact-building-id">{{ building.buildingId }}</span>
          </div>
          <button
            class="impact-locate-btn"
            @click.stop="emit('locate-building', building.buildingId)"
          >
            📍 定位
          </button>
        </div>

        <!-- 楼层可视化 -->
        <div v-if="building.floors.length > 0" class="impact-floors">
          <div class="impact-section-label">受影响楼层</div>
          <div class="impact-floor-chips">
            <span
              v-for="floor in building.floors"
              :key="floor"
              class="impact-floor-chip"
            >
              {{ floor }}F
            </span>
          </div>
        </div>

        <!-- 房间列表 -->
        <div v-if="building.rooms.length > 0" class="impact-rooms">
          <div class="impact-section-label">受影响房间 ({{ building.rooms.length }})</div>
          <div class="impact-room-list">
            <div
              v-for="room in building.rooms"
              :key="room.roomId"
              class="impact-room-item"
            >
              <div class="impact-room-info">
                <span class="impact-room-no">{{ room.roomNo }}</span>
                <span v-if="room.floorNo !== null" class="impact-room-floor">{{ room.floorNo }}F</span>
              </div>
              <div v-if="room.equipmentIds.length > 0" class="impact-room-equipment">
                <span class="impact-equipment-icon">⚙️</span>
                <span class="impact-equipment-count">{{ room.equipmentIds.length }} 设备</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 避让要求 -->
    <div v-if="impactScope.bypassRequirement" class="impact-bypass">
      <div class="impact-section-label">管网链路避让要求</div>
      <div class="impact-bypass-content">{{ impactScope.bypassRequirement }}</div>
    </div>

    <!-- 调整记录 -->
    <div v-if="impactScope.manualAdjusted && impactScope.adjustmentLogs.length > 0" class="impact-adjustments">
      <div class="impact-section-label">
        <span>调整记录</span>
        <span class="impact-adjusted-badge">已手动调整</span>
      </div>
      <div class="impact-adjustment-list">
        <div
          v-for="log in impactScope.adjustmentLogs"
          :key="log.id"
          class="impact-adjustment-item"
        >
          <div class="impact-adjustment-meta">
            <span class="impact-adjustment-by">{{ log.adjustedBy }}</span>
            <span class="impact-adjustment-time">{{ formatTime(log.adjustedAt) }}</span>
          </div>
          <div class="impact-adjustment-note">{{ log.note }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ImpactScope } from '~/types/pipeline-ops'

const props = defineProps<{
  impactScope: ImpactScope
  formatTime: (input?: string) => string
}>()

const emit = defineEmits<{
  (e: 'locate-building', buildingId: string): void
}>()

const stats = computed(() => {
  const buildings = props.impactScope.impactedBuildings
  return {
    totalBuildings: buildings.length,
    totalFloors: buildings.reduce((sum, b) => sum + b.floors.length, 0),
    totalRooms: buildings.reduce((sum, b) => sum + b.rooms.length, 0),
    totalEquipment: buildings.reduce((sum, b) =>
      sum + b.rooms.reduce((roomSum, r) => roomSum + r.equipmentIds.length, 0), 0
    ),
  }
})
</script>

<style scoped>
.impact-visualizer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计概览 */
.impact-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.impact-stat-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  color: white;
}

.impact-stat-item:nth-child(2) {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.impact-stat-item:nth-child(3) {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.impact-stat-item:nth-child(4) {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.impact-stat-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.impact-stat-label {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.9;
}

/* 楼宇卡片 */
.impact-buildings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.impact-building-card {
  background: #f8f9fa;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  padding: 12px;
}

.impact-building-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.impact-building-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.impact-building-icon {
  font-size: 18px;
}

.impact-building-name {
  font-size: 14px;
  font-weight: 600;
  color: #24292e;
}

.impact-building-id {
  font-size: 12px;
  color: #6a737d;
  background: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e1e4e8;
}

.impact-locate-btn {
  background: #e8f4ff;
  color: #1f6dff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.impact-locate-btn:hover {
  background: #d0e8ff;
  border-color: #80bfff;
}

/* 楼层 */
.impact-floors {
  margin-bottom: 12px;
}

.impact-section-label {
  font-size: 12px;
  font-weight: 600;
  color: #6a737d;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.impact-floor-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.impact-floor-chip {
  background: #fff;
  border: 1px solid #d1d5da;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #24292e;
}

/* 房间 */
.impact-rooms {
  margin-top: 12px;
}

.impact-room-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.impact-room-item {
  background: #fff;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.impact-room-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.impact-room-no {
  font-size: 13px;
  font-weight: 600;
  color: #24292e;
}

.impact-room-floor {
  font-size: 11px;
  color: #6a737d;
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 3px;
}

.impact-room-equipment {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6a737d;
}

.impact-equipment-icon {
  font-size: 12px;
}

/* 避让要求 */
.impact-bypass {
  background: #fffbf0;
  border: 1px solid #ffd666;
  border-radius: 6px;
  padding: 10px;
}

.impact-bypass-content {
  font-size: 13px;
  color: #24292e;
  line-height: 1.5;
}

/* 调整记录 */
.impact-adjustments {
  background: #f0f7ff;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
  padding: 10px;
}

.impact-adjusted-badge {
  background: #1f6dff;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.impact-adjustment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.impact-adjustment-item {
  background: #fff;
  border: 1px solid #d0e8ff;
  border-radius: 4px;
  padding: 8px;
}

.impact-adjustment-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #6a737d;
  margin-bottom: 4px;
}

.impact-adjustment-by {
  font-weight: 600;
  color: #1f6dff;
}

.impact-adjustment-note {
  font-size: 12px;
  color: #24292e;
  line-height: 1.4;
}
</style>
