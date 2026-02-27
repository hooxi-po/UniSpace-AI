<template>
  <div class="page">
    <div class="pageHeader">
      <div>
        <h2 class="title">用房调整与借用</h2>
        <p class="subtitle">管理调整申请、临时借用与回收归还</p>
      </div>
      <div class="actions">
        <button class="btn" :disabled="adjustmentsLoading" @click="fetchAdjustments">
          <RefreshCw :size="16" :class="adjustmentsLoading ? 'spinning' : ''" />
          刷新
        </button>
        <button class="btn btn--primary" @click="showAdjustmentModal = true">
          <Plus :size="16" />
          新增调整申请
        </button>
      </div>
    </div>

    <div class="listCard">
      <div class="listTitle"><ArrowLeftRight :size="16" /> 调整申请</div>
      <table class="table">
        <thead>
          <tr>
            <th>申请部门</th>
            <th>原房间</th>
            <th>状态</th>
            <th>申请日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in adjustments" :key="it.id">
            <td>{{ it.department }}</td>
            <td>{{ it.fromBuildingName }}{{ it.fromRoomNo }}</td>
            <td>
              <span class="tag">{{ statusText(it.status) }}</span>
            </td>
            <td>{{ it.createdAt }}</td>
            <td class="rowActions">
              <button class="btn btn--mini" @click="openDetail(it)">
                <Eye :size="14" /> 查看
              </button>
              <button v-if="it.status === 'Pending'" class="btn btn--mini" @click="approve(it.id)">审批通过</button>
              <button v-if="it.status === 'Approved'" class="btn btn--mini" @click="allocate(it.id)">分配房间</button>
              <button v-if="it.status === 'Allocated'" class="btn btn--mini" @click="complete(it.id)">确认完成</button>
            </td>
          </tr>
          <tr v-if="adjustments.length === 0">
            <td colspan="5" class="empty">暂无调整申请</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="listCard">
      <div class="listTitle"><RotateCcw :size="16" /> 临时借用</div>
      <TemporaryBorrowList :borrows="borrows" :loading="borrowsLoading" />
      <div class="borrowActions">
        <button class="btn" @click="fetchBorrows">刷新借用列表</button>
        <button class="btn btn--primary" @click="showBorrowModal = true">新增临时借用</button>
      </div>
    </div>

    <AdjustmentRequestModal
      v-if="showAdjustmentModal"
      type="Exchange"
      :buildings="buildingOptions"
      @close="showAdjustmentModal = false"
      @submit="onCreateAdjustment"
    />

    <AdjustmentDetailModal
      v-if="detailItem"
      :request="detailItem"
      :stock-rooms="stockRooms"
      @close="detailItem = null"
      @approve="approve"
      @allocate="allocateFromModal"
      @complete="complete"
    />

    <TemporaryBorrowModal
      v-if="showBorrowModal"
      :buildings="buildingOptions"
      @close="showBorrowModal = false"
      @submit="onCreateBorrow"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight, RotateCcw, RefreshCw, Eye, Plus } from 'lucide-vue-next'
import { useAllocationAdjustment } from '~/composables/property/useAllocationAdjustment'
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
  fetchAdjustments,
  fetchBorrows,
} = useAllocationAdjustment()

const showAdjustmentModal = ref(false)
const showBorrowModal = ref(false)
const detailItem = ref<any>(null)

const buildingOptions = computed(() => {
  return [...new Set((stockRooms.value || []).map((r: any) => String(r.buildingName || '')).filter(Boolean))]
})

function statusText(status: string) {
  switch (status) {
    case 'Pending': return '待审批'
    case 'Approved': return '已审批'
    case 'Allocated': return '已分配'
    case 'Completed': return '已完成'
    default: return status
  }
}

function openDetail(item: any) {
  detailItem.value = item
}

async function onCreateAdjustment(payload: any) {
  await createAdjustment(payload)
  showAdjustmentModal.value = false
}

async function approve(id: string) {
  await approveAdjustment(id)
}

async function allocate(id: string) {
  const candidate = (stockRooms.value || []).find((r: any) => r.status === 'Empty')
  if (!candidate) {
    alert('暂无可分配空置房间')
    return
  }
  await allocateAdjustment(id, {
    buildingName: candidate.buildingName,
    roomNo: candidate.roomNo,
    area: Number(candidate.area || 0),
  })
}

async function allocateFromModal(id: string, room: any) {
  await allocateAdjustment(id, {
    buildingName: room.buildingName,
    roomNo: room.roomNo,
    area: Number(room.area || 0),
  })
}

async function complete(id: string) {
  await completeAdjustment(id)
}

async function onCreateBorrow(payload: any) {
  await createBorrow(payload)
  showBorrowModal.value = false
}
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.pageHeader { display: flex; justify-content: space-between; align-items: center; }
.title { margin: 0; font-size: 20px; font-weight: 800; }
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.actions { display: flex; gap: 8px; }

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 12px; background: #fff; cursor: pointer;
}
.btn--primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn--mini { padding: 4px 8px; font-size: 12px; }

.listCard { border: 1px solid var(--border); border-radius: 12px; background: #fff; padding: 12px; }
.listTitle { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }

.table { width: 100%; border-collapse: collapse; }
.table th, .table td { border-bottom: 1px solid var(--border-light); padding: 10px; text-align: left; font-size: 13px; }
.rowActions { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; }
.empty { color: var(--muted); text-align: center; }
.borrowActions { margin-top: 10px; display: flex; gap: 8px; justify-content: flex-end; }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
