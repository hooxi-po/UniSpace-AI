import type { ApplyProject } from '~/server/utils/fixation-apply-db'

export function useFixationApply() {
  const projects = ref<ApplyProject[]>([])
  const loading = ref(false)
  const error = ref<string>()

  async function fetchProjects() {
    loading.value = true
    error.value = undefined
    try {
      const res = await $fetch<{ list: ApplyProject[] }>('/api/fixation/apply')
      projects.value = res.list
    } catch (e: any) {
      error.value = e.message || '获取转固申请列表失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function patchProject(projectId: string, updates: Record<string, any>) {
    const res = await $fetch<{ project: ApplyProject }>('/api/fixation/apply', {
      method: 'PATCH',
      body: { projectId, updates },
    })
    projects.value = projects.value.map(p => (p.id === res.project.id ? res.project : p))
    return res.project
  }

  onMounted(() => {
    fetchProjects()
  })

  return {
    projects: readonly(projects),
    loading: readonly(loading),
    error: readonly(error),
    fetchProjects,
    patchProject,
  }
}


