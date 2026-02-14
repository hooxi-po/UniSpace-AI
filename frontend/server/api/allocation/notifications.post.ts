import { addAllocationNotification, type AllocationNotification } from '~/server/utils/allocation-notifications-db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Omit<AllocationNotification, 'id' | 'at' | 'status'>>(event)
  
  const notification = await addAllocationNotification({
    ...body,
    id: `NTF-${Date.now()}`,
    at: new Date().toISOString(),
    status: 'Unread'
  })
  
  return { notification }
})

