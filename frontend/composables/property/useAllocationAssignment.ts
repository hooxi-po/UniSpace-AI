import { computed, onMounted } from 'vue'
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
      occupied: all.filter(r => r.status === 'Occupied').length,
    }
  })

  // 管理员主动分配房源
  async function activeAssign(payload: {
    id: string;
    updates: Partial<Room>;
    notification: string;
    assigneeType: string
  }) {
    const res = await fixationService.updateRoom(payload.id, payload.updates)

    if (res.room) {
      updateItem(res.room.id, res.room)

      await allocationService.createNotification({
        from: '资产管理处',
        to: payload.updates.department,
        toType: payload.assigneeType,
        content: payload.notification,
        roomId: res.room.id,
        roomInfo: `${res.room.buildingName} ${res.room.roomNo}`,
      })

      await allocationService.createLog({
        action: 'allocateRooms',
        department: payload.updates.department,
        summary: `管理员主动分配房源：${res.room.buildingName}${res.room.roomNo} 分配给 ${payload.updates.department}`,
        detail: {
          roomId: res.room.id,
          notification: payload.notification,
          assigneeType: payload.assigneeType,
        },
      })
    }
    return res.room
  }

  async function patchRoom(id: string, updates: Partial<Room>) {
    const res = await fixationService.updateRoom(id, updates)
    if (res.room) {
      updateItem(res.room.id, res.room)
    }
    return res.room
  }

  async function assignRoom(id: string, department: string) {
    return patchRoom(id, {
      status: 'Occupied',
      department,
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
    activeAssign,
  }
}


