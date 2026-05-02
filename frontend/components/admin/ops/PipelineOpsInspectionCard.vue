<template>
  <div v-if="detail.type === 'inspection'" class="detail-card">
    <div class="detail-card__header">
      <div>
        <div class="detail-card__title">巡检专属流程</div>
        <div class="detail-card__caption">签到、检测值、现场照片与异常转维修在同一处完成。</div>
      </div>
      <span class="detail-chip detail-chip--soft">{{ detail.inspection?.records?.length || 0 }} 条巡检记录</span>
    </div>

    <div class="detail-editor">
      <div class="detail-row detail-row--double">
        <label class="detail-field">
          <span class="detail-field__label">签到节点 ID</span>
          <input v-model="inspectionForm.checkinNodeId" class="ops-input" placeholder="扫码签到节点ID" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">巡检人</span>
          <input v-model="inspectionForm.actor" class="ops-input" placeholder="巡检人" />
        </label>
      </div>

      <div class="detail-row detail-row--triple">
        <label class="detail-field">
          <span class="detail-field__label">判定结果</span>
          <select v-model="inspectionForm.judgement" class="ops-input">
            <option value="normal">正常</option>
            <option value="abnormal">异常</option>
          </select>
        </label>
        <label class="detail-field">
          <span class="detail-field__label">水压</span>
          <input v-model.number="inspectionForm.pressure" class="ops-input" type="number" placeholder="必填" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">水质指数</span>
          <input v-model.number="inspectionForm.waterQuality" class="ops-input" type="number" placeholder="必填" />
        </label>
      </div>

      <label class="detail-field">
        <span class="detail-field__label">现场问题描述</span>
        <input v-model="inspectionForm.issueText" class="ops-input" placeholder="异常原因、渗漏点位、现场现象等" />
      </label>

      <div class="detail-row detail-row--triple">
        <label class="detail-field">
          <span class="detail-field__label">经度</span>
          <input v-model.number="inspectionForm.lng" class="ops-input" type="number" step="0.000001" placeholder="必填" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">纬度</span>
          <input v-model.number="inspectionForm.lat" class="ops-input" type="number" step="0.000001" placeholder="必填" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">照片 URL</span>
          <input v-model="inspectionForm.photoUrlsText" class="ops-input" placeholder="逗号分隔，至少一张" />
        </label>
      </div>

      <div class="detail-actions-inline detail-actions-inline--split">
        <button class="ops-btn ops-btn--primary" :disabled="submitting" @click="emit('submit-record')">上传巡检记录</button>
        <button class="ops-btn" :disabled="submitting || inspectionForm.judgement !== 'abnormal'" @click="emit('convert')">
          异常转维修工单
        </button>
      </div>
    </div>

    <div v-if="detail.inspection?.records?.length" class="detail-log-list">
      <div v-for="record in detail.inspection.records.slice().reverse().slice(0, 3)" :key="record.id" class="detail-log-item">
        <div class="detail-log-item__head">
          <span class="detail-chip detail-chip--ghost">{{ record.judgement === 'abnormal' ? '异常' : '正常' }}</span>
          <span class="detail-kv detail-kv--muted">{{ record.createdAt }}</span>
        </div>
        <div class="detail-kv detail-kv--emphasis">节点 {{ record.checkinNodeId }}</div>
        <div class="detail-kv detail-kv--minor">
          水压 {{ record.pressure ?? '-' }} · 水质 {{ record.waterQuality ?? '-' }}
        </div>
        <div v-if="record.issueText" class="detail-kv detail-kv--minor">{{ record.issueText }}</div>
      </div>
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
