<template>
  <div class="detail-card">
    <div class="detail-card__header">
      <div>
        <div class="detail-card__title">影响范围分析</div>
        <div class="detail-card__caption">
          {{ detail.impactScope.impactedBuildings.length }} 栋楼宇 ·
          {{ detail.impactScope.impactedBuildings.reduce((sum, building) => sum + building.rooms.length, 0) }} 个房间
        </div>
      </div>
      <span v-if="detail.impactScope.manualAdjusted" class="detail-chip detail-chip--warn">已人工修订</span>
    </div>

    <PipelineImpactScopeVisualizer
      :impact-scope="detail.impactScope"
      :format-time="formatTime"
      @locate-building="handleLocateBuilding"
    />

    <div class="detail-editor">
      <div class="detail-card__sub-title">手动调整影响范围</div>
      <div class="detail-card__caption">当前使用 JSON 结构编辑，适合运维调度和联动演练场景。</div>
      <label class="detail-field">
        <span class="detail-field__label">受影响楼宇 JSON</span>
        <textarea v-model="impactForm.json" class="ops-textarea ops-textarea--compact" placeholder="JSON 格式的受影响楼宇数据" />
      </label>
      <div class="detail-row detail-row--double">
        <label class="detail-field">
          <span class="detail-field__label">避让要求</span>
          <input v-model="impactForm.bypass" class="ops-input" placeholder="管网链路避让要求描述" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">调整备注</span>
          <input v-model="impactForm.note" class="ops-input" placeholder="调整备注" />
        </label>
      </div>
      <div class="detail-actions-inline">
        <button class="ops-btn ops-btn--primary" :disabled="submitting" @click="emit('submit')">保存影响范围调整</button>
      </div>
    </div>
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
