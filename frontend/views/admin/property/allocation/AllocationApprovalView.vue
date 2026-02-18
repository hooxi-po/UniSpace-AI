<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">用房审批</h2>
        <p class="subtitle">处理下层提交的用房申请。审批通过后进入“待配房”状态进行房源分配。</p>
      </div>
      <div class="headerActions">
        <button class="btnGhost" @click="fetchRequests">
          <RefreshCw :size="14" :class="{ spinning: loading }" /> 刷新
        </button>
      </div>
    </div>

    <div class="stats">
      <div class="statCard">
        <div class="statValue">{{ pendingCount }}</div>
        <div class="statLabel">待审批申请</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ approvedCount }}</div>
        <div class="statLabel">待配房项目</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ stockRoomsCount }}</div>
        <div class="statLabel">可选房源总数</div>
      </div>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索申请编号/部门/用途/理由..." />
      </div>

      <select v-model="statusFilter" class="select">
        <option value="all">全部状态</option>
        <option value="Pending">待审批</option>
        <option value="Approved">待配房</option>
        <option value="Allocated">已配房</option>
        <option value="Completed">已完成</option>
        <option value="Rejected">已驳回</option>
      </select>
    </div>

    <div class="tableCard">
      <div v-if="loading" class="loadingState">
        <RefreshCw :size="24" class="spinning" />
        <span>加载中...</span>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>申请编号</th>
            <th>申请部门</th>
            <th>申请人</th>
            <th>申请面积</th>
            <th>用途</th>
            <th>紧急</th>
            <th>状态</th>
            <th>申请日期</th>
            <th class="right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id" class="row">
            <td class="mono">{{ r.id }}</td>
            <td>{{ r.department }}</td>
            <td>{{ r.applicant }}</td>
            <td>{{ r.area }} m²</td>
            <td>{{ getUseTypeLabel(r.useType) }}</td>
            <td>
              <span :class="['badge', r.urgency === 'Urgent' ? 'badgeUrgent' : 'badgeNormal']">
                {{ r.urgency === 'Urgent' ? '加急' : '普通' }}
              </span>
            </td>
            <td>
              <span :class="getStatusColorClass(r.status)">{{ getStatusLabel(r.status) }}</span>
            </td>
            <td class="muted">{{ r.requestedDate }}</td>
            <td class="right">
              <div class="ops">
                <button class="link" @click="openDetail(r)">
                  <Eye :size="14" /> 详情
                </button>

                <!-- 审批动作 -->
                <button
                  v-if="r.status === 'Pending'"
                  class="btnOk"
                  @click="onApprove(r)"
                >
                  <CheckCircle2 :size="14" /> 通过
                </button>

                <button
                  v-if="r.status === 'Pending'"
                  class="btnDanger"
                  @click="openReject(r)"
                >
                  <XCircle :size="14" /> 驳回
                </button>

                <!-- 配房动作 -->
                <button
                  v-if="r.status === 'Approved'"
                  class="link"
                  @click="openAllocate(r)"
                >
                  <MapPin :size="14" /><span>分配房间</span>
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="filtered.length === 0">
            <td class="empty" colspan="9">暂无符合条件的申请</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ApplyHousingRequestModal
      v-if="applying"
      :form="applyForm"
      @close="closeApply"
      @submit="onApply"
    />

    <AllocateRoomsModal
      v-if="allocating"
      :request="allocating"
      :stock-rooms="stockRooms"
      :loading="roomStockLoading"
      @close="closeAllocate"
      @submit="onAllocate"
    />

    <AllocationRequestDetailModal
      v-if="detail"
      :request="detail"
      :stock-rooms="stockRooms"
      :get-status-label="getStatusLabel"
      :get-use-type-label="getUseTypeLabel"
      :get-status-color-class="getStatusColorClass"
      @close="detail = null"
    />

    <RejectHousingRequestModal
      v-if="rejecting"
      :request="rejecting"
      :reason="rejectReason"
      @close="closeReject"
      @submit="onReject"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { CheckCircle2, Eye, MapPin, RefreshCw, Search, XCircle } from 'lucide-vue-next'
import type { AllocationRequest } from '~/server/utils/allocation-db'
import { useAllocationApproval } from '~/composables/useAllocationApproval'
import ApplyHousingRequestModal from '~/components/admin/property/allocation/components/ApplyHousingRequestModal.vue'
import AllocateRoomsModal from '~/components/admin/property/allocation/components/AllocateRoomsModal.vue'
import AllocationRequestDetailModal from '~/components/admin/property/allocation/components/AllocationRequestDetailModal.vue'
import RejectHousingRequestModal from '~/components/admin/property/allocation/components/RejectHousingRequestModal.vue'

const {
  requests,
  loading,
  fetchRequests,

  stockRooms,
  roomStockLoading,

  approve,
  reject,
  createRequest,
  allocateRooms,

  getStatusLabel,
  getUseTypeLabel,
  getStatusColorClass,
} = useAllocationApproval()

const searchTerm = ref('')
const statusFilter = ref<'all' | AllocationRequest['status']>('all')

const detail = ref<AllocationRequest | null>(null)
const rejecting = ref<AllocationRequest | null>(null)
const rejectReason = ref('')

const filtered = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  const list = (requests.value || []) as unknown as AllocationRequest[]

  let result = list
  if (statusFilter.value !== 'all') {
    result = result.filter(r => r.status === statusFilter.value)
  }

  if (!q) return result

  return result.filter(r => {
    return (
      r.id.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      getUseTypeLabel(r.useType).toLowerCase().includes(q)
    )
  })
})

const pendingCount = computed(() => ((requests.value || []) as unknown as AllocationRequest[]).filter(r => isPending(r)).length)
const approvedCount = computed(() => ((requests.value || []) as unknown as AllocationRequest[]).filter(r => r.status === 'Approved').length)
const stockRoomsCount = computed(() => (stockRooms.value || []).length)

function isPending(r: AllocationRequest) {
  return r.status === 'Pending'
}

function openDetail(r: AllocationRequest) {
  detail.value = r
}

// 申请用房相关
const applying = ref(false)
const applyForm = reactive({
  department: '',
  applicant: '',
  applicantId: '',
  applicantPhone: '',
  area: 0,
  useType: 'Office' as AllocationRequest['useType'],
  urgency: 'Normal' as AllocationRequest['urgency'],
  reason: ''
})



function closeApply() {
  applying.value = false
}

async function onApply() {
  await createRequest({ ...applyForm })
  closeApply()
}

// 分配房间相关
const allocating = ref<AllocationRequest | null>(null)
const selectedRooms = ref<string[]>([])


function openAllocate(r: AllocationRequest) {
  allocating.value = r
  selectedRooms.value = []
}

function closeAllocate() {
  allocating.value = null
  selectedRooms.value = []
}


async function onAllocate() {
  if (!allocating.value) return
  await allocateRooms(allocating.value, selectedRooms.value)
  closeAllocate()
}


async function onApprove(r: AllocationRequest) {
  await approve(r)
  if (detail.value?.id === r.id) {
    const next = ((requests.value || []) as unknown as AllocationRequest[]).find(x => x.id === r.id) || null
    detail.value = next
  }
}

function openReject(r: AllocationRequest) {
  rejecting.value = r
  rejectReason.value = ''
}

function closeReject() {
  rejecting.value = null
  rejectReason.value = ''
}

async function onReject() {
  if (!rejecting.value) return
  const r = rejecting.value
  await reject(r, rejectReason.value.trim())
  closeReject()

  if (detail.value?.id === r.id) {
    const next = ((requests.value || []) as unknown as AllocationRequest[]).find(x => x.id === r.id) || null
    detail.value = next
  }
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: #646a73;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.statCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
}

.statValue {
  font-size: 20px;
  font-weight: 800;
  color: #1f2329;
}

.statLabel {
  margin-top: 4px;
  font-size: 12px;
  color: #646a73;
}

.filterCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.searchBox {
  position: relative;
  flex: 1;
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
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px 10px 10px 34px;
  font-size: 13px;
}

.select {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px 10px;
  font-size: 13px;
  background: #fff;
}

.tableCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  position: relative;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table thead {
  background: #f8fafc;
  color: #646a73;
}

.table th,
.table td {
  padding: 12px 12px;
  border-bottom: 1px solid #eef0f2;
  text-align: left;
  vertical-align: middle;
}

.right {
  text-align: right;
}

.row:hover {
  background: #f8fafc;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: #646a73;
}

.muted {
  color: #8f959e;
}

.ops {
  display: inline-flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.link {
  border: none;
  background: transparent;
  color: #3370ff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnOk {
  border: 1px solid #22c55e;
  background: #22c55e;
  color: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnDanger {
  border: 1px solid #ef4444;
  background: #fff;
  color: #ef4444;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badgeUrgent {
  background: #fee2e2;
  color: #b91c1c;
}

.badgeNormal {
  background: #f1f5f9;
  color: #334155;
}

.tag {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
}

.tagAmber {
  background: #fef3c7;
  color: #92400e;
}

.tagOrange {
  background: #ffedd5;
  color: #9a3412;
}

.tagRed {
  background: #fee2e2;
  color: #b91c1c;
}

.tagBlue {
  background: #dbeafe;
  color: #1d4ed8;
}

.tagGreen {
  background: #dcfce7;
  color: #15803d;
}

.tagGray {
  background: #e5e7eb;
  color: #374151;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.loadingState {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

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

.modal.small {
  max-width: 560px;
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

.flowTitle {
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

.stockHint {
  margin-top: 10px;
  font-size: 13px;
  color: #646a73;
}

.textarea {
  width: 100%;
  min-height: 110px;
  border: 1px solid #dee0e3;
  border-radius: 10px;
  padding: 10px;
  margin-top: 8px;
  font-size: 13px;
}

.actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: 1fr;
  }
  .filterCard {
    flex-direction: column;
    align-items: stretch;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
