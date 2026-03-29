<script setup lang="ts">
import { Loader2, RefreshCw, RotateCcw, Send, X, Zap } from 'lucide-vue-next'

type ViewModeOption = {
  key: string
  label: string
}

defineProps<{
  projectTitle: string
  editingProjectTitle: boolean
  projectTitleDraft: string
  saveStatusClass: string
  saveStatusText: string
  saving: boolean
  canUndo: boolean
  canRedo: boolean
  viewMode: string
  viewModeOptions: ViewModeOption[]
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
  (e: 'beautify'): void
  (e: 'share'): void
  (e: 'close'): void
}>()

function onViewChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('change-view-mode', value)
}
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
        <button class="icon-btn" type="button" title="一键美化布局" @click="emit('beautify')">
          <Zap :size="18" />
        </button>
        <button class="icon-btn" type="button" title="分享" @click="emit('share')">
          <Send :size="18" />
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
