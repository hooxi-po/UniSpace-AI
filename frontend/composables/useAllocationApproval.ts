import { computed, onMounted, ref } from 'vue'
import type { AllocationRequest } from '~/server/utils/allocation-db'
import { allocationService } from '~/services/allocation'
import { fixationService } from '~/services/fixation'
import { useListFetcher } from '~/composables/shared/useListFetcher'

export function useAllocationApproval() {
  const {
    list,
    loading,
    error,
    fetchList,
    updateItem,
    prependItem,
  } = useListFetcher<AllocationRequest>(async () => {
    const res = await allocationService.fetchRequests()
    // useListFetcher 会把 list 以 readonly 返回；这里把数据深拷贝成可变结构，避免 vue-tsc 的 readonly 不兼容
    return (structuredClone ? structuredClone(res.list) : JSON.parse(JSON.stringify(res.list))) as AllocationRequest[]
  }, { immediate: false })

  const requests = computed(() => list.value)

  const roomStockLoading = ref(false)
  const roomStockError = ref<unknown>(null)
  const stockRooms = ref<any[]>([])

  async function fetchRoomStock() {
    roomStockLoading.value = true
    roomStockError.value = null
    try {
      const res = await fixationService.fetchStock()
      stockRooms.value = (res.rooms || []) as any[]
      return stockRooms.value
    } catch (e) {
      roomStockError.value = e
      throw e
    } finally {
      roomStockLoading.value = false
    }
  }

  function getApprovalLevel(area: number) {
    return area >= 0 ? 1 : 1
  }

  function getStatusLabel(st: AllocationRequest['status']) {
    switch (st) {
      case 'Pending':
        return '待审批'
      case 'Approved':
        return '待配房'
      case 'Allocated':
        return '已配房'
      case 'Completed':
        return '已完成'
      case 'Rejected':
        return '已驳回'
      default:
        return String(st)
    }
  }

  function getUseTypeLabel(t: AllocationRequest['useType']) {
    switch (t) {
      case 'Office':
        return '行政办公'
      case 'Teaching':
        return '教学用房'
      case 'Lab':
        return '科研实验室'
      case 'Student':
        return '学生用房'
      case 'Meeting':
        return '会议室'
      case 'Storage':
        return '库房'
      default:
        return '其他'
    }
  }

  function getStatusColorClass(st: AllocationRequest['status']) {
    switch (st) {
      case 'Pending':
        return 'tag tagAmber'
      case 'Approved':
        return 'tag tagBlue'
      case 'Allocated':
      case 'Completed':
        return 'tag tagGreen'
      case 'Rejected':
        return 'tag tagGray'
      default:
        return 'tag'
    }
  }

  async function approve(req: AllocationRequest) {
    const newRecord = {
      id: `APR-${Date.now()}`,
      approverRole: '审批人',
      approverName: '当前用户',
      action: 'Approve' as const,
      comment: '同意',
      timestamp: new Date().toISOString(),
    }

    const updates: Partial<AllocationRequest> = {
      status: 'Approved',
      approvalRecords: [...(req.approvalRecords || []), newRecord],
    }

    const res = await allocationService.patchRequest(req.id, updates, `用房审批：通过（${req.department} / ${req.id}）`)
    updateItem(req.id, res.request)
    return res.request
  }

  async function reject(req: AllocationRequest, reason: string) {
    const newRecord = {
      id: `APR-${Date.now()}`,
      approverRole: '审批人',
      approverName: '当前用户',
      action: 'Reject' as const,
      comment: reason,
      timestamp: new Date().toISOString(),
    }

    const updates: Partial<AllocationRequest> = {
      status: 'Rejected',
      approvalRecords: [...(req.approvalRecords || []), newRecord],
    }

    const res = await allocationService.patchRequest(req.id, updates, `用房审批：驳回（${req.department} / ${req.id}）`)
    updateItem(req.id, res.request)
    return res.request
  }

  async function createRequest(data: Omit<AllocationRequest, 'id' | 'requestedDate' | 'status' | 'approvalRecords'>) {
    const res = await allocationService.createRequest({
      ...data,
      approvalRecords: [{
        id: `APR-${Date.now()}`,
        approverRole: '申请人',
        approverName: data.applicant,
        action: 'Submit' as const,
        comment: '提交申请',
        timestamp: new Date().toISOString(),
      }]
    })
    prependItem(res.request)
    return res.request
  }

  async function allocateRooms(req: AllocationRequest, roomIds: string[]) {
    const res = await allocationService.patchRequest(req.id, {
      status: 'Allocated',
      allocatedRooms: roomIds
    }, `用房审批：分配房间（${req.department} / ${req.id}），共 ${roomIds.length} 间`)
    updateItem(req.id, res.request)
    return res.request
  }

  async function fetchRequests() {
    return fetchList()
  }

  onMounted(() => {
    fetchRequests()
    fetchRoomStock()
  })

  return {
    requests,
    loading,
    error,
    fetchRequests,

    stockRooms,
    roomStockLoading,
    roomStockError,
    fetchRoomStock,

    approve,
    reject,
    createRequest,
    allocateRooms,

    getApprovalLevel,
    getStatusLabel,
    getUseTypeLabel,
    getStatusColorClass,
  }
}

