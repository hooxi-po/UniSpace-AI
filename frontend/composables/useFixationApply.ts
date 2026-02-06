import { computed, onMounted } from 'vue'
import type { ApplyProject } from '~/server/utils/fixation-apply-db'
import { fixationService } from '~/services/fixation'
import { useListFetcher } from '~/composables/shared/useListFetcher'

export function useFixationApply() {
  const {
    list,
    loading,
    error,
    fetchList,
    updateItem,
  } = useListFetcher<ApplyProject>(async () => {
    const res = await fixationService.fetchApplyList()
    return res.list
  }, { immediate: false })

  const projects = computed(() => list.value)

  async function fetchProjects() {
    return fetchList()
  }

  async function patchProject(projectId: string, updates: Record<string, any>) {
    const res = await fixationService.patchApplyProject(projectId, updates)
    updateItem(projectId, res.project)
    return res.project
  }

  onMounted(() => {
    fetchProjects()
  })

  return {
    projects,
    loading,
    error,
    fetchProjects,
    patchProject,
  }
}
