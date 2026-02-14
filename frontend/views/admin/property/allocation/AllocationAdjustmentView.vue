<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">用房调整</h2>
        <p class="subtitle">管理换房申请、退房申请以及临时借用。处理从申请到交接完成的全生命周期。</p>
      </div>
      <div class="headerActions">
        <button class="btnGhost" @click="openApply('Exchange')">
          <ArrowLeftRight :size="14" /> 申请换房
        </button>
        <button class="btnGhost" @click="openApply('Return')">
          <RotateCcw :size="14" /> 申请退房
        </button>
        <button class="btnGhost" @click="borrowModalShow = true">
          <Plus :size="14" /> 录入借用
        </button>
        <button class="btnPrimary" @click="fetchAdjustments">
          <RefreshCw :size="14" :class="{ spinning: adjustmentsLoading }" /> 刷新
        </button>
      </div>
    </div>

    <div class="stats">
      <div class="statCard">
        <div class="statValue">{{ pendingCount }}</div>
        <div class="statLabel">待审批调整</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ allocatedCount }}</div>
        <div class="statLabel">待交接调整</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ expiringBorrowsCount }}</div>
        <div class="statLabel">即将到期借用 (30天内)</div>
      </div>
    </div>

    <div class="mainContent">
      <div class="leftCol">
        <div class="card">
          <div class="cardHeader">
            <h3 class="cardTitle">调整申请列表</h3>
          </div>
          <div class="tableWrap">
            <div v-if="adjustmentsLoading" class="loading">加载中...</div>
            <table v-else class="table">
              <thead>
                <tr>
                  <th>申请编号</th>
                  <th>部门</th>
                  <th>原房间</th>
                  <th>目标房间</th>
                  <th>状态</th>
                  <th class="right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="adj in adjustments" :key="adj.id" class="row">
                  <td class="mono">{{ adj.id }}</td>
                  <td>{{ adj.department }}</td>
                  <td>{{ adj.fromBuildingName }}{{ adj.fromRoomNo }}</td>
                  <td>
                    <span v-if="adj.toBuildingName">{{ adj.toBuildingName }}{{ adj.toRoomNo }}</span>
                    <span v-else class="muted">待分配</span>
                  </td>
                  <td>
                    <span :class="['badge', getStatusClass(adj.status)]">
                      {{ getStatusLabel(adj.status) }}
                    </span>
                  </td>
                  <td class="right">
                    <button class="link" @click="openDetail(adj)">
                      <Eye :size="14" /> 详情
                    </button>
                  </td>
                </tr>
                <tr v-if="adjustments.length === 0">
                  <td colspan="6" class="empty">暂无调整申请</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="rightCol">
        <TemporaryBorrowList :borrows="borrows" :loading="borrowsLoading" />
      </div>
    </div>

    <!-- 弹窗组件 -->
    <AdjustmentRequestModal
      v-if="applyModal.show"
      :type="applyModal.type"
      :buildings="buildingNames"
      @close="applyModal.show = false"
      @submit="handleApply"
    />

    <AdjustmentDetailModal
      v-if="selectedAdj"
      :request="selectedAdj"
      :stock-rooms="stockRooms"
      @close="selectedAdj = null"
      @approve="handleApprove"
      @allocate="handleAllocate"
      @complete="handleComplete"
    />

    <TemporaryBorrowModal
      v-if="borrowModalShow"
      :buildings="buildingNames"
      @close="borrowModalShow = false"
      @submit="handleCreateBorrow"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ArrowLeftRight, RotateCcw, RefreshCw, Eye, Plus } from 'lucide-vue-next'
import { useAllocationAdjustment } from '~/composables/useAllocationAdjustment'
import AdjustmentRequestModal from '~/components/admin/property/allocation/components/AdjustmentRequestModal.vue'
import AdjustmentDetailModal from '~/components/admin/property/allocation/components/AdjustmentDetailModal.vue'
import TemporaryBorrowList from '~/components/admin/property/allocation/components/TemporaryBorrowList.vue'
import TemporaryBorrowModal from '~/components/admin/property/allocation/components/TemporaryBorrowModal.vue'

const {
  adjustments,
  adjustmentsLoading,
  borrows,
  borrowsLoading,
  stockRooms,
  createAdjustment,
  approveAdjustment,
  allocateAdjustment,
  completeAdjustment,
  createBorrow,
  fetchAdjustments
} = useAllocationAdjustment()

const applyModal = reactive({
  show: false,
  type: 'Exchange' as 'Exchange' | 'Return'
})

const borrowModalShow = ref(false)
const selectedAdj = ref<any>(null)

const buildingNames = computed(() => {
  const set = new Set(stockRooms.value.map(r => r.buildingName))
  return Array.from(set) as string[]
})

const pendingCount = computed(() => (adjustments.value || []).filter(a => a.status === 'Pending').length)
const allocatedCount = computed(() => (adjustments.value || []).filter(a => a.status === 'Allocated').length)
const expiringBorrowsCount = computed(() => {
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return (borrows.value || []).filter(b => b.status === 'Active' && (new Date(b.endDate).getTime() - now) <= thirtyDays).length
})

function openApply(type: 'Exchange' | 'Return') {
  applyModal.type = type
  applyModal.show = true
}

async function handleApply(data: any) {
  await createAdjustment(data)
  applyModal.show = false
  alert('申请提交成功')
}

async function handleCreateBorrow(data: any) {
  await createBorrow(data)
  borrowModalShow.value = false
  alert('临时借用记录已保存')
}

function openDetail(adj: any) {
  selectedAdj.value = adj
}

async function handleApprove(id: string) {
  await approveAdjustment(id)
  selectedAdj.value = (adjustments.value || []).find(a => a.id === id)
}

async function handleAllocate(id: string, room: any) {
  await allocateAdjustment(id, room)
  selectedAdj.value = (adjustments.value || []).find(a => a.id === id)
}

async function handleComplete(id: string) {
  await completeAdjustment(id)
  selectedAdj.value = (adjustments.value || []).find(a => a.id === id)
}

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
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}
.subtitle {
  color: #646a73;
  font-size: 14px;
  margin-top: 4px;
}
.headerActions {
  display: flex;
  gap: 12px;
}
.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.statCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 16px;
}
.statValue {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}
.statLabel {
  font-size: 12px;
  color: #646a73;
  margin-top: 4px;
}
.mainContent {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 16px;
  align-items: flex-start;
}
.card {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}
.cardHeader {
  padding: 16px;
  border-bottom: 1px solid #eef0f2;
}
.cardTitle {
  font-weight: 700;
  font-size: 16px;
}
.tableWrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th {
  text-align: left;
  padding: 12px 16px;
  background: #f8fafc;
  font-size: 13px;
  color: #646a73;
}
.table td {
  padding: 12px 16px;
  border-top: 1px solid #eef0f2;
  font-size: 14px;
}
.row:hover {
  background: #f9fafb;
}
.mono {
  font-family: monospace;
  color: #646a73;
}
.muted {
  color: #8f959e;
}
.right {
  text-align: right;
}
.link {
  color: #3370ff;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
