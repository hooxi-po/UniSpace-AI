<template>
  <div class="page">
    <div class="header">
      <h2 class="title">调整记录</h2>
      <p class="subtitle">记录“公用房归口调配”模块下的所有操作日志，确保过程可追溯。</p>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索部门/操作内容/操作人/申请编号..." />
      </div>
      <div class="filterGroup">
        <select v-model="filterAction" class="select">
          <option value="">所有操作类型</option>
          <option value="createRequest">提交申请</option>
          <option value="approve">审批通过/更新</option>
          <option value="reject">驳回</option>
          <option value="allocateRooms">分配房间</option>
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
            <th>部门</th>
            <th>申请/单号</th>
            <th>操作内容</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in filteredLogs" :key="log.id" class="row">
            <td class="time">{{ formatTime(log.at) }}</td>
            <td class="operator"><span class="userBadge">{{ log.operator }}</span></td>
            <td>
              <span class="dept">{{ log.department || '-' }}</span>
            </td>
            <td class="mono">{{ log.requestId || '-' }}</td>
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
            <td colspan="6" class="empty">暂无相关操作记录</td>
          </tr>
        </tbody>
      </table>
    </div>

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
import { computed, onMounted, ref } from 'vue'
import { Info, RefreshCw, Search } from 'lucide-vue-next'
import { allocationService } from '~/services/allocation'
import type { AllocationOperationLog, AllocationLogAction } from '~/server/utils/allocation-logs-db'

const logs = ref<AllocationOperationLog[]>([])
const loading = ref(false)
const searchTerm = ref('')
const filterAction = ref('')
const selectedLog = ref<AllocationOperationLog | null>(null)

async function fetchLogs() {
  loading.value = true
  try {
    const res = await allocationService.fetchLogs()
    logs.value = res.list
  } catch (err) {
    console.error('Failed to fetch allocation logs:', err)
  } finally {
    loading.value = false
  }
}

const filteredLogs = computed(() => {
  let result = logs.value
  const q = searchTerm.value.trim().toLowerCase()

  if (q) {
    result = result.filter(l =>
      (l.department?.toLowerCase().includes(q)) ||
      (l.summary.toLowerCase().includes(q)) ||
      (l.operator.toLowerCase().includes(q)) ||
      (l.requestId?.toLowerCase().includes(q))
    )
  }

  if (filterAction.value) {
    result = result.filter(l => l.action === filterAction.value)
  }

  return result
})

function getActionLabel(action: AllocationLogAction) {
  const labels: Record<string, string> = {
    createRequest: '提交申请',
    approve: '审批/更新',
    reject: '驳回',
    allocateRooms: '分配房间'
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

function viewDetail(log: AllocationOperationLog) {
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
  max-width: 420px;
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
  min-height: 420px;
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

.dept {
  color: #1f2329;
  font-weight: 500;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: #646a73;
}

.actionBadge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 8px;
  text-transform: uppercase;
}

.createRequest { background: #e0f2fe; color: #0369a1; }
.approve { background: #dcfce7; color: #15803d; }
.reject { background: #fee2e2; color: #b91c1c; }
.allocateRooms { background: #fef9c3; color: #a16207; }

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

.muted {
  color: #8f959e;
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
  width: 520px;
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
  max-height: 420px;
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
