<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">分配房间</div>
          <div v-if="request" class="modalSub">{{ request.department }} · 申请面积 {{ request.area }} m²</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>
      <div class="modalBody">
        <div class="allocateInfo">
          <div class="stat">
            已选房间: <span class="highlight">{{ selectedRoomIds.length }}</span> 间
          </div>
          <div class="stat">
            已选面积: <span :class="['highlight', selectedArea >= (request?.area || 0) ? 'ok' : '']">{{ selectedArea }}</span> / {{ request?.area || 0 }} m²
          </div>
        </div>

        <div class="roomList">
          <div v-if="loading" class="stockHint">加载房源中...</div>
          <table v-else class="table small">
            <thead>
              <tr>
                <th width="40">选择</th>
                <th>楼栋</th>
                <th>房间号</th>
                <th>楼层</th>
                <th>面积</th>
                <th>用途</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="room in stockRooms" :key="room.id" @click="toggleRoom(room.id)" class="roomRow">
                <td><input type="checkbox" :checked="selectedRoomIds.includes(room.id)" @click.stop /></td>
                <td>{{ room.buildingName }}</td>
                <td>{{ room.roomNo }}</td>
                <td>{{ room.floor }}F</td>
                <td>{{ room.area }} m²</td>
                <td>{{ room.functionMain || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">取消</button>
          <button 
            class="btnPrimary" 
            :disabled="selectedRoomIds.length === 0 || selectedArea < (request?.area || 0)" 
            @click="submit"
            :title="selectedArea < (request?.area || 0) ? '已选面积不足' : ''"
          >
            确认分配
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AllocationRequest } from '~/server/utils/allocation-db'

const props = defineProps<{
  request: AllocationRequest | null
  stockRooms: any[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', roomIds: string[]): void
}>()

const selectedRoomIds = ref<string[]>([])

const selectedArea = computed(() => {
  return props.stockRooms
    .filter(r => selectedRoomIds.value.includes(r.id))
    .reduce((acc, r) => acc + (r.area || 0), 0)
})

watch(() => props.request, () => {
  selectedRoomIds.value = []
})

function toggleRoom(id: string) {
  const idx = selectedRoomIds.value.indexOf(id)
  if (idx > -1) selectedRoomIds.value.splice(idx, 1)
  else selectedRoomIds.value.push(id)
}

function submit() {
  emit('submit', [...selectedRoomIds.value])
}
</script>

<style scoped>
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
}

.modal {
  width: 100%;
  max-width: 880px;
  max-height: 90vh;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.modalHeader {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modalTitle {
  font-weight: 800;
  color: #1f2329;
}

.modalSub {
  margin-top: 2px;
  font-size: 12px;
  color: #8f959e;
}

.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.modalBody {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.allocateInfo {
  display: flex;
  gap: 24px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat {
  font-size: 13px;
  color: #646a73;
}

.highlight {
  font-weight: 700;
  color: #1f2329;
  font-size: 15px;
}

.highlight.ok {
  color: #22c55e;
}

.roomList {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  overflow: hidden;
  max-height: 400px;
  overflow-y: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
  background: #f8fafc;
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #eef0f2;
}

.table td {
  padding: 10px;
  border-bottom: 1px solid #eef0f2;
}

.roomRow {
  cursor: pointer;
}

.roomRow:hover {
  background: #f8fafc;
}

.stockHint {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnPrimary {
  border: 1px solid #3370ff;
  background: #3370ff;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnPrimary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

