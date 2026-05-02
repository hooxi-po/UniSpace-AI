<template>
  <div class="page">
    <div class="pageHeader">
      <div>
        <h2 class="title">盘点任务</h2>
        <p class="subtitle">覆盖年度盘点准备、现场清点、差异复核、归档结案的全流程管控</p>
      </div>
      <div class="viewSwitch" role="tablist" aria-label="切换视图">
        <button type="button" class="switchBtn" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">卡片</button>
        <button type="button" class="switchBtn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">列表</button>
      </div>
    </div>

    <InventoryTasksStats
      :total="stats.total"
      :completed="stats.completed"
      :reviewing="stats.reviewing"
      :overdue="stats.overdue"
      :progress-avg="stats.progressAvg"
    />

    <InventoryTasksFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-year="selectedYear"
      v-model:selected-status="selectedStatus"
      :year-options="yearOptions"
      :status-options="statusOptions"
      :count="filteredTasks.length"
      @search="applySearch"
      @reset="resetSearch"
    />

    <InventoryTasksList
      :loading="loading"
      :acting="acting"
      :view-mode="viewMode"
      :tasks="filteredTasks"
      :get-status-meta="getStatusMeta"
      @view-detail="handleOpenDetail"
      @start-review="handleStartReview"
      @archive-task="handleArchiveTask"
    />

    <InventoryTasksCharts
      :status-stats="statusStats"
      :phase-stats="phaseStats"
      :phase-color="phaseColor"
      :get-status-meta="getStatusMeta"
    />

    <div v-if="detailOpen" class="drawerMask" @click.self="handleCloseDetail">
      <aside class="drawer">
        <div class="drawerHeader">
          <div>
            <h3 class="drawerTitle">任务详情</h3>
            <p class="drawerSub">差异项可逐条钻取，支持直接发起复核与归档</p>
          </div>
          <button type="button" class="iconBtn" @click="handleCloseDetail">关闭</button>
        </div>

        <div v-if="detailLoading" class="emptyText">详情加载中...</div>
        <template v-else-if="activeTask">
          <div class="taskSummary">
            <div><strong>任务名称：</strong>{{ activeTask.taskName }}</div>
            <div><strong>任务编号：</strong>{{ activeTask.id }}</div>
            <div><strong>盘点范围：</strong>{{ activeTask.scope }}</div>
            <div><strong>负责人：</strong>{{ activeTask.leader }}（{{ activeTask.ownerDept }}）</div>
            <div><strong>进度：</strong>{{ activeTask.progress }}% · {{ activeTask.phase }}</div>
            <div><strong>截止：</strong>{{ activeTask.dueDate }}</div>
            <div>
              <strong>状态：</strong>
              <span class="statusTag" :style="{ backgroundColor: getStatusMeta(activeTask.status).bg, color: getStatusMeta(activeTask.status).text }">{{ activeTask.status }}</span>
            </div>
          </div>

          <div class="drawerActions">
            <button
              class="btn"
              :disabled="!activeTask.permissions?.canStartReview || acting"
              :title="!activeTask.permissions?.canStartReview ? (activeTask.permissions?.reason || '无权限') : ''"
              @click="handleStartReview(activeTask)"
            >
              发起复核
            </button>
            <button
              class="btn btn--primary"
              :disabled="!activeTask.permissions?.canArchive || acting"
              :title="!activeTask.permissions?.canArchive ? (activeTask.permissions?.reason || '无权限') : ''"
              @click="handleArchiveTask(activeTask)"
            >
              归档完成
            </button>
          </div>

          <section class="drilldown">
            <div class="sectionTitle">差异项 Drilldown（{{ activeDiscrepancies.length }}）</div>
            <div v-if="activeDiscrepancies.length === 0" class="emptyText">当前任务暂无差异项</div>
            <div v-else class="drillLayout">
              <div class="drillList">
                <button
                  v-for="item in activeDiscrepancies"
                  :key="item.id"
                  type="button"
                  class="drillItem"
                  :class="{ active: selectedDiscrepancy?.id === item.id }"
                  @click="selectedDiscrepancy = item"
                >
                  <div class="drillTop">
                    <strong>{{ item.assetName }}</strong>
                    <span class="severity" :class="`sev-${item.severity}`">{{ item.severity }}</span>
                  </div>
                  <div class="drillMeta">{{ item.assetCode }} · {{ item.problemType }}</div>
                  <div class="drillMeta">{{ item.location }}</div>
                </button>
              </div>

              <div class="drillDetail" v-if="selectedDiscrepancy">
                <h4>{{ selectedDiscrepancy.assetName }}</h4>
                <p><strong>资产编码：</strong>{{ selectedDiscrepancy.assetCode }}</p>
                <p><strong>异常类型：</strong>{{ selectedDiscrepancy.problemType }}</p>
                <p><strong>严重等级：</strong>{{ selectedDiscrepancy.severity }}</p>
                <p><strong>发现位置：</strong>{{ selectedDiscrepancy.location }}</p>
                <p><strong>发现时间：</strong>{{ selectedDiscrepancy.discoveredAt }}</p>
                <p><strong>建议处理：</strong>{{ selectedDiscrepancy.suggestion }}</p>
                <p><strong>复核人：</strong>{{ selectedDiscrepancy.reviewer || '待分配' }}</p>
              </div>
              <div v-else class="drillDetail emptyText">请选择一条差异项查看明细</div>
            </div>
          </section>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, ref } from 'vue'
import InventoryTasksCharts from '~/components/admin/property/inventory/components/InventoryTasksCharts.vue'
import InventoryTasksFilters from '~/components/admin/property/inventory/components/InventoryTasksFilters.vue'
import InventoryTasksList from '~/components/admin/property/inventory/components/InventoryTasksList.vue'
import InventoryTasksStats from '~/components/admin/property/inventory/components/InventoryTasksStats.vue'
import { useInventoryTasksOverview } from '~/composables/property/useInventoryTasksOverview'
import type { InventoryDiscrepancy, InventoryTask } from '~/services/inventory'

const {
  viewMode,
  loading,
  acting,
  draftKeyword,
  selectedYear,
  selectedStatus,
  yearOptions,
  statusOptions,
  filteredTasks,
  stats,
  statusStats,
  phaseStats,
  phaseColor,
  applySearch,
  resetSearch,
  getStatusMeta,
  detailOpen,
  detailLoading,
  activeTask,
  activeDiscrepancies,
  openDetail,
  closeDetail,
  startReview,
  archiveTask,
} = useInventoryTasksOverview()

const selectedDiscrepancy = ref<InventoryDiscrepancy | null>(null)

async function handleOpenDetail(task: InventoryTask) {
  await openDetail(task)
}

function handleCloseDetail() {
  closeDetail()
  selectedDiscrepancy.value = null
}

async function handleStartReview(task: InventoryTask) {
  if (!task.permissions?.canStartReview || acting.value) return

  const confirmed = window.confirm(`确认对任务「${task.taskName}」发起复核？`)
  if (!confirmed) return

  try {
    await startReview(task)
    window.alert('已发起复核')
  } catch (error: any) {
    window.alert(`发起复核失败：${error?.statusMessage || error?.message || '未知错误'}`)
  }
}

async function handleArchiveTask(task: InventoryTask) {
  if (!task.permissions?.canArchive || acting.value) return

  const confirmed = window.confirm(`确认将任务「${task.taskName}」归档完成？归档后状态将变为已完成。`)
  if (!confirmed) return

  try {
    await archiveTask(task)
    window.alert('已归档完成')
  } catch (error: any) {
    window.alert(`归档失败：${error?.statusMessage || error?.message || '未知错误'}`)
  }
}

watch(activeDiscrepancies, (list) => {
  selectedDiscrepancy.value = list[0] || null
})
</script>

<style scoped>
.page{display:grid;gap:16px;padding:16px}
.pageHeader{display:flex;align-items:center;justify-content:space-between;gap:12px}
.title{margin:0;font-size:20px;font-weight:800;color:#1f2329}
.subtitle{margin:4px 0 0;color:#646a73;font-size:13px}
.viewSwitch{display:inline-flex;border:1px solid var(--border,#dfe3ea);border-radius:10px;overflow:hidden;background:#fff}
.switchBtn{border:none;background:transparent;padding:8px 14px;cursor:pointer;color:#646a73;font-size:13px}
.switchBtn.active{background:#3370ff;color:#fff;font-weight:700}

.drawerMask{position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.38);display:flex;justify-content:flex-end}
.drawer{height:100%;width:min(920px,96vw);background:#fff;padding:16px;display:grid;gap:14px;overflow:auto}
.drawerHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.drawerTitle{margin:0;font-size:18px}
.drawerSub{margin:4px 0 0;font-size:12px;color:#646a73}
.iconBtn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
.taskSummary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;background:#f8fafc;border-radius:10px;font-size:13px}
.drawerActions{display:flex;gap:8px}
.btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px}
.btn:disabled{cursor:not-allowed;color:#9aa0a6;background:#f5f6f8}
.btn--primary{background:#3370ff;color:#fff;border-color:#3370ff}
.statusTag{border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}

.drilldown{display:grid;gap:10px}
.sectionTitle{font-size:14px;font-weight:700}
.emptyText{font-size:13px;color:#646a73}
.drillLayout{display:grid;grid-template-columns:320px 1fr;gap:12px;min-height:300px}
.drillList{display:grid;gap:8px;align-content:start;max-height:65vh;overflow:auto;padding-right:4px}
.drillItem{border:1px solid var(--border-light,#edf0f5);border-radius:10px;background:#fff;padding:10px;text-align:left;cursor:pointer;display:grid;gap:4px}
.drillItem.active{border-color:#3370ff;background:#f5f8ff}
.drillTop{display:flex;align-items:center;justify-content:space-between;gap:8px}
.drillMeta{font-size:12px;color:#646a73}
.severity{display:inline-flex;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700}
.sev-低{background:#e0f2fe;color:#075985}
.sev-中{background:#fef3c7;color:#92400e}
.sev-高{background:#fee2e2;color:#991b1b}
.drillDetail{border:1px solid var(--border-light,#edf0f5);border-radius:10px;padding:12px;background:#fff}
.drillDetail h4{margin:0 0 8px}
.drillDetail p{margin:0 0 8px;font-size:13px}

@media (max-width:900px){
  .taskSummary{grid-template-columns:1fr}
  .drillLayout{grid-template-columns:1fr}
}
@media (max-width:700px){.pageHeader{flex-direction:column;align-items:flex-start}}
</style>
