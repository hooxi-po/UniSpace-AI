export type OperatingSpaceStatus = '公开招租' | '已出租'

export type OperatingPurpose = '商铺' | '办公室' | '培训中心' | '实验场地'

export type OperatingSpaceItem = {
  id: string
  name: string

  // 结构化信息（B 方案：新增/编辑必须完整同步）
  buildingName: string
  floor: string
  roomNumber: string
  purpose: OperatingPurpose

  area: number
  status: OperatingSpaceStatus
  monthlyRent: number
  bids: any[]
  description?: string
}

export type OperatingContractStatus = 'Active' | 'Expiring'

export type OperatingContractItem = {
  id: string
  contractNo: string
  spaceId: string
  spaceName: string
  tenant: string
  rentPerMonth: number
  startDate: string
  endDate: string
  status: OperatingContractStatus
}

export type OperatingBillStatus = 'Unpaid' | 'PartialPaid' | 'Paid' | 'Overdue'

export type OperatingRentBill = {
  id: string
  contractId: string
  spaceName: string
  tenant: string
  period: string
  rentAmount: number
  lateFee: number
  totalAmount: number
  status: OperatingBillStatus
  paidAmount: number

  // 催缴记录（Mock/后端对接预留）
  reminderCount: number
  lastReminderDate?: string

  // 缴费记录（Mock/后端对接预留）
  paidDate?: string
  paymentMethod?: string
  transactionNo?: string
}

type OperatingOverviewResp = {
  source: 'mock-derived' | 'backend'
  spaces: OperatingSpaceItem[]
  contracts: OperatingContractItem[]
  rentBills: OperatingRentBill[]
}

export async function getOperatingOverview() {
  return await $fetch<OperatingOverviewResp>('/api/operating/overview')
}

// ==================== 合同管理（Mock / 后端对接预留） ====================

export type GetOperatingContractsResp = {
  source: 'mock-derived' | 'backend'
  contracts: OperatingContractItem[]
}

export type UpsertOperatingContractBody = {
  id?: string
  contractNo: string
  spaceId: string
  tenant: string
  rentPerMonth: number
  startDate: string
  endDate: string
  status: OperatingContractStatus
}

export type UpsertOperatingContractResp = {
  source: 'mock' | 'backend'
  contract: OperatingContractItem
}

export type DeleteOperatingContractResp = {
  source: 'mock' | 'backend'
  id: string
}

/**
 * 获取合同列表
 * 后端对接预留：可替换为 GET /api/v1/operating/contracts
 */
export async function getOperatingContracts() {
  return await $fetch<GetOperatingContractsResp>('/api/operating/contracts')
}

/**
 * 新增/编辑合同
 * 后端对接预留：可替换为 POST/PUT /api/v1/operating/contracts
 */
export async function upsertOperatingContract(body: UpsertOperatingContractBody) {
  return await $fetch<UpsertOperatingContractResp>('/api/operating/contracts', {
    method: 'POST',
    body,
  })
}

/**
 * 删除合同
 * 后端对接预留：可替换为 DELETE /api/v1/operating/contracts/{id}
 */
export async function deleteOperatingContract(id: string) {
  return await $fetch<DeleteOperatingContractResp>('/api/operating/contracts', {
    method: 'DELETE',
    query: { id },
  })
}

// ==================== 租金管理（Mock / 后端对接预留） ====================

export type RemindRentBillResp = {
  source: 'mock' | 'backend'
  bill: OperatingRentBill
}

export type PayRentBillBody = {
  billId: string
  amount: number
  method: string
  transactionNo: string
}

export type PayRentBillResp = {
  source: 'mock' | 'backend'
  bill: OperatingRentBill
}

/**
 * 催缴账单
 */
export async function remindRentBill(billId: string) {
  return await $fetch<RemindRentBillResp>('/api/operating/rent/remind', {
    method: 'POST',
    body: { billId },
  })
}

/**
 * 登记缴费
 */
export async function payRentBill(body: PayRentBillBody) {
  return await $fetch<PayRentBillResp>('/api/operating/rent/pay', {
    method: 'POST',
    body,
  })
}

// ==================== 数据分析（Mock / 后端对接预留） ====================

export type RentTrendItem = {
  month: string
  receivable: number
  paid: number
}

export type CollectionRateItem = {
  contractId: string
  tenant: string
  rate: number
}

export type TenantRankingItem = {
  id: string
  tenant: string
  spaceName: string
  totalReceived: number
  outstanding: number
  rating: number
}

export type OperatingAnalyticsResp = {
  source: 'mock-derived' | 'backend'
  rentTrend: RentTrendItem[]
  collectionRates: CollectionRateItem[]
  tenantRankings: TenantRankingItem[]
}

/**
 * 获取经营分析数据
 */
export async function getOperatingAnalytics() {
  // 当前 mock 逻辑：由于数据源分布在多个页面，统一由 composable 在前端计算或调用概览派生
  // 后端对接预留：可替换为 GET /api/v1/operating/analytics
  const resp = await getOperatingOverview()
  
  // 这里仅作为接口形态定义，实际逻辑目前在 useOperatingOverview composable 中复用
  return {
    source: resp.source,
    // 实际字段由业务逻辑填充
  } as any as OperatingAnalyticsResp
}
