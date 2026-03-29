<template>
  <div v-if="open" class="ops-form">
    <div class="ops-form__title">人工建单</div>
    <div class="ops-form__row">
      <label>工单标题<input v-model="form.title" class="ops-input" placeholder="请输入工单标题" /></label>
      <label>描述<input v-model="form.description" class="ops-input" placeholder="工单描述" /></label>
    </div>
    <div class="ops-form__row">
      <label v-if="mode === 'linkage'">工单类型
        <select v-model="form.type" class="ops-input">
          <option value="inspection">巡检</option>
          <option value="maintenance">维修</option>
          <option value="retrofit">改造</option>
          <option value="retire">报废</option>
        </select>
      </label>
      <label>优先级
        <select v-model="form.priority" class="ops-input">
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </label>
      <label>所属区域<input v-model="form.area" class="ops-input" placeholder="教学区 / 生活区" /></label>
      <label>管网介质
        <select v-model="form.pipelineMedium" class="ops-input">
          <option value="water">供水</option>
          <option value="drainage">排水</option>
          <option value="sewage">污水</option>
          <option value="mixed">混合</option>
        </select>
      </label>
    </div>
    <div class="ops-form__row">
      <label>节点（逗号）<input v-model="form.nodeIdsText" class="ops-input" placeholder="N-1001,N-1002" /></label>
      <label>管段（逗号）<input v-model="form.segmentIdsText" class="ops-input" placeholder="S-2101,S-2102" /></label>
      <label>关联楼宇编码<input v-model="form.buildingId" class="ops-input" placeholder="BLD-001" /></label>
      <label>关联楼宇名称<input v-model="form.buildingName" class="ops-input" placeholder="博学楼" /></label>
    </div>
    <div class="ops-form__row">
      <label>计划日期<input v-model="form.plannedDate" class="ops-input" type="date" /></label>
      <label>截止时间<input v-model="form.deadlineAt" class="ops-input" type="datetime-local" /></label>
      <label>执行人<input v-model="form.assignee" class="ops-input" placeholder="班组或人员" /></label>
      <label>审核人<input v-model="form.reviewer" class="ops-input" placeholder="审核人" /></label>
    </div>
    <div class="ops-form__actions">
      <button class="ops-btn ops-btn--primary" type="button" :disabled="submitting" @click="emit('submit-create')">
        创建草稿工单
      </button>
    </div>

    <div class="ops-form__title ops-form__title--sub">自动触发建单（监测异常/知识推理）</div>
    <div class="ops-form__row">
      <label>触发类型
        <select v-model="autoForm.trigger" class="ops-input">
          <option value="telemetry_alert">监测异常</option>
          <option value="anomaly_alert">人工上报异常</option>
          <option value="kg_inference">知识图谱推理</option>
        </select>
      </label>
      <label>触发原因<input v-model="autoForm.reason" class="ops-input" placeholder="例如：N-2301 压力异常" /></label>
    </div>
    <div class="ops-form__actions">
      <button class="ops-btn" type="button" :disabled="submitting" @click="emit('submit-auto-create')">
        一键自动建单
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PipelineMedium, PipelineOrderType, PipelinePriority } from '~/types/pipeline-ops'
import type { PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'

type CreateFormState = {
  title: string
  description: string
  type: PipelineOrderType
  pipelineMedium: PipelineMedium
  area: string
  buildingId: string
  buildingName: string
  nodeIdsText: string
  segmentIdsText: string
  assignee: string
  reviewer: string
  priority: PipelinePriority
  plannedDate: string
  deadlineAt: string
}

type AutoCreateFormState = {
  trigger: 'telemetry_alert' | 'anomaly_alert' | 'kg_inference'
  reason: string
}

defineProps<{
  open: boolean
  mode: PipelineOpsBoardMode
  submitting: boolean
  form: CreateFormState
  autoForm: AutoCreateFormState
}>()

const emit = defineEmits<{
  (e: 'submit-create'): void
  (e: 'submit-auto-create'): void
}>()
</script>
