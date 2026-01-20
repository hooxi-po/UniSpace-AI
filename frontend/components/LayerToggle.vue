<template>
  <button 
    @click="emit('click')"
    :class="[
      'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 border',
      active 
        ? `bg-opacity-10 ${color} border-opacity-50 ${textColor} ${borderColor}`
        : 'bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-400',
      active ? 'shadow-[0_0_8px_rgba(0,0,0,0.5)]' : ''
    ]"
  >
    <Eye v-if="showIcon && iconActive" :size="12" />
    <EyeOff v-else-if="showIcon && !iconActive" :size="12" />
    <div 
      v-else
      :class="[
        'w-1.5 h-1.5 rounded-full transition-colors',
        active ? color : 'bg-gray-600'
      ]" 
    />
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

interface Props {
  label: string
  active: boolean
  color: string
  textColor: string
  showIcon?: boolean
  iconActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: false,
  iconActive: false
})

const emit = defineEmits<{
  click: []
}>()

const borderColor = computed(() => {
  const colorName = props.color.split('-')[1]
  return colorName === 'white' ? 'border-white' : `border-${colorName}`
})
</script>

<style scoped>
.bg-tech-water {
  background-color: rgba(16, 185, 129, 0.1);
}
.text-tech-water {
  color: #10B981;
}
.border-tech-water {
  border-color: rgba(16, 185, 129, 0.5);
}

.bg-tech-sewage {
  background-color: rgba(139, 92, 246, 0.1);
}
.text-tech-sewage {
  color: #8B5CF6;
}
.border-tech-sewage {
  border-color: rgba(139, 92, 246, 0.5);
}

.bg-tech-drain {
  background-color: rgba(59, 130, 246, 0.1);
}
.text-tech-drain {
  color: #3B82F6;
}
.border-tech-drain {
  border-color: rgba(59, 130, 246, 0.5);
}
</style>
