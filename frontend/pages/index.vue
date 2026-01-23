<template>
  <div class="relative w-screen h-screen bg-tech-bg text-white overflow-hidden font-sans select-none">
    <!-- 1. Background / 3D Map Layer -->
    <MapView 
      :selected-id="selectedItem?.id || null"
      :viewport="viewport"
      :layers="layers"
      :weather-mode="weatherMode"
      @select="handleSelection"
      @update:viewport="viewport = $event"
    />

    <!-- 2. UI Overlay Layer -->
    <div class="absolute inset-0 pointer-events-none z-10">
      <!-- Header -->
      <TopNav />

      <!-- Left Panel: Data & Alerts -->
      <SidebarLeft />
      
      <!-- Map Controls (Bottom Center) -->
      <MapControls 
        :scale="viewport.scale"
        :layers="layers"
        :weather-mode="weatherMode"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @reset="resetView"
        @toggle-layer="toggleLayer"
        @toggle-weather="weatherMode = !weatherMode"
      />

      <!-- Right Panel: Detailed Asset Management -->
      <RightSidebar 
        :data="selectedItem" 
        @close="selectedItem = null" 
      />

      <!-- AI Chat (Floating) -->
      <div class="pointer-events-auto">
        <ChatInterface />
      </div>
    </div>

    <!-- 3. Vignette Overlay for cinematic feel -->
    <div class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,11,26,0.45)_100%)] z-20" />
    
    <!-- 4. Scanline effect -->
    <div class="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.08)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.008),rgba(0,0,255,0.02))] z-30 bg-[length:100%_2px,3px_100%] opacity-15" />
  </div>
</template>

<script setup lang="ts">
import type { PipeNode, Building } from '~/types'

const selectedItem = ref<PipeNode | Building | null>(null)

// Map Viewport State
const viewport = ref({ x: 119.1895, y: 26.0254, scale: 500 })

// Layer State
const layers = ref({
  water: true,
  sewage: true,
  drain: true,
  buildings: true,
})

// Weather State
const weatherMode = ref(false)

const handleSelection = (item: PipeNode | Building | null) => {
  selectedItem.value = item
}

const toggleLayer = (layer: keyof typeof layers.value) => {
  layers.value[layer] = !layers.value[layer]
}

const handleZoomIn = () => {
  viewport.value = { ...viewport.value, scale: Math.min(viewport.value.scale + 0.2, 4) }
}

const handleZoomOut = () => {
  viewport.value = { ...viewport.value, scale: Math.max(viewport.value.scale - 0.2, 0.5) }
}

const resetView = () => {
  viewport.value = { x: 0, y: 0, scale: 1 }
}
</script>
