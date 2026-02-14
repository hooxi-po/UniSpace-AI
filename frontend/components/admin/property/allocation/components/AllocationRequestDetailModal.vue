<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">申请详情</div>
          <div v-if="request" class="modalSub">{{ request.department }} · {{ request.id }}</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>

      <div v-if="request" class="modalBody">
        <div class="grid">
          <div class="field">
            <div class="k">申请人</div>
            <div class="v">{{ request.applicant }}</div>
          </div>
          <div class="field">
            <div class="k">面积</div>
            <div class="v">{{ request.area }} m²</div>
          </div>
          <div class="field">
            <div class="k">用途</div>
            <div class="v">{{ getUseTypeLabel(request.useType) }}</div>
          </div>
          <div class="field">
            <div class="k">紧急程度</div>
            <div class="v">{{ request.urgency === 'Urgent' ? '加急' : '普通' }}</div>
          </div>
          <div class="field">
            <div class="k">当前状态</div>
            <div class="v"><span :class="getStatusColorClass(request.status)">{{ getStatusLabel(request.status) }}</span></div>
          </div>
          <div class="field">
            <div class="k">申请日期</div>
            <div class="v">{{ request.requestedDate }}</div>
          </div>
        </div>

        <div class="reason">
          <div class="k">申请理由</div>
          <div class="reasonBox">{{ request.reason }}</div>
        </div>

        <div v-if="request.allocatedRooms?.length" class="allocated">
          <div class="sectionTitle"><MapPin :size="16" /> 已分配房间</div>
          <div class="allocatedList">
            <div v-for="roomId in request.allocatedRooms" :key="roomId" class="allocatedItem">
              {{ getRoomInfo(roomId) }}
            </div>
          </div>
        </div>

        <div class="flow">
          <div class="sectionTitle"><History :size="16" /> 审批记录</div>
          <div class="flowList">
            <div v-for="rec in (request.approvalRecords || [])" :key="rec.id" class="flowItem">
              <div class="flowTop">
                <div class="flowRole">{{ rec.approverRole }}</div>
                <div class="flowAt">{{ formatTime(rec.timestamp) }}</div>
              </div>
              <div class="flowSub">
                {{ rec.approverName }} · {{ rec.action === 'Submit' ? '提交申请' : rec.action === 'Approve' ? '通过' : '驳回' }}
                <span v-if="rec.comment"> · {{ rec.comment }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="modalBody emptyState">未选择申请</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { History, MapPin } from 'lucide-vue-next'
import type { AllocationRequest } from '~/server/utils/allocation-db'

const props = defineProps<{
  request: AllocationRequest | null
  stockRooms: any[]
  getStatusLabel: (st: AllocationRequest['status']) => string
  getUseTypeLabel: (t: AllocationRequest['useType']) => string
  getStatusColorClass: (st: AllocationRequest['status']) => string
}>()

defineEmits<{ (e: 'close'): void }>()

function formatTime(ts: string) {
  return new Date(ts).toLocaleString('zh-CN')
}

function getRoomInfo(roomId: string) {
  const room = props.stockRooms.find(r => r.id === roomId)
  if (!room) return `未知房间 (${roomId})`
  return `${room.buildingName} ${room.roomNo} (${room.area} m²)`
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

.emptyState {
  color: #8f959e;
  text-align: center;
  padding: 24px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.field {
  border: 1px solid #eef0f2;
  border-radius: 12px;
  padding: 10px;
}

.k {
  font-size: 12px;
  color: #8f959e;
}

.v {
  margin-top: 6px;
  font-weight: 700;
  color: #1f2329;
}

.reasonBox {
  margin-top: 8px;
  background: #f9fafb;
  border: 1px solid #eef0f2;
  border-radius: 12px;
  padding: 10px;
  color: #1f2329;
}

.sectionTitle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #1f2329;
}

.flowList {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.flowItem {
  border: 1px solid #eef0f2;
  border-radius: 12px;
  padding: 10px;
  background: #fff;
}

.flowTop {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.flowRole {
  font-weight: 700;
  color: #1f2329;
}

.flowAt {
  font-size: 12px;
  color: #8f959e;
}

.flowSub {
  margin-top: 6px;
  font-size: 12px;
  color: #646a73;
}

.allocatedList {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.allocatedItem {
  background: #ecfdf5;
  border: 1px solid #dcfce7;
  border-radius: 10px;
  padding: 8px 10px;
  color: #065f46;
  font-size: 13px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>

