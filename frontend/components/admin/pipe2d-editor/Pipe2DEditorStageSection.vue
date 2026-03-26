<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
type Message = {
  type: 'ok' | 'error'
  text: string
}

type HoverLengthHint = {
  visible: boolean
  x: number
  y: number
  text: string
}

type ContextMenuState = {
  visible: boolean
  x: number
  y: number
  canInsert: boolean
  canDelete: boolean
}

const props = defineProps<{
  sectionClass: unknown
  canvasClass: unknown
  toolbarDragActive: boolean
  toolbarDragOverCanvas: boolean
  toolbarDragLabel: string
  activeToolHint: string
  loading: boolean
  loadError: string | null
  selectedFeatureExists: boolean
  mapError: string | null
  snapHintVisible: boolean
  hoverLengthHint: HoverLengthHint
  saveSuccessVisible: boolean
  actionMessage: Message | null
  saving: boolean
  zoomLevel: number
  zoomPercentText: string
  draftRestoredToastVisible: boolean
  contextMenu: ContextMenuState
}>()

const emit = defineEmits<{
  (e: 'set-map-container', el: HTMLDivElement | null): void
  (e: 'stage-pointerdown'): void
  (e: 'import-template'): void
  (e: 'zoom-out'): void
  (e: 'zoom-in'): void
  (e: 'zoom-change', zoom: number): void
  (e: 'zoom-reset'): void
  (e: 'menu-insert'): void
  (e: 'menu-delete'): void
  (e: 'menu-copy'): void
  (e: 'menu-bind-asset'): void
  (e: 'menu-trace'): void
}>()

function bindMapContainer(target: Element | ComponentPublicInstance | null) {
  emit('set-map-container', target instanceof HTMLDivElement ? target : null)
}

function onZoomSliderInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('zoom-change', value)
}
</script>

<template>
  <section :class="sectionClass" @pointerdown="emit('stage-pointerdown')">
    <div :ref="bindMapContainer" :class="canvasClass" @contextmenu.prevent />

    <div
      v-if="toolbarDragActive"
      :class="['drop-guide', toolbarDragOverCanvas ? 'drop-guide--active' : '']"
    >
      {{ toolbarDragOverCanvas ? `释放以放置 ${toolbarDragLabel}` : `拖拽 ${toolbarDragLabel} 到画布放置` }}
    </div>

    <div v-if="activeToolHint" class="canvas-hint">{{ activeToolHint }}</div>
    <div v-if="loading" class="state-overlay">加载管道中...</div>
    <div v-else-if="loadError" class="state-overlay state-overlay--error">{{ loadError }}</div>

    <div v-if="!loading && !loadError && !selectedFeatureExists" class="empty-state">
      <div class="empty-state__title">从左侧工具开始编辑</div>
      <div class="empty-state__sub">支持拖拽工具到画布快速放置，也可直接点选工具后点击地图</div>
      <button class="btn" type="button" @click="emit('import-template')">导入示例模板</button>
    </div>

    <div v-if="mapError" class="state-overlay state-overlay--error state-overlay--bottom">{{ mapError }}</div>
    <div v-if="snapHintVisible" class="snap-toast">已吸附到邻近端点</div>

    <div
      v-if="hoverLengthHint.visible"
      class="hover-length"
      :style="{ left: `${hoverLengthHint.x}px`, top: `${hoverLengthHint.y}px` }"
    >
      {{ hoverLengthHint.text }}
    </div>

    <div v-if="saveSuccessVisible" class="save-success">保存成功</div>

    <div
      v-if="actionMessage"
      :class="['action-toast', actionMessage.type === 'error' ? 'action-toast--error' : 'action-toast--ok']"
    >
      {{ actionMessage.text }}
    </div>

    <div class="zoom-control">
      <button class="zoom-control__btn" type="button" :disabled="saving" @click="emit('zoom-out')">-</button>
      <input
        class="zoom-control__slider"
        type="range"
        min="14"
        max="20"
        step="1"
        :value="zoomLevel"
        @input="onZoomSliderInput"
      >
      <button class="zoom-control__btn" type="button" :disabled="saving" @click="emit('zoom-in')">+</button>
      <button class="zoom-control__reset" type="button" :disabled="saving" @click="emit('zoom-reset')">100%</button>
      <span class="zoom-control__value">{{ zoomPercentText }}</span>
    </div>

    <div v-if="draftRestoredToastVisible" class="draft-toast">已恢复本地草稿</div>

    <ul
      v-if="contextMenu.visible"
      class="stage-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @pointerdown.stop
    >
      <li><button class="stage-menu__item" type="button" :disabled="!contextMenu.canInsert" @click="emit('menu-insert')">插入点</button></li>
      <li><button class="stage-menu__item" type="button" :disabled="!contextMenu.canDelete" @click="emit('menu-delete')">删除</button></li>
      <li><button class="stage-menu__item" type="button" @click="emit('menu-copy')">复制</button></li>
      <li><button class="stage-menu__item" type="button" @click="emit('menu-bind-asset')">绑定房产</button></li>
      <li><button class="stage-menu__item" type="button" @click="emit('menu-trace')">查看链路</button></li>
    </ul>
  </section>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
