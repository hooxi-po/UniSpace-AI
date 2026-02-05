import type { Building, Room } from '~/server/utils/fixation-stock-db'

export function useFixationStock() {
  const buildings = ref<Building[]>([])
  const rooms = ref<Room[]>([])
  const loading = ref(false)
  const error = ref<string>()

  async function fetchStock() {
    loading.value = true
    error.value = undefined
    try {
      const res = await $fetch<{ buildings: Building[]; rooms: Room[] }>('/api/fixation/stock')
      buildings.value = res.buildings
      rooms.value = res.rooms
    } catch (e: any) {
      error.value = e.message || '获取存量房产数据失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function addBuildings(newBuildings: Building[]) {
    loading.value = true
    error.value = undefined
    try {
      const res = await $fetch<{ addedBuildings: Building[] }>('/api/fixation/stock', {
        method: 'POST',
        body: { buildings: newBuildings },
      })
      buildings.value.unshift(...res.addedBuildings)
      return res.addedBuildings
    } catch (e: any) {
      error.value = e.message || '保存楼宇失败'
      console.error(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addRooms(newRooms: Room[]) {
    loading.value = true
    error.value = undefined
    try {
      const res = await $fetch<{ addedRooms: Room[] }>('/api/fixation/stock', {
        method: 'POST',
        body: { rooms: newRooms },
      })
      rooms.value.unshift(...res.addedRooms)
      return res.addedRooms
    } catch (e: any) {
      error.value = e.message || '保存房间失败'
      console.error(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchStock()
  })

  return {
    buildings: readonly(buildings),
    rooms: readonly(rooms),
    loading: readonly(loading),
    error: readonly(error),
    fetchStock,
    addBuildings,
    addRooms,
  }
}
