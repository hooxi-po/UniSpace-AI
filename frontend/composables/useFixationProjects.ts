import { computed, onMounted } from 'vue'
import type { FixationProject } from '~/server/utils/fixation-projects-db'
import { fixationService } from '~/services/fixation'
import { useListFetcher } from '~/composables/shared/useListFetcher'

export function useFixationProjects() {
  const {
    list,
    loading,
    error,
    fetchList,
    prependItem,
  } = useListFetcher<FixationProject>(async () => {
    const res = await fixationService.fetchProjects()
    return res.list
  }, { immediate: false })

  const projects = computed(() => list.value)

  async function fetchProjects() {
    return fetchList()
  }

  async function addProject(project: FixationProject) {
    const created = await fixationService.addProject(project)
    prependItem(created)
    return created
  }

  onMounted(() => {
    fetchProjects()
  })

  return {
    projects,
    loading,
    error,
    fetchProjects,
    addProject,
  }
}
