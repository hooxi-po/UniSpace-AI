import { computed, ref } from 'vue'
import { getOperatingOverview, type OperatingSpaceItem } from '~/services/operating'

/**
 * 经营性房源数据（Mock / 后端对接入口）
 *
 * 说明：该 composable 只负责“房源列表”的读取与简单写操作。
 * - 数据来源：getOperatingOverview()（当前为 mock server api）
 * - 写操作：当前仅在前端内存层更新（不落库），便于页面功能演示；后续对接真实后端时可替换为 services。
 */
export function useOperatingProperties() {
  const spaces = ref<OperatingSpaceItem[]>([])
  const loading = ref(false)
  const error = ref('')

  async function reload() {
    loading.value = true
    error.value = ''
    try {
      const resp = await getOperatingOverview()
      spaces.value = Array.isArray(resp.spaces) ? resp.spaces : []
    } catch (e: any) {
      error.value = e?.statusMessage || e?.message || '加载房源失败'
      spaces.value = []
    } finally {
      loading.value = false
    }
  }

  // 初始化加载（Nuxt 下 composable 会在使用时执行）
  // 避免重复请求：仅当 spaces 为空且未在 loading 时触发
  if (spaces.value.length === 0 && !loading.value) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reload()
  }

  function addProperty(payload: Omit<OperatingSpaceItem, 'id' | 'bids'> & { bids?: OperatingSpaceItem['bids'] }) {
    const item: OperatingSpaceItem = {
      id: `space_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      bids: payload.bids ?? [],
      ...payload,
    }
    spaces.value = [item, ...spaces.value]
    return item
  }

  function updateProperty(
    id: string,
    patch: Partial<
      Pick<
        OperatingSpaceItem,
        'name' | 'buildingName' | 'floor' | 'roomNumber' | 'purpose' | 'area' | 'monthlyRent' | 'status' | 'description'
      >
    >
  ) {
    spaces.value = spaces.value.map((s) => (s.id === id ? { ...s, ...patch } : s))
  }

  const openForBiddingSpaces = computed(() => spaces.value.filter((s) => s.status === '公开招租'))

  return {
    spaces,
    loading,
    error,
    reload,
    addProperty,
    updateProperty,
    openForBiddingSpaces,
  }
}

