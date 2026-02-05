import type { AssetCategory, AssetSplitItem, Attachment, Project } from '~/server/utils/fixation-audit-db'

export function useFixationAudit() {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string>()

  async function fetchProjects() {
    loading.value = true
    error.value = undefined
    try {
      const res = await $fetch<{ list: Project[] }>('/api/fixation/audit')
      projects.value = res.list
    } catch (e: any) {
      error.value = e.message || '获取转固申请数据失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function patch(body: any) {
    const res = await $fetch<{ project: Project | null }>('/api/fixation/audit', {
      method: 'PATCH',
      body,
    })
    if (!res.project) throw new Error('Project not found')
    projects.value = projects.value.map(p => (p.id === res.project!.id ? res.project! : p))
    return res.project
  }

  async function updateStatus(projectId: string, status: Project['status']) {
    return patch({ op: 'updateProject', projectId, updates: { status } })
  }

  async function addAttachment(projectId: string, attachment: Attachment) {
    return patch({ op: 'addAttachment', projectId, attachment })
  }

  async function updateAttachment(projectId: string, attachmentId: string, attachmentUpdates: Partial<Attachment>) {
    return patch({ op: 'updateAttachment', projectId, attachmentId, attachmentUpdates })
  }

  async function deleteAttachment(projectId: string, attachmentId: string) {
    return patch({ op: 'deleteAttachment', projectId, attachmentId })
  }

  async function addSplitItem(projectId: string, splitItem: AssetSplitItem) {
    return patch({ op: 'addSplitItem', projectId, splitItem })
  }

  async function deleteSplitItem(projectId: string, splitItemId: string) {
    return patch({ op: 'deleteSplitItem', projectId, splitItemId })
  }

  function getAssetCategoryLabel(cat: AssetCategory) {
    switch (cat) {
      case 'Building':
        return '房屋建筑物'
      case 'Land':
        return '土地'
      case 'Structure':
        return '构筑物'
      case 'Equipment':
        return '设备'
      case 'Greening':
        return '绿化'
      default:
        return '其他'
    }
  }

  function getAssetStatusLabel(st: Project['status']) {
    switch (st) {
      case 'DisposalPending':
        return '待处置'
      case 'PendingReview':
        return '待审核'
      case 'PendingArchive':
        return '待归档'
      case 'Archived':
        return '已归档'
      default:
        return String(st)
    }
  }

  function getAssetStatusBadgeClass(st: Project['status']) {
    switch (st) {
      case 'DisposalPending':
        return 'badge badgePending'
      case 'PendingReview':
        return 'badge badgeReview'
      case 'PendingArchive':
        return 'badge badgeArchive'
      case 'Archived':
        return 'badge badgeDone'
      default:
        return 'badge'
    }
  }

  onMounted(() => {
    fetchProjects()
  })

  return {
    projects: readonly(projects),
    loading: readonly(loading),
    error: readonly(error),
    fetchProjects,
    updateStatus,
    addAttachment,
    updateAttachment,
    deleteAttachment,
    addSplitItem,
    deleteSplitItem,
    getAssetCategoryLabel,
    getAssetStatusLabel,
    getAssetStatusBadgeClass,
  }
}


