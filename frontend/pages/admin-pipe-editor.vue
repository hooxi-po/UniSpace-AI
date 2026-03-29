<template>
  <div class="pipe-editor-route">
    <Pipe2DEditorDialog
      :open="true"
      standalone
      :backend-base-url="backendBaseUrl"
      :initial-feature-id="initialFeatureId"
      @close="closeEditor"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Pipe2DEditorDialog from '~/components/admin/Pipe2DEditorDialog.vue'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'

definePageMeta({
  path: '/admin/pipe-editor',
})

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const closing = ref(false)

const backendBaseUrl = normalizeBackendBaseUrl(runtimeConfig.public.backendBaseUrl as string | undefined)

const initialFeatureId = computed(() => {
  const raw = route.query.featureId
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
})

function closeEditor() {
  if (closing.value) return
  closing.value = true
  if (typeof window !== 'undefined') {
    window.location.assign('/admin')
    return
  }
  void router.replace({ path: '/admin' }).finally(() => {
    closing.value = false
  })
}

function handleSaved(id: string) {
  const query = { ...route.query, featureId: id }
  void router.replace({ path: route.path, query })
}
</script>

<style scoped>
.pipe-editor-route {
  height: 100vh;
  min-height: 720px;
  padding: 12px;
  background: #f5f6f8;
  box-sizing: border-box;
}
</style>
