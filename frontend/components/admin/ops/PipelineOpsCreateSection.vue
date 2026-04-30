<template>
  <div v-if="open" class="ops-form ops-form--cards">
    <div class="ops-create__hero">
      <div class="ops-create__hero-content">
        <div class="ops-create__eyebrow">Work Order Studio</div>
        <div class="ops-form__title">新建工单</div>
        <div class="ops-create__subtitle">用卡片方式组织模板、定位、执行安排和自动建单，让调度入口更像一个工作台而不是一张长表单。</div>
      </div>
      <div class="ops-create__hero-side">
        <div class="ops-create__hero-badges">
          <span class="ops-create__badge ops-create__badge--type">{{ currentTypeLabel }}</span>
          <span class="ops-create__badge ops-create__badge--priority">{{ currentPriorityLabel }}</span>
          <span class="ops-create__badge ops-create__badge--medium">{{ currentMediumLabel }}</span>
        </div>
        <button class="ops-create__close" type="button" @click="emit('close')" aria-label="关闭新建工单">
          ✕
        </button>
      </div>
    </div>

    <div class="ops-create__quick-actions">
      <button class="ops-btn ops-btn--template" type="button" @click="templateSelectorOpen = true">
        📋 从模板创建
      </button>
      <button class="ops-btn ops-btn--smart" type="button" :disabled="isRecommending || !canRecommendTemplate" @click="handleSmartRecommend">
        {{ isRecommending ? '🔄 分析中...' : '✨ 智能推荐' }}
      </button>
      <button class="ops-btn ops-btn--report" type="button" :disabled="analyzingImpact || !canAnalyzeImpact" @click="handleAnalyzeImpact">
        {{ analyzingImpact ? '分析中...' : '🔍 预分析影响范围' }}
      </button>
      <span v-if="selectedTemplateName" class="ops-create__hint">当前模板：{{ selectedTemplateName }}</span>
    </div>

    <div v-if="recommendedTemplate" class="ops-smart-recommend">
      <div class="ops-smart-recommend__header">
        <span class="ops-smart-recommend__title">💡 推荐模板</span>
        <button class="ops-smart-recommend__close" @click="recommendedTemplate = null">✕</button>
      </div>
      <div class="ops-smart-recommend__content">
        <div class="ops-smart-recommend__name">{{ recommendedTemplate.name }}</div>
        <div class="ops-smart-recommend__reason">{{ recommendedTemplate.reason }}</div>
        <div class="ops-create__recommend-meta">
          <span>匹配度 {{ Math.round(recommendedTemplate.confidence * 100) }}%</span>
          <span>{{ workorderTypeLabel[recommendedTemplate.preset.type] }}</span>
        </div>
        <button class="ops-btn ops-btn--primary" @click="applyRecommendedTemplate">
          应用此模板
        </button>
      </div>
    </div>

    <div v-if="validationErrors.length > 0" class="ops-notice ops-notice--error">
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">请修正以下问题：</div>
        <ul style="margin: 0; padding-left: 20px;">
          <li v-for="error in validationErrors" :key="error">{{ error }}</li>
        </ul>
      </div>
      <button class="ops-notice__close" @click="clearValidationErrors">✕</button>
    </div>

    <div class="ops-create__grid">
      <section class="ops-create-card ops-create-card--basic">
        <div class="ops-create-card__header">
          <div>
            <div class="ops-create-card__title">基础信息</div>
            <div class="ops-create-card__desc">先确定工单主题、类型和上下文。</div>
          </div>
          <div class="ops-create-card__meta">必填优先级与介质</div>
        </div>

        <div class="ops-form__row">
          <label>工单标题 <span class="required-mark">*</span>
            <input
              v-model="form.title"
              class="ops-input"
              :class="{ 'ops-input--error': validationErrors.includes('工单标题不能为空') }"
              placeholder="例如：实验楼污水主管巡检复核"
            />
          </label>
          <label>工单描述
            <input v-model="form.description" class="ops-input" placeholder="补充异常现象、影响范围或处置目标" />
          </label>
        </div>

        <div v-if="mode === 'linkage'" class="ops-create__choice-group">
          <div class="ops-create__choice-title">工单类型</div>
          <div class="ops-create__choice-grid ops-create__choice-grid--4">
            <button
              v-for="option in typeOptions"
              :key="option.value"
              type="button"
              class="ops-create-option"
              :class="{ 'ops-create-option--active': form.type === option.value }"
              @click="form.type = option.value"
            >
              <span class="ops-create-option__icon">{{ option.icon }}</span>
              <span class="ops-create-option__label">{{ option.label }}</span>
              <span class="ops-create-option__hint">{{ option.hint }}</span>
            </button>
          </div>
        </div>

        <div class="ops-create__choice-group">
          <div class="ops-create__choice-title">管网介质</div>
          <div class="ops-create__choice-grid ops-create__choice-grid--4">
            <button
              v-for="option in mediumOptions"
              :key="option.value"
              type="button"
              class="ops-create-option"
              :class="{ 'ops-create-option--active': form.pipelineMedium === option.value }"
              @click="form.pipelineMedium = option.value"
            >
              <span class="ops-create-option__icon">{{ option.icon }}</span>
              <span class="ops-create-option__label">{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="ops-create__choice-group">
          <div class="ops-create__choice-title">优先级</div>
          <div class="ops-create__choice-grid ops-create__choice-grid--4">
            <button
              v-for="option in priorityOptions"
              :key="option.value"
              type="button"
              class="ops-create-option ops-create-option--compact"
              :class="{ 'ops-create-option--active': form.priority === option.value }"
              @click="form.priority = option.value"
            >
              <span class="ops-create-option__label">{{ option.label }}</span>
              <span class="ops-create-option__hint">{{ option.hint }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="ops-create-card">
        <div class="ops-create-card__header">
          <div>
            <div class="ops-create-card__title">管网定位与影响范围</div>
            <div class="ops-create-card__desc">支持通过节点、管段或楼宇快速定位，并做预分析。</div>
          </div>
          <div class="ops-create-card__meta">{{ locationSummary }}</div>
        </div>

        <div class="ops-form__row">
          <label>节点（逗号）
            <input v-model="form.nodeIdsText" class="ops-input" placeholder="N-1001,N-1002" />
          </label>
          <label>管段（逗号）
            <input v-model="form.segmentIdsText" class="ops-input" placeholder="S-2101,S-2102" />
          </label>
        </div>

        <div class="ops-form__row">
          <label>关联楼宇编码
            <input v-model="form.buildingId" class="ops-input" placeholder="BLD-001" />
          </label>
          <label>关联楼宇名称
            <input v-model="form.buildingName" class="ops-input" placeholder="博学楼" />
          </label>
        </div>

        <div class="ops-create__analysis-bar">
          <span class="ops-create__hint">
            {{ canAnalyzeImpact ? '已可执行预分析，提交工单后后端仍会做正式影响范围推断。' : '请至少填写节点、管段或楼宇信息。' }}
          </span>
        </div>

        <div v-if="impactAnalysisResult" class="ops-impact-result">
          <div class="ops-impact-result__header">
            <span class="ops-impact-result__title">📊 影响范围预分析</span>
            <button class="ops-btn ops-btn--mini" type="button" @click="applyImpactResult">✓ 应用到楼宇字段</button>
          </div>
          <div class="ops-impact-result__content">
            <div class="ops-impact-result__item">
              <span class="ops-impact-result__label">受影响楼宇:</span>
              <span class="ops-impact-result__value">{{ impactAnalysisResult.impactedBuildings.length }} 栋</span>
            </div>
            <div class="ops-impact-result__item">
              <span class="ops-impact-result__label">预计影响人数:</span>
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
      </section>

      <section class="ops-create-card">
        <div class="ops-create-card__header">
          <div>
            <div class="ops-create-card__title">执行安排</div>
            <div class="ops-create-card__desc">补充区域、责任人和时间计划，让草稿直接可流转。</div>
          </div>
          <div class="ops-create-card__meta">{{ scheduleSummary }}</div>
        </div>

        <div class="ops-form__row">
          <label>所属区域
            <input v-model="form.area" class="ops-input" placeholder="教学区 / 生活区 / 运动区" />
          </label>
          <label>执行人
            <input v-model="form.assignee" class="ops-input" placeholder="班组或人员" />
          </label>
        </div>

        <div class="ops-form__row">
          <label>审核人
            <input v-model="form.reviewer" class="ops-input" placeholder="审核人" />
          </label>
          <label>计划日期
            <input v-model="form.plannedDate" class="ops-input" type="date" />
          </label>
        </div>

        <div class="ops-form__row">
          <label>截止时间
            <input v-model="form.deadlineAt" class="ops-input" type="datetime-local" />
          </label>
        </div>
      </section>

      <section class="ops-create-card ops-create-card--auto">
        <div class="ops-create-card__header">
          <div>
            <div class="ops-create-card__title">自动触发建单</div>
            <div class="ops-create-card__desc">用于监测异常、人工异常上报和知识推理联动。</div>
          </div>
          <div class="ops-create-card__meta">自动生成待办工单</div>
        </div>

        <div class="ops-form__row">
          <label>触发类型
            <select v-model="autoForm.trigger" class="ops-input">
              <option value="telemetry_alert">监测异常</option>
              <option value="anomaly_alert">人工上报异常</option>
              <option value="kg_inference">知识图谱推理</option>
            </select>
          </label>
          <label>触发原因 <span class="required-mark">*</span>
            <input v-model="autoForm.reason" class="ops-input" placeholder="例如：N-2301 压力异常，建议发起复核巡检" />
          </label>
        </div>

        <div class="ops-create__auto-note">
          自动建单会继承当前卡片里的标题、介质、区域、节点/管段和责任信息，并直接进入自动触发来源。
        </div>

        <div class="ops-form__actions ops-form__actions--split">
          <button class="ops-btn ops-btn--primary" type="button" :disabled="submitting" @click="handleSubmitCreate">
            创建草稿工单
          </button>
          <button class="ops-btn" type="button" :disabled="submitting" @click="handleSubmitAutoCreate">
            一键自动建单
          </button>
        </div>
      </section>
    </div>

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
  (e: 'close'): void
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
const workorderTypeLabel: Record<PipelineOrderType, string> = {
  inspection: '巡检',
  maintenance: '维修',
  retrofit: '改造',
  retire: '报废',
}
const typeOptions: Array<{ value: PipelineOrderType; label: string; icon: string; hint: string }> = [
  { value: 'inspection', label: '巡检', icon: '🔎', hint: '例行检查与异常复核' },
  { value: 'maintenance', label: '维修', icon: '🛠️', hint: '故障处置与恢复' },
  { value: 'retrofit', label: '改造', icon: '🏗️', hint: '方案升级与施工' },
  { value: 'retire', label: '报废', icon: '🗂️', hint: '停用、封堵与销账' },
]
const mediumOptions: Array<{ value: PipelineMedium; label: string; icon: string }> = [
  { value: 'water', label: '供水', icon: '💧' },
  { value: 'drainage', label: '排水', icon: '🌧️' },
  { value: 'sewage', label: '污水', icon: '♻️' },
  { value: 'mixed', label: '混合', icon: '🧭' },
]
const priorityOptions: Array<{ value: PipelinePriority; label: string; hint: string }> = [
  { value: 'low', label: '低', hint: '可排期处理' },
  { value: 'medium', label: '中', hint: '常规调度' },
  { value: 'high', label: '高', hint: '优先跟进' },
  { value: 'urgent', label: '紧急', hint: '立即响应' },
]
let impactAnalysisRequestId = 0
let recommendRequestId = 0

const parsedNodeIds = computed(() => props.form.nodeIdsText.split(',').map(s => s.trim()).filter(Boolean))
const parsedSegmentIds = computed(() => props.form.segmentIdsText.split(',').map(s => s.trim()).filter(Boolean))
const hasManualLocation = computed(() =>
  parsedNodeIds.value.length > 0
  || parsedSegmentIds.value.length > 0
  || props.form.buildingId.trim().length > 0
  || props.form.buildingName.trim().length > 0,
)
const canAnalyzeImpact = computed(() => hasManualLocation.value && !analyzingImpact.value)
const canRecommendTemplate = computed(() => parsedNodeIds.value.length > 0 || parsedSegmentIds.value.length > 0)
const currentTypeLabel = computed(() => workorderTypeLabel[props.form.type])
const currentPriorityLabel = computed(() => priorityOptions.find(option => option.value === props.form.priority)?.label || '中')
const currentMediumLabel = computed(() => mediumOptions.find(option => option.value === props.form.pipelineMedium)?.label || '混合')
const locationSummary = computed(() => {
  const nodeCount = parsedNodeIds.value.length
  const segmentCount = parsedSegmentIds.value.length
  const buildingCount = Number(Boolean(props.form.buildingId.trim() || props.form.buildingName.trim()))
  if (nodeCount + segmentCount + buildingCount === 0) return '尚未填写定位信息'
  return `节点 ${nodeCount} · 管段 ${segmentCount} · 楼宇 ${buildingCount}`
})
const scheduleSummary = computed(() => {
  if (props.form.assignee.trim() && props.form.plannedDate) return `已安排 ${props.form.assignee} · ${props.form.plannedDate}`
  if (props.form.assignee.trim()) return `已指定 ${props.form.assignee}`
  if (props.form.plannedDate) return `计划 ${props.form.plannedDate}`
  return '尚未安排执行计划'
})

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
  if (!hasManualLocation.value) {
    errors.push('请至少填写节点、管段或关联楼宇')
  }
  if (props.form.deadlineAt && Number.isNaN(new Date(props.form.deadlineAt).getTime())) {
    errors.push('截止时间格式无效')
  }

  validationErrors.value = errors
  return errors.length === 0
}

function validateAutoCreate(): boolean {
  const ok = validateForm()
  const errors = [...validationErrors.value]
  if (!props.autoForm.reason || props.autoForm.reason.trim() === '') {
    errors.push('自动建单需要填写触发原因')
  }
  validationErrors.value = errors
  return ok && errors.length === 0
}

function handleSubmitCreate() {
  if (validateForm()) {
    emit('submit-create')
  }
}

function handleSubmitAutoCreate() {
  if (validateAutoCreate()) {
    emit('submit-auto-create')
  }
}

// 智能分析影响范围
async function handleAnalyzeImpact() {
  if (!canAnalyzeImpact.value) {
    validationErrors.value = ['请先填写节点、管段或关联楼宇后再执行预分析']
    return
  }

  const requestId = ++impactAnalysisRequestId
  analyzingImpact.value = true
  clearValidationErrors()
  try {
    const result = await analyzeImpactScope({
      nodeIds: parsedNodeIds.value,
      segmentIds: parsedSegmentIds.value,
      buildingId: props.form.buildingId,
      buildingName: props.form.buildingName,
      medium: props.form.pipelineMedium,
      area: props.form.area,
    })
    if (requestId !== impactAnalysisRequestId || !props.open) return
    if (!result.impactedBuildings.length) {
      validationErrors.value = ['未匹配到受影响楼宇，请补充楼宇编码/名称或检查节点、管段输入']
      impactAnalysisResult.value = null
      return
    }
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
  if (!canRecommendTemplate.value) {
    validationErrors.value = ['请先输入节点或管段ID']
    return
  }

  const requestId = ++recommendRequestId
  isRecommending.value = true
  clearValidationErrors()
  try {
    const result = await recommendTemplate({
      nodeIds: parsedNodeIds.value,
      segmentIds: parsedSegmentIds.value,
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

<style scoped>
.ops-form--cards {
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(25, 103, 255, 0.08), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.ops-create__hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid #dde7f2;
  background:
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.15), transparent 22%),
    linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%);
}

.ops-create__hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.ops-create__hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ops-create__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5f7ea8;
}

.ops-create__subtitle {
  max-width: 760px;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
}

.ops-create__hero-badges,
.ops-create__quick-actions,
.ops-create__recommend-meta,
.ops-create__analysis-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ops-create__badge {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.ops-create__badge--type {
  background: #eef4ff;
  border-color: #cfe0ff;
  color: #1d4ed8;
}

.ops-create__badge--priority {
  background: #fff7d6;
  border-color: #f0da91;
  color: #9a6700;
}

.ops-create__badge--medium {
  background: #eef9f6;
  border-color: #cbeee5;
  color: #0f766e;
}

.ops-create__quick-actions {
  padding: 2px 2px 0;
}

.ops-create__hint {
  font-size: 12px;
  color: #6b7a8a;
}

.ops-create__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.ops-create-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid #dee6ef;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.ops-create-card--auto {
  background:
    radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.08), transparent 22%),
    linear-gradient(180deg, #ffffff 0%, #f8fff8 100%);
}

.ops-create-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.ops-create-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.ops-create-card__desc,
.ops-create-card__meta,
.ops-create__auto-note {
  font-size: 12px;
  line-height: 1.55;
  color: #6b7a8a;
}

.ops-create-card__meta {
  white-space: nowrap;
}

.ops-create__choice-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ops-create__choice-title {
  font-size: 12px;
  font-weight: 700;
  color: #52606d;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ops-create__choice-grid {
  display: grid;
  gap: 10px;
}

.ops-create__choice-grid--4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.ops-create-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid #d9e3ee;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
  transition: 0.18s ease;
  text-align: left;
}

.ops-create-option:hover {
  border-color: #8db7ff;
  background: #f4f8ff;
}

.ops-create-option--active {
  border-color: #1967ff;
  background: linear-gradient(180deg, #f2f7ff 0%, #e9f1ff 100%);
  box-shadow: inset 0 0 0 1px rgba(25, 103, 255, 0.12);
}

.ops-create-option--compact {
  min-height: 86px;
}

.ops-create-option__icon {
  font-size: 18px;
}

.ops-create-option__label {
  font-size: 13px;
  font-weight: 700;
}

.ops-create-option__hint {
  font-size: 11px;
  line-height: 1.45;
  color: #6b7a8a;
}

.ops-form__actions--split {
  justify-content: space-between;
}

.ops-modal {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: flex;
  justify-content: center;
  align-items: center;
}

.ops-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.3);
}

.ops-modal__content {
  position: relative;
  z-index: 1;
  width: min(860px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
}

.required-mark {
  color: #dc2626;
}

.ops-create__close {
  width: 34px;
  height: 34px;
  border: 1px solid #d7e1ee;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #425466;
  font-size: 16px;
  cursor: pointer;
  transition: 0.18s ease;
}

.ops-create__close:hover {
  background: #f3f6fb;
  border-color: #c5d2e4;
}

@media (max-width: 960px) {
  .ops-create__hero,
  .ops-create-card__header {
    flex-direction: column;
  }

  .ops-create__hero-side {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }

  .ops-create__grid,
  .ops-create__choice-grid--4 {
    grid-template-columns: 1fr;
  }

  .ops-form__actions--split {
    flex-direction: column;
  }
}
</style>
