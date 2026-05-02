<template>
  <div class="urge-list">
    <div v-if="data.length === 0" class="empty-state">
      暂无催缴记录
    </div>
    <div v-else class="list-container divide-y">
      <div v-for="item in data" :key="item.id" class="urge-item p-4 hover:bg-gray-50 transition">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="font-medium text-[#1f2329]">{{ item.departmentName }}</span>
              <span :class="['type-tag', getTypeClass(item.reminderType)]">
                {{ getTypeLabel(item.reminderType) }}
              </span>
              <span v-if="item.isRead" class="status-tag read">
                <CheckCircle :size="12" /> 已读
              </span>
              <span v-else class="status-tag unread">
                <Clock :size="12" /> 未读
              </span>
            </div>
            <p class="text-sm text-[#646a73] mb-2">{{ item.content }}</p>
            <div class="footer-info flex items-center gap-4 text-xs text-[#8f959e]">
              <span>账单: {{ item.billNo }}</span>
              <span>发送人: {{ item.sentBy }}</span>
              <span>发送时间: {{ formatDate(item.sentAt) }}</span>
              <span v-if="item.readAt">阅读时间: {{ formatDate(item.readAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle, Clock } from 'lucide-vue-next'
import type { ReminderRecord } from '~/server/utils/charging-db'

defineProps<{
  data: ReminderRecord[]
}>()

function getTypeLabel(type: ReminderRecord['reminderType']) {
  const map: Record<ReminderRecord['reminderType'], string> = {
    System: '系统通知',
    OA: 'OA通知',
    SMS: '短信',
    Email: '邮件'
  }
  return map[type] || type
}

function getTypeClass(type: ReminderRecord['reminderType']) {
  const map: Record<ReminderRecord['reminderType'], string> = {
    System: 'bg-blue-100 text-blue-700',
    OA: 'bg-purple-100 text-purple-700',
    SMS: 'bg-green-100 text-green-700',
    Email: 'bg-orange-100 text-orange-700'
  }
  return map[type] || 'bg-gray-100 text-gray-700'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}
</script>

<style scoped>
.urge-list {
  background: #fff;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #8f959e;
  font-size: 14px;
}

.type-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-tag {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-tag.read {
  color: #22c55e;
}

.status-tag.unread {
  color: #f59e0b;
}

.divide-y > * + * {
  border-top: 1px solid #dee0e3;
}
</style>

