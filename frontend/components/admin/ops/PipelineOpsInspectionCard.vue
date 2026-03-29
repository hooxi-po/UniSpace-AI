<template>
  <div v-if="detail.type === 'inspection'" class="detail-card">
    <div class="detail-card__title">巡检专属流程</div>
    <div class="detail-row">
      <input v-model="inspectionForm.checkinNodeId" class="ops-input" placeholder="扫码签到节点ID" />
      <select v-model="inspectionForm.judgement" class="ops-input">
        <option value="normal">正常</option>
        <option value="abnormal">异常</option>
      </select>
      <input v-model.number="inspectionForm.pressure" class="ops-input" type="number" placeholder="水压" />
      <input v-model.number="inspectionForm.waterQuality" class="ops-input" type="number" placeholder="水质指数" />
    </div>
    <input v-model="inspectionForm.issueText" class="ops-input" placeholder="现场问题描述" />
    <div class="detail-row">
      <input v-model.number="inspectionForm.lng" class="ops-input" type="number" step="0.000001" placeholder="经度(可选)" />
      <input v-model.number="inspectionForm.lat" class="ops-input" type="number" step="0.000001" placeholder="纬度(可选)" />
      <input v-model="inspectionForm.actor" class="ops-input" placeholder="巡检人" />
    </div>
    <input v-model="inspectionForm.photoUrlsText" class="ops-input" placeholder="照片URL(逗号分隔，必填)" />
    <div class="detail-row">
      <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="emit('submit-record')">上传巡检记录</button>
      <button class="ops-btn ops-btn--mini" :disabled="submitting || inspectionForm.judgement !== 'abnormal'" @click="emit('convert')">
        异常转维修工单
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import type { InspectionFormState } from './pipeline-ops-detail-types'

defineProps<{
  detail: PipelineWorkOrder
  inspectionForm: InspectionFormState
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'submit-record'): void
  (e: 'convert'): void
}>()
</script>
