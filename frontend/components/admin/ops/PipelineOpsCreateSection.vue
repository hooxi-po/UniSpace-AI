<template>
  <div v-if="open" class="ops-form">
    <div class="ops-form__title">人工建单</div>

    <!-- 智能推荐与模板选择 -->
    <div class="ops-form__template-actions">
      <button
        class="ops-btn ops-btn--template"
        type="button"
        @click="templateSelectorOpen = true"
      >
        📋 从模板创建
      </button>
      <button
        class="ops-btn ops-btn--smart"
        type="button"
        @click="handleSmartRecommend"
        :disabled="isRecommending"
      >
        {{ isRecommending ? '🔄 分析中...' : '✨ 智能推荐' }}
      </button>
      <span v-if="selectedTemplateName" class="ops-form__template-hint">
        当前使用模板: {{ selectedTemplateName }}
      </span>
    </div>

    <!-- 智能推荐结果 -->
    <div v-if="recommendedTemplate" class="ops-smart-recommend">
      <div class="ops-smart-recommend__header">
        <span class="ops-smart-recommend__title">💡 推荐模板</span>
        <button class="ops-smart-recommend__close" @click="recommendedTemplate = null">✕</button>
      </div>
      <div class="ops-smart-recommend__content">
        <div class="ops-smart-recommend__name">{{ recommendedTemplate.name }}</div>
        <div class="ops-smart-recommend__reason">{{ recommendedTemplate.reason }}</div>
        <button class="ops-btn ops-btn--primary" @click="applyRecommendedTemplate">
          应用此模板
        </button>
      </div>
    </div>

    <!-- 验证错误提示 -->
    <div v-if="validationErrors.length > 0" class="ops-notice ops-notice--error">
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">请修正以下错误：</div>
        <ul style="margin: 0; padding-left: 20px;">
          <li v-for="error in validationErrors" :key="error">{{ error }}</li>
        </ul>
      </div>
      <button class="ops-notice__close" @click="clearValidationErrors">✕</button>
    </div>

    <div class="ops-form__row">
      <label>工单标题 <span class="required-mark">*</span>
        <input
          v-model="form.title"
          class="ops-input"
          :class="{ 'ops-input--error': validationErrors.includes('工单标题不能为空') }"
          placeholder="请输入工单标题"
        />
      </label>
      <label>描述
        <input v-model="form.description" class="ops-input" placeholder="工单描述" />
      </label>
    </div>
    <div class="ops-form__row">
      <label v-if="mode === 'linkage'">工单类型 <span class="required-mark">*</span>
        <select v-model="form.type" class="ops-input">
          <option value="inspection">巡检</option>
          <option value="maintenance">维修</option>
          <option value="retrofit">改造</option>
          <option value="retire">报废</option>
        </select>
      </label>
      <label>优先级 <span class="required-mark">*</span>
        <select v-model="form.priority" class="ops-input">
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </label>
      <label>所属区域
        <input
          v-model="form.area"
          class="ops-input"
          placeholder="教学区 / 生活区"
        />
      </label>
      <label>管网介质 <span class="required-mark">*</span>
        <select v-model="form.pipelineMedium" class="ops-input">
          <option value="water">供水</option>
          <option value="drainage">排水</option>
          <option value="sewage">污水</option>
          <option value="mixed">混合</option>
        </select>
      </label>
    </div>
    <div class="ops-form__row">
      <div class="ops-field-with-action">
        <label>节点（逗号）
          <input v-model="form.nodeIdsText" class="ops-input" placeholder="N-1001,N-1002" />
        </label>
      </div>
      <div class="ops-field-with-action">
        <label>管段（逗号）
          <input v-model="form.segmentIdsText" class="ops-input" placeholder="S-2101,S-2102" />
        </label>
      </div>
      <button
        class="ops-btn ops-btn--mini"
        type="button"
        :disabled="!impactAnalysisAvailable || analyzingImpact"
        @click="handleAnalyzeImpact"
      >
        {{ impactAnalysisAvailable ? (analyzingImpact ? '分析中...' : '🔍 智能分析影响范围') : '影响分析接入中' }}
      </button>
      <span v-if="!impactAnalysisAvailable" class="ops-form__analysis-hint">
        真实 GIS 影响分析接口未接入，当前请手动填写关联楼宇信息。
      </span>
    </div>
    <div v-if="impactAnalysisAvailable && impactAnalysisResult" class="ops-impact-result">
      <div class="ops-impact-result__header">
        <span class="ops-impact-result__title">📊 影响范围分析结果</span>
        <button class="ops-btn ops-btn--mini" type="button" @click="applyImpactResult">
          ✓ 应用到表单
        </button>
      </div>
      <div class="ops-impact-result__content">
        <div class="ops-impact-result__item">
          <span class="ops-impact-result__label">受影响楼宇:</span>
          <span class="ops-impact-result__value">{{ impactAnalysisResult.impactedBuildings.length }} 栋</span>
        </div>
        <div class="ops-impact-result__item">
          <span class="ops-impact-result__label">受影响用户:</span>
          <span class="ops-impact-result__value">{{ impactAnalysisResult.affectedUserCount }} 人</span>
        </div>
        <div class="ops-impact-result__item">
          <span class="ops-impact-result__label">预计影响时长:</span>
          <span class="ops-impact-result__value">{{ impactAnalysisResult.estimatedImpactHours }} 小时</span>
        </div>
        <div class="ops-impact-result__buildings">
          <span v-for="building in impactAnalysisResult.impactedBuildings" :key="building.buildingId" class="building-tag">
            {{ building.buildingName }}
          </span>
        </div>
      </div>
    </div>
    <div class="ops-form__row">
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
      <button class="ops-btn ops-btn--primary" type="button" :disabled="submitting" @click="handleSubmitCreate">
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
      <button class="ops-btn" type="button" :disabled="submitting" @click="handleSubmitAutoCreate">
        一键自动建单
      </button>
    </div>

    <!-- 模板选择器对话框 -->
    <div v-if="templateSelectorOpen" class="ops-modal">
      <div class="ops-modal__backdrop" @click="templateSelectorOpen = false"></div>
      <div class="ops-modal__content">
        <PipelineOpsTemplateSelector
          :allowed-type="allowedTemplateType || undefined"
          @select="applyTemplate"
          @close="templateSelectorOpen = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PipelineMedium, PipelineOrderType, PipelinePriority } from '~/types/pipeline-ops'
import type { PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'
import type { PipelineWorkOrderTemplate } from '~/types/pipeline-ops-template'
import { analyzeImpactScope, recommendTemplate, type ImpactAnalysisResponse, type TemplateRecommendResponse } from '~/services/pipeline-intelligence'
import PipelineOpsTemplateSelector from './PipelineOpsTemplateSelector.vue'

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

const props = defineProps<{
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

const validationErrors = ref<string[]>([])
const templateSelectorOpen = ref(false)
const selectedTemplateName = ref('')
const analyzingImpact = ref(false)
const impactAnalysisResult = ref<ImpactAnalysisResponse | null>(null)
const isRecommending = ref(false)
const recommendedTemplate = ref<TemplateRecommendResponse | null>(null)
const allowedTemplateType = computed<PipelineOrderType | null>(() => props.mode === 'linkage' ? null : props.mode)
const impactAnalysisAvailable = false
const workorderTypeLabel: Record<PipelineOrderType, string> = {
  inspection: '巡检',
  maintenance: '维修',
  retrofit: '改造',
  retire: '报废',
}
let impactAnalysisRequestId = 0
let recommendRequestId = 0

function clearValidationErrors() {
  validationErrors.value = []
}

function resetLocalUiState() {
  impactAnalysisRequestId += 1
  recommendRequestId += 1
  validationErrors.value = []
  templateSelectorOpen.value = false
  selectedTemplateName.value = ''
  analyzingImpact.value = false
  impactAnalysisResult.value = null
  isRecommending.value = false
  recommendedTemplate.value = null
}

watch(() => props.open, (open) => {
  if (!open) {
    resetLocalUiState()
  }
})

function applyTemplate(template: PipelineWorkOrderTemplate) {
  if (allowedTemplateType.value && template.preset.type !== allowedTemplateType.value) {
    validationErrors.value = [`当前看板仅支持${workorderTypeLabel[allowedTemplateType.value]}模板`]
    templateSelectorOpen.value = false
    return
  }

  clearValidationErrors()

  // 应用模板预设值到表单
  props.form.title = template.preset.title
  props.form.description = template.preset.description
  if (allowedTemplateType.value === null) {
    props.form.type = template.preset.type
  }
  props.form.pipelineMedium = template.preset.pipelineMedium
  props.form.priority = template.preset.priority
  props.form.area = template.preset.area || ''
  props.form.assignee = template.preset.assignee || ''
  props.form.reviewer = template.preset.reviewer || ''

  selectedTemplateName.value = template.name
  templateSelectorOpen.value = false
}

function validateForm(): boolean {
  const errors: string[] = []

  if (!props.form.title || props.form.title.trim() === '') {
    errors.push('工单标题不能为空')
  }

  validationErrors.value = errors
  return errors.length === 0
}

function handleSubmitCreate() {
  if (validateForm()) {
    emit('submit-create')
  }
}

function handleSubmitAutoCreate() {
  if (validateForm()) {
    emit('submit-auto-create')
  }
}

// 智能分析影响范围
async function handleAnalyzeImpact() {
  if (!impactAnalysisAvailable) {
    impactAnalysisResult.value = null
    validationErrors.value = ['影响范围智能分析暂未接入后端，请手动填写关联楼宇信息']
    return
  }

  const nodeIds = props.form.nodeIdsText.split(',').map(s => s.trim()).filter(Boolean)
  const segmentIds = props.form.segmentIdsText.split(',').map(s => s.trim()).filter(Boolean)

  if (nodeIds.length === 0 && segmentIds.length === 0) {
    return
  }

  const requestId = ++impactAnalysisRequestId
  analyzingImpact.value = true
  try {
    const result = await analyzeImpactScope({ nodeIds, segmentIds })
    if (requestId !== impactAnalysisRequestId || !props.open) return
    impactAnalysisResult.value = result
  } catch (error) {
    if (requestId !== impactAnalysisRequestId || !props.open) return
    console.error('影响范围分析失败:', error)
    validationErrors.value = ['影响范围分析失败，请稍后重试']
  } finally {
    if (requestId === impactAnalysisRequestId) {
      analyzingImpact.value = false
    }
  }
}

// 应用影响范围分析结果到表单
function applyImpactResult() {
  if (!impactAnalysisResult.value) return

  const buildings = impactAnalysisResult.value.impactedBuildings
  if (buildings.length > 0) {
    // 自动填充第一个楼宇的信息
    props.form.buildingId = buildings[0].buildingId
    props.form.buildingName = buildings[0].buildingName
  }

  // 清除分析结果
  impactAnalysisResult.value = null
}

// 智能推荐模板
async function handleSmartRecommend() {
  const nodeIds = props.form.nodeIdsText.split(',').map(s => s.trim()).filter(Boolean)
  const segmentIds = props.form.segmentIdsText.split(',').map(s => s.trim()).filter(Boolean)

  if (nodeIds.length === 0 && segmentIds.length === 0) {
    validationErrors.value = ['请先输入节点或管段ID']
    return
  }

  const requestId = ++recommendRequestId
  isRecommending.value = true
  try {
    const result = await recommendTemplate({
      nodeIds,
      segmentIds,
      area: props.form.area,
      medium: props.form.pipelineMedium,
      allowedType: allowedTemplateType.value || undefined,
    })
    if (requestId !== recommendRequestId || !props.open) return
    recommendedTemplate.value = result
  } catch (error) {
    if (requestId !== recommendRequestId || !props.open) return
    console.error('智能推荐失败:', error)
    validationErrors.value = ['智能推荐失败，请稍后重试']
  } finally {
    if (requestId === recommendRequestId) {
      isRecommending.value = false
    }
  }
}

// 应用推荐的模板
function applyRecommendedTemplate() {
  if (!recommendedTemplate.value) return
  applyTemplate(recommendedTemplate.value)
  recommendedTemplate.value = null
}
</script>
