import type { Project } from '~/server/utils/fixation-projects-db'

export function useFixationProjects() {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string>()

  async function fetchProjects() {
    loading.value = true
    error.value = undefined
    try {
      const res = await $fetch<{ list: Project[] }>('/api/fixation/projects')
      projects.value = res.list
    } catch (e: any) {
      error.value = e.message || '获取工程项目失败'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function addProject(project: Project) {
    loading.value = true
    error.value = undefined
    try {
      const created = await $fetch<Project>('/api/fixation/projects', {
        method: 'POST',
        body: project,
      })
      projects.value.unshift(created)
      return created
    } catch (e: any) {
      error.value = e.message || '保存工程项目失败'
      console.error(e)
      throw e
    } finally {
      loading.value = false
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
    addProject,
  }
}

