<script setup lang="ts">
import { Loader2, RefreshCw, RotateCcw, Search, Send, X, Zap } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type ViewModeOption = {
  key: string
  label: string
}

type PipeFeature = {
  id: string | number
  properties?: Record<string, unknown>
}

const props = defineProps<{
  projectTitle: string
  editingProjectTitle: boolean
  projectTitleDraft: string
  saveStatusClass: string
  saveStatusText: string
  saving: boolean
  isDirty: boolean
  selectedFeature: unknown
  canUndo: boolean
  canRedo: boolean
  snapEnabled: boolean
  sceneMode: string
  viewMode: string
  viewModeOptions: ViewModeOption[]
  pipes: PipeFeature[]
  selectedFeatureId: string
}>()

const emit = defineEmits<{
  (e: 'start-edit-project-title'): void
  (e: 'update:projectTitleDraft', value: string): void
  (e: 'commit-project-title'): void
  (e: 'cancel-project-title'): void
  (e: 'change-view-mode', value: string): void
  (e: 'ai'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'toggle-snap'): void
  (e: 'toggle-scene-mode'): void
  (e: 'beautify'): void
  (e: 'share'): void
  (e: 'validate-topology'): void
  (e: 'save-geometry'): void
  (e: 'search-select', id: string): void
  (e: 'close'): void
}>()

const searchRef = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const searchOpen = ref(false)
const highlightedIndex = ref(-1)

function onViewChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('change-view-mode', value)
}

function pipeOptionLabel(feature: PipeFeature) {
  const properties = feature.properties || {}
  const name = String(properties.name || properties.ref || feature.id)
  return `${String(feature.id)} · ${name}`
}

function collectPipeSearchText(feature: PipeFeature) {
  const properties = feature.properties || {}
  const buildingValues = [
    properties.building,
    properties.buildingName,
    properties.buildingNames,
    properties.linkedBuilding,
    properties.linkedBuildingName,
    properties.linkedBuildings,
    properties.linkedBuildingLabels,
    properties.campus,
    properties.address,
  ]

  const textParts = [
    feature.id,
    properties.name,
    properties.ref,
    ...buildingValues.flatMap((value) => Array.isArray(value) ? value : [value]),
  ]

  return textParts
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
}

const filteredPipes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.pipes.slice(0, 50)
  return props.pipes
    .filter(pipe => collectPipeSearchText(pipe).includes(query))
    .slice(0, 50)
})

function openSearch() {
  searchOpen.value = true
  highlightedIndex.value = -1
}

function closeSearch() {
  searchOpen.value = false
}

function selectPipe(id: string) {
  emit('search-select', id)
  searchQuery.value = ''
  closeSearch()
}

function onSearchInput() {
  openSearch()
}

function onSearchKeydown(event: KeyboardEvent) {
  const list = filteredPipes.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openSearch()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, list.length - 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    if (highlightedIndex.value >= 0 && highlightedIndex.value < list.length) {
      selectPipe(String(list[highlightedIndex.value].id))
    }
    return
  }

  if (event.key === 'Escape') {
    closeSearch()
  }
}

function onClickOutside(event: MouseEvent) {
  if (searchRef.value && !searchRef.value.contains(event.target as Node)) {
    closeSearch()
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <div class="project-group">
        <button
          v-if="!editingProjectTitle"
          class="project-name-btn"
          type="button"
          @click="emit('start-edit-project-title')"
        >
          {{ projectTitle }}
        </button>
        <input
          v-else
          :value="projectTitleDraft"
          class="project-name-input"
          maxlength="48"
          autofocus
          @input="emit('update:projectTitleDraft', ($event.target as HTMLInputElement).value)"
          @blur="emit('commit-project-title')"
          @keydown.enter.prevent="emit('commit-project-title')"
          @keydown.esc.prevent="emit('cancel-project-title')"
        >
        <div :class="['save-chip', saveStatusClass]">
          <Loader2 v-if="saving" :size="14" class="spin" />
          <span v-else class="save-dot" />
          <span>{{ saveStatusText }}</span>
        </div>
      </div>
    </div>

    <div class="topbar__main">
      <div class="topbar__center">
        <label class="select-wrap">
          <span>视图</span>
          <select class="view-select" :value="viewMode" @change="onViewChange">
            <option v-for="item in viewModeOptions" :key="item.key" :value="item.key">
              {{ item.label }}
            </option>
          </select>
        </label>
        <div ref="searchRef" class="topbar-search">
          <Search :size="15" class="topbar-search__icon" />
          <input
            v-model="searchQuery"
            class="topbar-search__input"
            type="text"
            placeholder="搜索管线 ID / 名称 / 楼宇"
            :disabled="!pipes.length"
            autocomplete="off"
            @focus="openSearch"
            @input="onSearchInput"
            @keydown="onSearchKeydown"
          >
          <ul v-show="searchOpen && filteredPipes.length" class="topbar-search__dropdown">
            <li
              v-for="(item, index) in filteredPipes"
              :key="String(item.id)"
              class="topbar-search__item"
              :class="{
                'topbar-search__item--active': String(item.id) === selectedFeatureId,
                'topbar-search__item--highlight': index === highlightedIndex,
              }"
            >
              <button class="topbar-search__btn" type="button" @click="selectPipe(String(item.id))">
                {{ pipeOptionLabel(item) }}
              </button>
            </li>
          </ul>
          <div v-if="searchOpen && searchQuery.trim() && !filteredPipes.length" class="topbar-search__empty">
            未找到匹配管线
          </div>
        </div>
        <button class="btn btn--ai" type="button" @click="emit('ai')">
          <span class="btn--ai__spark">✦</span>
          <span class="btn--ai__text">AI 助手</span>
        </button>
      </div>

      <div class="topbar__right">
        <button class="icon-btn" type="button" :disabled="saving || !canUndo" title="撤销 (Ctrl/Cmd+Z)" @click="emit('undo')">
          <RotateCcw :size="18" />
        </button>
        <button class="icon-btn" type="button" :disabled="saving || !canRedo" title="重做 (Ctrl/Cmd+Y)" @click="emit('redo')">
          <RefreshCw :size="18" />
        </button>
        <button
          class="btn btn--sm"
          type="button"
          :disabled="saving"
          :title="snapEnabled ? '关闭吸附' : '开启吸附'"
          @click="emit('toggle-snap')"
        >
          {{ snapEnabled ? '吸附: 开' : '吸附: 关' }}
        </button>
        <button
          class="btn btn--sm"
          type="button"
          :disabled="saving"
          title="切换 2D / 3D"
          @click="emit('toggle-scene-mode')"
        >
          {{ sceneMode === '3d' ? '切换至2D' : '切换至3D' }}
        </button>
        <button class="icon-btn" type="button" title="一键美化布局" @click="emit('beautify')">
          <Zap :size="18" />
        </button>
        <button class="icon-btn" type="button" title="分享" @click="emit('share')">
          <Send :size="18" />
        </button>
        <button
          class="btn btn--sm"
          type="button"
          :disabled="saving || !selectedFeature"
          title="校验孤立节点、自环和重复边"
          @click="emit('validate-topology')"
        >
          校验拓扑
        </button>
        <button
          class="btn btn--primary btn--save"
          type="button"
          :disabled="!selectedFeature || !isDirty || saving"
          @click="emit('save-geometry')"
        >
          {{ saving ? '保存中...' : '保存修改' }}
        </button>
        <button
          class="icon-btn icon-btn--close"
          type="button"
          title="关闭"
          @pointerdown.stop.prevent="emit('close')"
          @click.stop.prevent="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
