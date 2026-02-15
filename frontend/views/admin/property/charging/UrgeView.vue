<template>
  <div class="page">
    <div class="header">
      <div>
        <h3 class="title">催缴管理</h3>
        <p class="subTitle">查看系统通知、OA、短信等催缴记录发送状态</p>
      </div>
    </div>

    <UrgeFilters
      v-model:searchTerm="searchTerm"
      v-model:typeFilter="typeFilter"
      v-model:readFilter="readFilter"
      @export="exportCsv"
    />

    <div class="card">
      <UrgeTable :data="filteredReminders" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search } from 'lucide-vue-next'
import UrgeFilters from '~/components/admin/property/charging/components/UrgeFilters.vue'
import UrgeTable from '~/components/admin/property/charging/components/UrgeTable.vue'
import { chargingService } from '~/services/charging'
import type { ReminderRecord } from '~/server/utils/charging-db'

const reminders = ref<ReminderRecord[]>([])
const searchTerm = ref('')
const typeFilter = ref<ReminderRecord['reminderType'] | 'all'>('all')
const readFilter = ref<'all' | 'read' | 'unread'>('all')

onMounted(async () => {
  const res = await chargingService.fetchReminders()
  reminders.value = res.list
})

const filteredReminders = computed(() => {
  return reminders.value.filter(r => {
    const matchSearch = !searchTerm.value || 
                        r.departmentName.includes(searchTerm.value) || 
                        r.billNo.includes(searchTerm.value)
    const matchType = typeFilter.value === 'all' || r.reminderType === typeFilter.value
    const matchRead = readFilter.value === 'all' || 
                      (readFilter.value === 'read' ? r.isRead : !r.isRead)
    return matchSearch && matchType && matchRead
  })
})

function exportCsv() {
  const rows = filteredReminders.value.map(r => ({
    部门: r.departmentName,
    账单编号: r.billNo,
    催缴类型: r.reminderType,
    内容: r.content,
    发送人: r.sentBy,
    发送时间: new Date(r.sentAt).toLocaleString(),
    状态: r.isRead ? '已读' : '未读'
  }))

  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `催缴记录_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  margin-bottom: 4px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
}

.subTitle {
  font-size: 13px;
  color: #8f959e;
  margin-top: 4px;
}

.card {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  overflow: hidden;
}
</style>
