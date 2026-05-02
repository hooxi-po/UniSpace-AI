import type { OperatingBidItem } from '~/types/operating-bidding'

export type GetBidsResp = {
  source: 'mock' | 'backend'
  spaceId: string
  bids: OperatingBidItem[]
}

export type CreateBidBody = {
  spaceId: string
  company: string
  contactPerson: string
  contactPhone?: string
  amount: number
}

export type CreateBidResp = {
  source: 'mock' | 'backend'
  bid: OperatingBidItem
}

/**
 * 获取指定房源的竞标列表
 *
 * 后端对接预留：将此处替换为真实接口（例如 /api/v1/operating/spaces/{id}/bids ）
 */
export async function getOperatingBids(spaceId: string) {
  return await $fetch<GetBidsResp>('/api/operating/bids', {
    query: { spaceId },
  })
}

/**
 * 提交竞标
 *
 * 后端对接预留：将此处替换为真实接口（例如 POST /api/v1/operating/bidding ）
 */
export async function createOperatingBid(body: CreateBidBody) {
  return await $fetch<CreateBidResp>('/api/operating/bidding', {
    method: 'POST',
    body,
  })
}

