<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">调整申请详情</div>
          <div v-if="request" class="modalSub">{{ request.department }} · {{ request.id }}</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>

      <div v-if="request" class="modalBody">
        <!-- 进度条逻辑：如果是退房申请，则跳过“配房”步骤 -->
        <div class="statusStep">
          <div :class="['step', { active: true }]">提交</div>
          <div :class="['line', { active: !!request.approvedAt }]"></div>
          <div :class="['step', { active: !!request.approvedAt }]">审批</div>
          
          <template v-if="!isReturnRequest">
            <div :class="['line', { active: !!request.allocatedAt }]"></div>
            <div :class="['step', { active: !!request.allocatedAt }]">配房</div>
          </template>

          <div :class="['line', { active: !!request.completedAt }]"></div>
          <div :class="['step', { active: !!request.completedAt }]">完成</div>
        </div>

        <div class="grid">
          <div class="field">
            <div class="k">申请人</div>
            <div class="v">{{ request.applicant }}</div>
          </div>
          <div class="field">
            <div class="k">{{ isReturnRequest ? '退还房间' : '调整前房间' }}</div>
            <div class="v">{{ request.fromBuildingName }}{{ request.fromRoomNo }}</div>
          </div>
          <div class="field">
            <div class="k">{{ isReturnRequest ? '退还面积' : '调整前面积' }}</div>
            <div class="v">{{ request.fromArea }} m²</div>
          </div>
          <div class="field">
            <div class="k">当前状态</div>
            <div class="v">
              <span :class="['badge', getStatusClass(request.status)]">
                {{ getStatusLabel(request.status) }}
              </span>
            </div>
          </div>
          <div class="field">
            <div class="k">申请日期</div>
            <div class="v">{{ request.createdAt }}</div>
          </div>
        </div>

        <div class="reason">
          <div class="k">{{ isReturnRequest ? '退房原因' : '调整原因' }}</div>
          <div class="reasonBox">{{ request.reason }}</div>
        </div>

        <!-- 换房申请：展示分配的目标房间 -->
        <div v-if="!isReturnRequest && request.toBuildingName" class="allocated">
          <div class="sectionTitle"><MapPin :size="16" /> 分配目标房间</div>
          <div class="allocatedBox">
            {{ request.toBuildingName }}{{ request.toRoomNo }} ({{ request.toArea }} m²)
          </div>
        </div>

        <!-- 换房申请 & 审批通过：允许配房 -->
        <div v-if="!isReturnRequest && request.status === 'Approved'" class="allocateAction">
          <div class="sectionTitle">分配新房源</div>
          <div class="roomGrid">
            <div 
              v-for="room in availableRooms" 
              :key="room.id"
              :class="['roomItem', { selected: selectedRoom?.id === room.id }]"
              @click="selectedRoom = room"
            >
              <div class="roomInfo">{{ room.buildingName }}{{ room.roomNo }}</div>
              <div class="roomSub">{{ room.area }} m² · {{ room.functionMain }}</div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">关闭</button>
          
          <button 
            v-if="request.status === 'Pending'" 
            class="btnPrimary" 
            @click="$emit('approve', request.id)"
          >
            批准申请
          </button>

          <button 
            v-if="!isReturnRequest && request.status === 'Approved'" 
            class="btnPrimary" 
            :disabled="!selectedRoom"
            @click="$emit('allocate', request.id, selectedRoom)"
          >
            确认配房
          </button>

          <!-- 退房申请批准后直接进入交接完成；换房申请配房后进入交接完成 -->
          <button 
            v-if="(isReturnRequest && request.status === 'Approved') || (!isReturnRequest && request.status === 'Allocated')" 
            class="btnPrimary" 
            @click="$emit('complete', request.id)"
          >
            确认交接完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPin } from 'lucide-vue-next'
import type { AdjustmentRequest } from '~/server/utils/allocation-db'

const props = defineProps<{
  request: AdjustmentRequest | null
  stockRooms: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'approve', id: string): void
  (e: 'allocate', id: string, room: any): void
  (e: 'complete', id: string): void
}>()

const selectedRoom = ref<any>(null)

const isReturnRequest = computed(() => {
  return props.request?.id?.startsWith('RET-') || props.request?.reason?.includes('退房')
})

const availableRooms = computed(() => props.stockRooms.filter(r => r.status === 'Empty'))

function getStatusLabel(s: string) {
  const map: any = {
    Pending: '待审批',
    Approved: '已批准待配房',
    Allocated: '已配房',
    Completed: '已完成',
    Rejected: '已驳回'
  }
  return map[s] || s
}

function getStatusClass(s: string) {
  const map: any = {
    Pending: 'badgeAmber',
    Approved: 'badgeBlue',
    Allocated: 'badgeOrange',
    Completed: 'badgeGreen',
    Rejected: 'badgeGray'
  }
  return map[s] || ''
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
  z-index: 100;
}
.modal {
  width: 100%;
  max-width: 700px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}
.modalHeader {
  padding: 16px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.modalTitle {
  font-weight: 700;
  font-size: 18px;
}
.modalSub {
  font-size: 12px;
  color: #8f959e;
  margin-top: 4px;
}
.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
}
.modalBody {
  padding: 16px;
}
.statusStep {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  padding: 0 40px;
}
.step {
  font-size: 12px;
  color: #8f959e;
  padding: 4px 12px;
  border-radius: 999px;
  background: #f5f6f7;
}
.step.active {
  background: #3370ff;
  color: #fff;
}
.line {
  flex: 1;
  height: 2px;
  background: #f5f6f7;
  margin: 0 8px;
}
.line.active {
  background: #3370ff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.field {
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
}
.k {
  font-size: 12px;
  color: #8f959e;
  margin-bottom: 4px;
}
.v {
  font-weight: 600;
  font-size: 14px;
  color: #1f2329;
}
.reasonBox {
  padding: 12px;
  background: #f5f6f7;
  border-radius: 8px;
  font-size: 14px;
  color: #1f2329;
  margin-top: 8px;
}
.sectionTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  margin: 20px 0 12px;
}
.allocatedBox {
  padding: 12px;
  background: #e1eaff;
  color: #3370ff;
  border-radius: 8px;
  font-weight: 600;
}
.roomGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
}
.roomItem {
  padding: 10px;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  cursor: pointer;
}
.roomItem.selected {
  border-color: #3370ff;
  background: #f0f5ff;
}
.roomInfo {
  font-weight: 600;
  font-size: 13px;
}
.roomSub {
  font-size: 11px;
  color: #8f959e;
  margin-top: 4px;
}
.actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}
.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}
.btnPrimary:disabled {
  opacity: 0.5;
}
.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.badgeAmber { background: #fff7ed; color: #c2410c; }
.badgeBlue { background: #eff6ff; color: #1d4ed8; }
.badgeOrange { background: #fff7ed; color: #9a3412; }
.badgeGreen { background: #ecfdf5; color: #047857; }
.badgeGray { background: #f3f4f6; color: #374151; }
</style>

