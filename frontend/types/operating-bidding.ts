export type OperatingBidStatus = 'Valid' | 'Winner'

export type OperatingBidItem = {
  id: string
  spaceId: string
  company: string
  contactPerson: string
  contactPhone?: string
  amount: number
  bidDate: string
  status: OperatingBidStatus
}

