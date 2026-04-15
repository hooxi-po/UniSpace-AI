<template>
  <div class="detail-card">
    <div class="detail-card__title">影响范围分析</div>

    <!-- 可视化组件 -->
    <PipelineImpactScopeVisualizer
      :impact-scope="detail.impactScope"
      :format-time="formatTime"
      @locate-building="handleLocateBuilding"
    />

    <!-- 手动调整区域 -->
    <div class="detail-card__sub-title">手动调整影响范围</div>
    <textarea v-model="impactForm.json" class="ops-textarea" placeholder="JSON 格式的受影响楼宇数据" />
    <input v-model="impactForm.bypass" class="ops-input" placeholder="管网链路避让要求描述" />
    <input v-model="impactForm.note" class="ops-input" placeholder="调整备注" />
    <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="emit('submit')">保存影响范围调整</button>
  </div>
</template>

<script setup lang="ts">
import PipelineImpactScopeVisualizer from './PipelineImpactScopeVisualizer.vue'
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import type { ImpactFormState } from './pipeline-ops-detail-types'

const props = defineProps<{
  detail: PipelineWorkOrder
  impactForm: ImpactFormState
  submitting: boolean
  formatTime: (input?: string) => string
}>()

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'locate-building', buildingId: string): void
}>()

function handleLocateBuilding(buildingId: string) {
  emit('locate-building', buildingId)
}
</script>
