<template>
  <div class="borrowList">
    <div class="sectionHeader">
      <h3 class="sectionTitle"><Calendar :size="18" /> 临时借用情况 (演示)</h3>
      <div class="hint">当前展示正在借用中的房间及到期提醒</div>
    </div>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="borrows.length === 0" class="empty">暂无活跃的临时借用记录</div>
    <div v-else class="list">
      <div v-for="tb in borrows" :key="tb.id" class="item">
        <div class="itemMain">
          <div class="roomInfo">
            <span class="roomName">{{ tb.buildingName }} {{ tb.roomNo }}</span>
            <span :class="['statusTag', getExpiringStatus(tb.endDate).class]">
              {{ getExpiringStatus(tb.endDate).label }}
            </span>
          </div>
          <div class="deptInfo">
            <span class="borrower">{{ tb.borrowerDept }}</span>
            <span class="arrow"><ArrowRight :size="12" /></span>
            <span class="owner">借自 {{ tb.ownerDept }}</span>
          </div>
          <div class="dateRange">
            {{ tb.startDate }} 至 {{ tb.endDate }}
          </div>
        </div>
        <div class="itemAction">
          <button class="btnOutline" title="模拟提醒通知"><Bell :size="14" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Calendar, ArrowRight, Bell } from 'lucide-vue-next'
import type { TemporaryBorrow } from '~/server/utils/allocation-db'

defineProps<{
  borrows: TemporaryBorrow[]
  loading: boolean
}>()

function getExpiringStatus(endDate: string) {
  const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: '已过期', class: 'expired' }
  if (daysLeft <= 30) return { label: `${daysLeft}天后到期`, class: 'expiring' }
  return { label: `剩余 ${daysLeft} 天`, class: 'normal' }
}
</script>

<style scoped>
.borrowList {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}
.sectionHeader {
  padding: 16px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sectionTitle {
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.hint {
  font-size: 12px;
  color: #8f959e;
}
.empty {
  padding: 40px;
  text-align: center;
  color: #8f959e;
  font-size: 14px;
}
.list {
  display: grid;
  gap: 1px;
  background: #eef0f2;
}
.item {
  background: #fff;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.item:hover {
  background: #f9fafb;
}
.roomInfo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.roomName {
  font-weight: 700;
  color: #1f2329;
}
.statusTag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.statusTag.normal { background: #eff6ff; color: #1d4ed8; }
.statusTag.expiring { background: #fff7ed; color: #c2410c; }
.statusTag.expired { background: #fef2f2; color: #dc2626; }

.deptInfo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}
.borrower { font-weight: 600; color: #1f2329; }
.owner { color: #646a73; }
.arrow { color: #8f959e; }

.dateRange {
  font-size: 12px;
  color: #8f959e;
}
.btnOutline {
  background: #fff;
  border: 1px solid #dee0e3;
  padding: 6px;
  border-radius: 6px;
  color: #646a73;
  cursor: pointer;
}
.btnOutline:hover {
  border-color: #3370ff;
  color: #3370ff;
}
</style>

