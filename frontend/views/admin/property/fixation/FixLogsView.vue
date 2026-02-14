<template>
  <div class="page">
    <div class="header">
      <h2 class="title">操作记录</h2>
      <p class="subtitle">记录“资产转固与管理”模块下所有的操作日志，确保过程可追溯。</p>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索项目名称/操作内容/操作人..." />
      </div>
      <div class="filterGroup">
        <select v-model="filterAction" class="select">
          <option value="">所有操作类型</option>
          <option value="updateProject">项目/申请更新</option>
          <option value="addAttachment">上传附件</option>
          <option value="deleteAttachment">删除附件</option>
          <option value="addSplitItem">新增拆分项</option>
          <option value="deleteSplitItem">删除拆分项</option>
          <option value="addBuildings">导入建筑</option>
          <option value="addRooms">导入房间</option>
          <option value="syncRoomFunctions">同步房间功能</option>
        </select>
        <button class="btnGhost" @click="fetchLogs">
          <RefreshCw :size="14" :class="{ spinning: loading }" /> 刷新
        </button>
      </div>
    </div>

    <div class="tableCard">
      <div v-if="loading" class="loadingState">
        <RefreshCw :size="24" class="spinning" />
        <span>加载中...</span>
      </div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>操作时间</th>
            <th>操作人</th>
            <th>涉及项目</th>
            <th>操作内容</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in filteredLogs" :key="log.id" class="row">
            <td class="time">{{ formatTime(log.at) }}</td>
            <td class="operator">
              <span class="userBadge">{{ log.operator }}</span>
            </td>
            <td>
              <div class="projectInfo">
                <span class="projectName">{{ log.projectName || '-' }}</span>
                <span class="projectId">{{ log.projectId || '' }}</span>
              </div>
            </td>
            <td class="summary">
              <span :class="['actionBadge', log.action]">{{ getActionLabel(log.action) }}</span>
              {{ log.summary }}
            </td>
            <td>
              <button v-if="log.detail" class="link" @click="viewDetail(log)">
                <Info :size="14" /> 详情
              </button>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="5" class="empty">暂无相关操作记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="selectedLog" class="modalMask" @click="selectedLog = null">
      <div class="modal" @click.stop>
        <div class="modalHeader">
          <h3 class="modalTitle">日志详情</h3>
          <button class="closeBtn" @click="selectedLog = null">关闭</button>
        </div>
        <div class="modalBody">
          <pre class="json">{{ JSON.stringify(selectedLog.detail, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, RefreshCw, Info } from 'lucide-vue-next'
import { fixationService } from '~/services/fixation'
import type { FixationOperationLog, FixationLogAction } from '~/server/utils/fixation-logs-db'

const logs = ref<FixationOperationLog[]>([])
const loading = ref(false)
const searchTerm = ref('')
const filterAction = ref('')
const selectedLog = ref<FixationOperationLog | null>(null)

async function fetchLogs() {
  loading.value = true
  try {
    const res = await fixationService.fetchLogs()
    logs.value = res.list
  } catch (err) {
    console.error('Failed to fetch logs:', err)
  } finally {
    loading.value = false
  }
}

const filteredLogs = computed(() => {
  let result = logs.value
  const q = searchTerm.value.trim().toLowerCase()
  
  if (q) {
    result = result.filter(l => 
      (l.projectName?.toLowerCase().includes(q)) ||
      (l.summary.toLowerCase().includes(q)) ||
      (l.operator.toLowerCase().includes(q)) ||
      (l.projectId?.toLowerCase().includes(q))
    )
  }
  
  if (filterAction.value) {
    result = result.filter(l => l.action === filterAction.value)
  }
  
  return result
})

function getActionLabel(action: FixationLogAction) {
  const labels: Record<string, string> = {
    updateProject: '状态更新',
    addAttachment: '附件上传',
    updateAttachment: '附件修改',
    deleteAttachment: '附件删除',
    addSplitItem: '资产拆分',
    deleteSplitItem: '拆分删除',
    syncRoomFunctions: '功能同步',
    addBuildings: '建筑导入',
    addRooms: '房间导入'
  }
  return labels[action] || action
}

function formatTime(at: string) {
  return new Date(at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function viewDetail(log: FixationOperationLog) {
  selectedLog.value = log
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
}

.subtitle {
  font-size: 13px;
  color: #646a73;
}

.filterCard {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #dee0e3;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.searchBox {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.searchIcon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #8f959e;
}

.searchInput {
  width: 100%;
  padding: 8px 10px 8px 32px;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  font-size: 14px;
}

.filterGroup {
  display: flex;
  gap: 8px;
}

.select {
  padding: 0 12px;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
}

.btnGhost {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  color: #1f2329;
  cursor: pointer;
}

.btnGhost:hover {
  background: #f5f6f7;
}

.tableCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  overflow: hidden;
  min-height: 400px;
  position: relative;
}

.loadingState {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.8);
  z-index: 10;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th {
  text-align: left;
  padding: 12px;
  background: #f8fafc;
  color: #646a73;
  font-weight: 500;
  border-bottom: 1px solid #eef0f2;
}

.table td {
  padding: 12px;
  border-bottom: 1px solid #eef0f2;
  vertical-align: middle;
}

.row:hover {
  background: #f8fafc;
}

.time {
  color: #646a73;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.userBadge {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.projectInfo {
  display: flex;
  flex-direction: column;
}

.projectName {
  font-weight: 500;
  color: #1f2329;
}

.projectId {
  font-size: 12px;
  color: #8f959e;
}

.actionBadge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 8px;
  text-transform: uppercase;
}

.updateProject { background: #e0f2fe; color: #0369a1; }
.addAttachment { background: #dcfce7; color: #15803d; }
.addSplitItem { background: #fef9c3; color: #a16207; }
.deleteAttachment, .deleteSplitItem { background: #fee2e2; color: #b91c1c; }

.summary {
  color: #1f2329;
}

.link {
  color: #3370ff;
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #8f959e;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

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
  background: #fff;
  width: 500px;
  border-radius: 8px;
  overflow: hidden;
}

.modalHeader {
  padding: 12px 16px;
  border-bottom: 1px solid #dee0e3;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modalBody {
  padding: 16px;
  max-height: 400px;
  overflow: auto;
}

.json {
  background: #f5f6f7;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.closeBtn {
  background: none;
  border: 1px solid #dee0e3;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
