<template>
  <div class="detail-card">
    <div class="detail-card__title">影响楼宇与房间</div>
    <div
      v-for="building in detail.impactScope.impactedBuildings"
      :key="building.buildingId"
      class="detail-block"
    >
      <div class="detail-kv">
        {{ building.buildingName }}({{ building.buildingId }}) / 楼层: {{ building.floors.join(',') || '-' }}
      </div>
      <div class="detail-kv detail-kv--minor">
        房间: {{ building.rooms.map(r => `${r.roomNo}`).join(', ') || '-' }}
      </div>
    </div>
    <div class="detail-card__sub-title">手动调整影响范围</div>
    <textarea v-model="impactForm.json" class="ops-textarea" />
    <input v-model="impactForm.bypass" class="ops-input" placeholder="管网链路避让要求描述" />
    <input v-model="impactForm.note" class="ops-input" placeholder="调整备注" />
    <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="emit('submit')">保存影响范围调整</button>
  </div>
</template>

<script setup lang="ts">
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import type { ImpactFormState } from './pipeline-ops-detail-types'

defineProps<{
  detail: PipelineWorkOrder
  impactForm: ImpactFormState
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'submit'): void
}>()
</script>
