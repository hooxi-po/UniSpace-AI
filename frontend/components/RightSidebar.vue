<template>
  <div 
    v-if="data" 
    class="absolute right-0 top-16 bottom-0 w-96 z-30 transition-transform duration-300 transform translate-x-0 pointer-events-none"
  >
    <div class="h-full pointer-events-auto p-4 flex flex-col">
      <TechPanel :title="title" class="h-full flex flex-col">
        <button 
          @click="emit('close')" 
          class="absolute top-4 right-4 text-white/50 hover:text-white"
        >
          ✕
        </button>
        
        <!-- Tabs -->
        <div class="flex border-b border-white/10 mb-4">
          <button 
            @click="activeTab = 'ledger'"
            :class="[
              'flex-1 p-2 text-xs font-mono flex items-center justify-center gap-1',
              activeTab === 'ledger' 
                ? 'text-tech-cyan bg-white/5 border-b-2 border-tech-cyan' 
                : 'text-gray-500 hover:text-white'
            ]"
          >
            <FileText :size="14" /> 基础台账
          </button>
          <button 
            @click="activeTab = 'monitor'"
            :class="[
              'flex-1 p-2 text-xs font-mono flex items-center justify-center gap-1',
              activeTab === 'monitor' 
                ? 'text-tech-cyan bg-white/5 border-b-2 border-tech-cyan' 
                : 'text-gray-500 hover:text-white'
            ]"
          >
            <Activity :size="14" /> 实时监测
          </button>
          <button 
            @click="activeTab = 'ops'"
            :class="[
              'flex-1 p-2 text-xs font-mono flex items-center justify-center gap-1',
              activeTab === 'ops' 
                ? 'text-tech-cyan bg-white/5 border-b-2 border-tech-cyan' 
                : 'text-gray-500 hover:text-white'
            ]"
          >
            <ClipboardList :size="14" /> 运维工单
          </button>
        </div>

        <!-- Content Area -->
        <div class="flex-grow overflow-y-auto scrollbar-thin pr-2">
          
          <!-- 1. LEDGER TAB -->
          <div v-if="activeTab === 'ledger'" class="space-y-4 text-sm">
            <div class="bg-white/5 p-3 border border-white/10 rounded">
              <h4 class="text-tech-blue font-bold mb-2 text-xs uppercase">技术参数</h4>
              <div v-if="isPipe" class="space-y-2 text-gray-300 font-mono">
                <div class="flex justify-between">
                  <span class="text-gray-500">材质:</span> {{ (data as PipeNode).material }}
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">管径:</span> {{ (data as PipeNode).diameter }}
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">埋深:</span> {{ (data as PipeNode).depth }} m
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">安装日期:</span> {{ (data as PipeNode).installDate }}
                </div>
              </div>
              <div v-else class="space-y-2 text-gray-300 font-mono">
                <div class="flex justify-between">
                  <span class="text-gray-500">类型:</span> {{ (data as Building).type.toUpperCase() }}
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">房间数:</span> {{ (data as Building).rooms }}
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">接入管网:</span> {{ (data as Building).connectedPipeId }}
                </div>
              </div>
            </div>

            <div class="bg-white/5 p-3 border border-white/10 rounded">
              <h4 class="text-tech-blue font-bold mb-2 text-xs uppercase">拓扑关系</h4>
              <div class="text-xs text-gray-400">
                <template v-if="isPipe">
                  该管段向下游供水至 {{ (data as PipeNode).connectedBuildingIds.join(', ') }}，当前链路畅通。
                </template>
                <template v-else>
                  该建筑接入 {{ (data as Building).connectedPipeId }} 号主管道，位于第 3 加压供水分区。
                </template>
              </div>
            </div>
          </div>

          <!-- 2. MONITOR TAB -->
          <div v-if="activeTab === 'monitor'" class="space-y-4">
            <!-- Real-time metrics -->
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-black/40 p-3 text-center border border-white/10">
                <div class="text-gray-500 text-[10px] mb-1">实时状态</div>
                <div 
                  :class="[
                    'font-bold font-mono',
                    data.status === 'normal' ? 'text-tech-water' : 'text-tech-red animate-pulse'
                  ]"
                >
                  {{ data.status.toUpperCase() }}
                </div>
              </div>
              <div class="bg-black/40 p-3 text-center border border-white/10">
                <div class="text-gray-500 text-[10px] mb-1">
                  {{ isPipe ? '当前流速' : '今日能耗' }}
                </div>
                <div class="text-tech-cyan font-bold font-mono">
                  {{ isPipe ? `${(data as PipeNode).flowRate} m³/h` : `${(data as Building).powerConsumption} kWh` }}
                </div>
              </div>
            </div>

            <!-- Equipment Control (Simulated IoT) -->
            <div 
              v-if="!isPipe && (data as Building).keyEquipment.length > 0" 
              class="border-t border-white/10 pt-4"
            >
              <h4 class="text-tech-blue font-bold mb-3 text-xs flex items-center gap-2">
                <Settings :size="14" /> 设备远程控制
              </h4>
              <div class="space-y-2">
                <div 
                  v-for="(eq, i) in (data as Building).keyEquipment" 
                  :key="i" 
                  class="flex items-center justify-between bg-white/5 p-2 px-3 rounded"
                >
                  <span class="text-xs text-gray-300">{{ eq }}</span>
                  <button class="flex items-center gap-1 bg-tech-water/20 hover:bg-tech-water/40 text-tech-water px-2 py-1 rounded text-[10px] transition-colors">
                    <Power :size="10" /> 启动
                  </button>
                </div>
              </div>
            </div>

            <!-- Pipe Pressure Chart Placeholder -->
            <div 
              v-if="isPipe" 
              class="h-32 bg-white/5 flex items-center justify-center text-xs text-gray-500 border border-dashed border-white/20"
            >
              [实时压力曲线 - IoT数据流]
            </div>
          </div>

          <!-- 3. OPS TAB -->
          <div v-if="activeTab === 'ops'" class="space-y-3">
            <!-- New Order Button -->
            <button class="w-full py-2 bg-tech-blue/20 border border-tech-blue/50 text-tech-blue text-xs font-bold hover:bg-tech-blue/30 transition-colors mb-2">
              + 发起维保工单
            </button>

            <div v-if="relatedOrders.length === 0" class="text-center text-gray-500 py-8 text-xs">
              暂无历史工单
            </div>
            <div 
              v-for="order in relatedOrders" 
              :key="order.id" 
              class="bg-white/5 border-l-2 border-white/20 p-3 hover:bg-white/10 transition-colors"
            >
              <div class="flex justify-between items-start mb-1">
                <span 
                  :class="[
                    'text-[10px] px-1 rounded',
                    order.status === 'processing' ? 'bg-yellow-500/20 text-yellow-500' :
                    order.status === 'completed' ? 'bg-green-500/20 text-green-500' : 
                    'bg-gray-500/20 text-gray-400'
                  ]"
                >
                  {{ order.status === 'processing' ? '处理中' : order.status === 'completed' ? '已完成' : '待处理' }}
                </span>
                <span class="text-[10px] text-gray-500">{{ order.date }}</span>
              </div>
              <div class="text-xs text-white mb-1 font-bold">
                {{ order.type === 'repair' ? '维修' : '巡检' }} - {{ order.id }}
              </div>
              <p class="text-[10px] text-gray-400">{{ order.description }}</p>
            </div>
            
            <!-- Lifecycle Info -->
            <div 
              v-if="isPipe" 
              class="mt-4 p-2 bg-tech-cyan/5 border border-tech-cyan/20 rounded text-[10px] text-tech-cyan flex items-start gap-2"
            >
              <AlertCircle :size="14" class="shrink-0 mt-0.5" />
              <div>
                <div class="font-bold">全生命周期提醒</div>
                上次维保: {{ (data as PipeNode).lastMaintain }}<br/>
                建议下次维保: 2024-05-01 (剩余 142 天)
              </div>
            </div>
          </div>
        </div>
      </TechPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Settings, Activity, ClipboardList, Power, AlertCircle, FileText } from 'lucide-vue-next'
import type { PipeNode, Building } from '~/types'
import { WORK_ORDERS } from '~/composables/useConstants'

interface Props {
  data: PipeNode | Building | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const activeTab = ref<'ledger' | 'monitor' | 'ops'>('ledger')

const isPipe = computed(() => {
  if (!props.data) return false
  return 'coordinates' in props.data && Array.isArray(props.data.coordinates)
})

const title = computed(() => {
  if (!props.data) return ''
  return isPipe.value 
    ? `管网资产: ${props.data.id}` 
    : `建筑资产: ${(props.data as Building).name}`
})

const relatedOrders = computed(() => {
  if (!props.data) return []
  return WORK_ORDERS.filter(wo => wo.targetId === props.data!.id)
})
</script>

<style scoped>
.text-tech-water {
  color: #10B981;
}
.text-tech-red {
  color: #FF4D4F;
}
</style>
