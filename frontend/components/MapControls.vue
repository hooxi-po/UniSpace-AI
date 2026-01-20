<template>
  <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto transition-all duration-300">
    
    <!-- Command Deck Container (only Layer Management) -->
    <TechPanel class="!p-0 flex items-center h-14 bg-[#000B1A]/95 shadow-2xl shadow-tech-blue/15 border-tech-blue/50 backdrop-blur-xl px-4">
      <!-- Layer Management -->
      <div class="flex items-center gap-3 relative overflow-hidden">
        <!-- Background Decor -->
        <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <div class="flex items-center gap-2 mr-2">
          <Layers :size="14" class="text-gray-500" />
          <span class="text-[10px] font-mono text-gray-500 uppercase tracking-widest hidden sm:block">
            Layers
          </span>
        </div>

        <div class="flex gap-2">
          <LayerToggle 
            label="供水" 
            :active="layers.water" 
            color="bg-tech-water" 
            text-color="text-tech-water"
            @click="emit('toggle-layer', 'water')" 
          />
          <LayerToggle 
            label="污水" 
            :active="layers.sewage" 
            color="bg-tech-sewage" 
            text-color="text-tech-sewage"
            @click="emit('toggle-layer', 'sewage')" 
          />
          <LayerToggle 
            label="雨水" 
            :active="layers.drain" 
            color="bg-tech-drain" 
            text-color="text-tech-drain"
            @click="emit('toggle-layer', 'drain')" 
          />
          <LayerToggle 
            label="建筑" 
            :active="layers.buildings" 
            color="bg-white" 
            text-color="text-white"
            :show-icon="true"
            :icon-active="layers.buildings"
            @click="emit('toggle-layer', 'buildings')" 
          />
        </div>
      </div>
    </TechPanel>
    
    <!-- Decorative Glow underneath -->
    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-tech-cyan/30 to-transparent blur-[1px]" />
  </div>
</template>

<script setup lang="ts">
import { Layers } from 'lucide-vue-next'

interface Props {
  layers: {
    water: boolean
    sewage: boolean
    drain: boolean
    buildings: boolean
  }
}

defineProps<Props>()

const emit = defineEmits<{
  'toggle-layer': [layer: 'water' | 'sewage' | 'drain' | 'buildings']
}>()
</script>
