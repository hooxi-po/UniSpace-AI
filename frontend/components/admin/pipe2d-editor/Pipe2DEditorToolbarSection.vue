<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

type ToolItem = {
  key: string
  icon: Component
  label: string
  tooltip: string
  shortcut: string
}

const props = defineProps<{
  activeToolLabel: string
  toolItems: ToolItem[]
  activeTool: string
  saving: boolean
}>()

const activeToolItem = computed(() => {
  return props.toolItems.find(tool => tool.key === props.activeTool) || null
})

const emit = defineEmits<{
  (e: 'pointerdown', toolKey: string, event: PointerEvent): void
  (e: 'select', toolKey: string): void
}>()
</script>

<template>
  <aside class="left-toolbar">
    <div class="tool-mode-hint">
      <div class="tool-mode-hint__main">
        <component :is="activeToolItem?.icon" :size="14" :stroke-width="2.2" />
        <span class="tool-mode-hint__label">{{ activeToolLabel }}</span>
      </div>
    </div>
    <button
      v-for="tool in toolItems"
      :key="tool.key"
      :class="['tool-btn', 'tool-item', { 'tool-btn--active': activeTool === tool.key, active: activeTool === tool.key }]"
      type="button"
      :disabled="saving"
      :title="`${tool.tooltip} (${tool.shortcut})`"
      @pointerdown="emit('pointerdown', tool.key, $event)"
      @click="emit('select', tool.key)"
    >
      <component :is="tool.icon" :size="20" :stroke-width="2" />
      <span class="tool-btn__bar" />
    </button>
  </aside>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
