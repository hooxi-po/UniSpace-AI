<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div v-if="visible" class="shortcut-help-mask" @click="emit('close')">
    <section class="shortcut-help" @click.stop>
      <header class="shortcut-help__head">
        <strong>快捷键</strong>
        <button class="icon-btn" type="button" @click="emit('close')">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <ul class="shortcut-help__list">
        <li><span>V</span><em>选择工具</em></li>
        <li><span>N</span><em>添加节点</em></li>
        <li><span>P</span><em>添加管线</em></li>
        <li><span>Space</span><em>临时切回选择</em></li>
        <li><span>Ctrl/Cmd + Z</span><em>撤销</em></li>
        <li><span>Ctrl + Y</span><em>重做</em></li>
        <li><span>Delete</span><em>删除当前点</em></li>
        <li><span>?</span><em>打开帮助</em></li>
      </ul>
    </section>
  </div>
</template>

<style scoped src="../Pipe2DEditorDialog.css"></style>
