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

<style scoped src="./AllocationApprovalView.css"></style>
