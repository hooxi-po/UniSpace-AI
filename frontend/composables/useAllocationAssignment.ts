import { computed, onMounted, ref } from 'vue'
import type { Room } from '~/server/utils/fixation-stock-db'
import { fixationService } from '~/services/fixation'
import { allocationService } from '~/services/allocation'
import { useListFetcher } from '~/composables/shared/useListFetcher'

export function useAllocationAssignment() {
  const {
    list,
    loading,
    error,
    fetchList,
    updateItem,
  } = useListFetcher<Room>(async () => {
    const res = await fixationService.fetchStock()
    return res.rooms || []
  }, { immediate: false })

  const rooms = computed(() => list.value)

  // 统计逻辑
  const stats = computed(() => {
    const all = list.value || []
    return {
      total: all.length,
      available: all.filter(r => r.status === 'Empty').length,
      availableArea: all.filter(r => r.status === 'Empty').reduce((acc, r) => acc + (r.area || 0), 0),
      occupied: all.filter(r => r.status === 'Occupied').length
    }
  })

  // 管理员主动分配房源
  async function activeAssign(payload: { 
    id: string; 
    updates: Partial<Room>; 
    notification: string; 
    assigneeType: string 
  }) {
    // 1. 更新房间台账状态（同步到转固台账）
    const res = await fixationService.updateRoom(payload.id, payload.updates)
    
    if (res.room) {
      updateItem(res.room.id, res.room)
      
      // 2. 写入分配通知记录（演示版）
      await allocationService.createNotification({
        from: '资产管理处',
        to: payload.updates.department,
        toType: payload.assigneeType,
        content: payload.notification,
        roomId: res.room.id,
        roomInfo: `${res.room.buildingName} ${res.room.roomNo}`
      })

      // 3. 记录到 allocation 专属日志（供“调整记录”展示）
      // 使用 $fetch 时显式指定 method 类型
      await $fetch('/api/allocation/logs', {
        method: 'POST' as any,
        body: {
          action: 'allocateRooms',
          department: payload.updates.department,
          summary: `管理员主动分配房源：${res.room.buildingName}${res.room.roomNo} 分配给 ${payload.updates.department}`,
          detail: {
            roomId: res.room.id,
            notification: payload.notification,
            assigneeType: payload.assigneeType
          }
        }
      })
    }
    return res.room
  }

  // 更新房间台账（基础更新）
  async function patchRoom(id: string, updates: Partial<Room>) {
    const res = await fixationService.updateRoom(id, updates)
    if (res.room) {
      updateItem(res.room.id, res.room)
    }
    return res.room
  }

  // 直接分配
  async function assignRoom(id: string, department: string) {
    return patchRoom(id, {
      status: 'Occupied',
      department
    })
  }

  onMounted(() => {
    fetchList()
  })

  return {
    rooms,
    loading,
    error,
    stats,
    fetchRooms: fetchList,
    patchRoom,
    assignRoom,
    activeAssign
  }
}

