<template>
  <div :class="['relative bg-black/80 backdrop-blur-md border border-white/20 shadow-2xl', className]">
    <!-- Corner Decorations -->
    <div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-tech-cyan" />
    <div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-tech-cyan" />
    <div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-tech-cyan" />
    <div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-tech-cyan" />

    <!-- Title Bar -->
    <div v-if="title" class="border-b border-white/10 px-4 py-2 bg-gradient-to-r from-tech-blue/10 to-transparent">
      <h3 class="text-xs font-mono text-tech-cyan uppercase tracking-wider">{{ title }}</h3>
    </div>

    <!-- Content -->
    <div class="p-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  className?: string
}

withDefaults(defineProps<Props>(), {
  title: '',
  className: ''
})
</script>
