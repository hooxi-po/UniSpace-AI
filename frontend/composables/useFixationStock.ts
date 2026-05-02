import { onMounted, ref } from 'vue'
import type { Building, Room } from '~/server/utils/fixation-stock-db'
import { fixationService } from '~/services/fixation'

export function useFixationStock() {
  const buildings = ref<Building[]>([])
  const rooms = ref<Room[]>([])
  const loading = ref(false)
  const error = ref<string>()

  async function fetchStock() {
    loading.value = true
    error.value = undefined
    try {
      const res = await fixationService.fetchStock()
      buildings.value = res.buildings
      rooms.value = res.rooms
    } catch (e: any) {
      error.value = e.message || '获取存量房产数据失败'
      console.error(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addBuildings(newBuildings: Building[]) {
    const res = await fixationService.addBuildings(newBuildings)
    buildings.value.unshift(...res.addedBuildings)
    return res.addedBuildings
  }

  async function addRooms(newRooms: Room[]) {
    const res = await fixationService.addRooms(newRooms)
    rooms.value.unshift(...res.addedRooms)
    return res.addedRooms
  }

  onMounted(() => {
    fetchStock()
  })

  return {
    buildings,
    rooms,
    loading,
    error,
    fetchStock,
    addBuildings,
    addRooms,
  }
}