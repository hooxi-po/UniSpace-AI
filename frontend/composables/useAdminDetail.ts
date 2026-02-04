import { ref } from 'vue'

export function useAdminDetail() {
  const detailOpen = ref(false)
  const detailObj = ref<unknown>(null)
  const detailType = ref('')

  function closeDetail() {
    detailOpen.value = false
    detailObj.value = null
    detailType.value = ''
  }

  function openAssetDetail(obj: unknown) {
    detailObj.value = obj
    detailType.value = detectType(obj)
    detailOpen.value = true
  }

  function openPropertyDetail(row: any) {
    detailObj.value = row
    detailType.value = 'property'
    detailOpen.value = true
  }

  function detectType(obj: unknown) {
    const o = obj as any
    if (!o) return 'unknown'
    if (typeof o.id === 'string' && typeof o.name === 'string') return 'building'
    if (typeof o.id === 'string' && typeof o.diameter === 'string') return 'pipeline'
    return 'unknown'
  }

  return {
    detailOpen,
    detailObj,
    detailType,
    closeDetail,
    openAssetDetail,
    openPropertyDetail,
  }
}

