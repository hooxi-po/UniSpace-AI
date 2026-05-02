import { readonly, ref } from 'vue'

export interface UseAsyncStateOptions<T> {
  initialData?: T
  immediate?: boolean
}

export function useAsyncState<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncStateOptions<T> = {}
) {
  const { initialData, immediate = true } = options

  const data = ref<T | undefined>(initialData)
  const loading = ref(false)
  const error = ref<string>()

  async function execute() {
    loading.value = true
    error.value = undefined
    try {
      const result = await asyncFn()
      data.value = result
      return result
    } catch (e: any) {
      error.value = e.message || '请求失败'
      console.error(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  if (immediate) {
    execute()
  }

  return {
    data: readonly(data),
    loading: readonly(loading),
    error: readonly(error),
    execute,
  }
}
