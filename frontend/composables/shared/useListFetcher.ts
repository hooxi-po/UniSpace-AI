import { readonly, ref } from 'vue'

export interface UseListFetcherOptions<T> {
  initialData?: T[]
  immediate?: boolean
}

export function useListFetcher<T>(
  fetchFn: () => Promise<T[]>,
  options: UseListFetcherOptions<T> = {}
) {
  const { initialData = [], immediate = true } = options

  const list = ref<T[]>(initialData)
  const loading = ref(false)
  const error = ref<string>()

  async function fetchList() {
    loading.value = true
    error.value = undefined
    try {
      const result = await fetchFn()
      list.value = result
      return result
    } catch (e: any) {
      error.value = e.message || '获取列表失败'
      console.error(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function updateItem(id: string | number, updates: Partial<T>) {
    const index = list.value.findIndex((item: any) => item.id === id)
    if (index !== -1) {
      list.value[index] = { ...list.value[index], ...updates }
    }
  }

  function prependItem(item: T) {
    ;(list.value as T[]).unshift(item)
  }

  function removeItem(id: string | number) {
    list.value = list.value.filter((item: any) => item.id !== id)
  }

  function replaceList(newList: T[]) {
    list.value = newList
  }

  function setList(newList: T[]) {
    list.value = newList
  }

  if (immediate) {
    fetchList()
  }

  return {
    list: readonly(list),
    loading: readonly(loading),
    error: readonly(error),
    fetchList,
    updateItem,
    prependItem,
    removeItem,
    replaceList,
    setList,
  }
}
