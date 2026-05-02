<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { PipelineMedium, PipelineOrderType, PipelinePriority, PipelineWorkOrder } from '~/types/pipeline-ops'

type WorkorderPromptPayload = {
  action: 'create' | 'link'
  workorderId?: string
  type?: PipelineOrderType
  title?: string
  description?: string
  area?: string
  priority?: PipelinePriority
  assignee?: string
  reviewer?: string
  plannedDate?: string
  deadlineAt?: string
}

type WorkorderTypeOption = {
  value: PipelineOrderType
  title: string
  description: string
}

type PromptImpactSummary = {
  buildingCount: number
  affectedUserCount: number
  estimatedImpactHours: number
  buildingNames: string[]
}

type PromptRecommendation = {
  type: PipelineOrderType
  title: string
  description: string
  priority: PipelinePriority
  reason: string
  confidence: number
}

const props = defineProps<{
  open: boolean
  submitting: boolean
  promptKind: 'selection' | 'topology' | 'asset-binding'
  featureName: string
  pipelineMedium: PipelineMedium
  area: string
  linkedBuildingNames: string[]
  summaryLines: string[]
  initialTitle: string
  initialDescription: string
  initialPriority: PipelinePriority
  availableTypes: WorkorderTypeOption[]
  relatedWorkorders: PipelineWorkOrder[]
  sourceWorkorderId?: string | null
  impactSummary?: PromptImpactSummary | null
  recommendation?: PromptRecommendation | null
  insightLoading?: boolean
  insightError?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: WorkorderPromptPayload): void
}>()

const form = reactive<WorkorderPromptPayload>({
  action: 'create',
  type: 'retrofit',
  title: '',
  description: '',
  area: '',
  priority: 'medium',
  assignee: '',
  reviewer: '',
  plannedDate: '',
  deadlineAt: '',
})

const selectedExistingWorkorderId = ref('')
const recommendationAutoApplied = ref(false)

const sourceWorkorderId = computed(() => String(props.sourceWorkorderId || '').trim())
const orderedRelatedWorkorders = computed(() => {
  return [...props.relatedWorkorders].sort((a, b) => {
    const aPriority = a.id === sourceWorkorderId.value ? 0 : 1
    const bPriority = b.id === sourceWorkorderId.value ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return String(b.updatedAt).localeCompare(String(a.updatedAt))
  })
})
const hasExistingWorkorders = computed(() => orderedRelatedWorkorders.value.length > 0)
const canConfirm = computed(() => {
  if (form.action === 'link') return Boolean(selectedExistingWorkorderId.value)
  return Boolean(form.title?.trim())
})

const workorderTypeLabel: Record<PipelineOrderType, string> = {
  inspection: '巡检',
  maintenance: '维修',
  retrofit: '改造',
  retire: '报废',
}

const workorderStatusLabel: Record<PipelineWorkOrder['status'], string> = {
  draft: '草稿',
  todo: '待办',
  assigned: '已分派',
  in_progress: '处理中',
  paused: '暂停',
  review: '待审核',
  completed: '已完成',
  closed: '已关闭',
  cancelled: '已取消',
  rejected: '已驳回',
}

const mediumLabel = computed(() => {
  if (props.pipelineMedium === 'water') return '供水'
  if (props.pipelineMedium === 'sewage') return '污水'
  if (props.pipelineMedium === 'drainage') return '排水'
  return '混合'
})

const headerTitle = computed(() => {
  if (props.promptKind === 'selection') return '已定位当前管道，可直接创建工单'
  if (props.promptKind === 'asset-binding') return '房产绑定已保存，可继续联动工单'
  return '保存成功，可继续联动工单'
})

const headerSubtitle = computed(() => {
  if (props.promptKind === 'selection') return `${props.featureName} 的资产上下文已自动带入`
  if (props.promptKind === 'asset-binding') return `${props.featureName} 的房产绑定变更已保存到服务端`
  return `${props.featureName} 的拓扑变更已保存到服务端`
})

function resolvePreferredExistingWorkorderId() {
  return orderedRelatedWorkorders.value.find(item => item.id === sourceWorkorderId.value)?.id
    || orderedRelatedWorkorders.value[0]?.id
    || ''
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.action = props.promptKind === 'selection' ? 'create' : (orderedRelatedWorkorders.value.length ? 'link' : 'create')
    form.type = props.availableTypes[0]?.value || 'retrofit'
    form.title = props.initialTitle
    form.description = props.initialDescription
    form.area = props.area
    form.priority = props.initialPriority
    form.assignee = ''
    form.reviewer = ''
    form.plannedDate = ''
    form.deadlineAt = ''
    recommendationAutoApplied.value = false
    selectedExistingWorkorderId.value = resolvePreferredExistingWorkorderId()
  },
  { immediate: true },
)

watch(
  [
    () => props.open,
    () => form.action,
    () => orderedRelatedWorkorders.value.map(item => item.id).join(','),
    sourceWorkorderId,
  ],
  ([open, action]) => {
    if (!open || action !== 'link') return
    const nextId = resolvePreferredExistingWorkorderId()
    if (!nextId) {
      selectedExistingWorkorderId.value = ''
      return
    }
    const hasCurrentSelection = orderedRelatedWorkorders.value.some(item => item.id === selectedExistingWorkorderId.value)
    if (!hasCurrentSelection || nextId === sourceWorkorderId.value) {
      selectedExistingWorkorderId.value = nextId
    }
  },
  { immediate: true },
)

watch(
  () => [props.open, props.recommendation, props.initialTitle, props.initialDescription, props.initialPriority] as const,
  ([open, recommendation, initialTitle, initialDescription, initialPriority]) => {
    if (!open || !recommendation || recommendationAutoApplied.value || form.action !== 'create') return
    const matchesInitialValues = form.title === initialTitle
      && form.description === initialDescription
      && form.priority === initialPriority
      && form.type === (props.availableTypes[0]?.value || 'retrofit')
    if (!matchesInitialValues) return
    applyRecommendation()
    recommendationAutoApplied.value = true
  },
  { immediate: true },
)

function handleConfirm() {
  if (form.action === 'link') {
    emit('confirm', {
      action: 'link',
      workorderId: selectedExistingWorkorderId.value,
    })
    return
  }

  emit('confirm', {
    action: 'create',
    type: form.type,
    title: form.title?.trim(),
    description: form.description?.trim(),
    area: form.area?.trim(),
    priority: form.priority,
    assignee: form.assignee?.trim(),
    reviewer: form.reviewer?.trim(),
    plannedDate: form.plannedDate,
    deadlineAt: form.deadlineAt,
  })
}

function applyRecommendation() {
  if (!props.recommendation) return
  form.action = 'create'
  form.type = props.recommendation.type
  form.title = props.recommendation.title
  form.description = props.recommendation.description
  form.priority = props.recommendation.priority
}
</script>

<template>
  <div v-if="open" class="editor-modal-mask" @click.self="emit('close')">
    <div class="editor-modal editor-modal--workorder">
      <div class="editor-modal__head">
        <div class="editor-modal__head-main">
          <div class="editor-modal__eyebrow">工单联动</div>
          <div class="editor-modal__title">{{ headerTitle }}</div>
          <div class="editor-modal__sub">{{ headerSubtitle }}</div>
        </div>
        <button class="btn btn--sm" type="button" :disabled="submitting" @click="emit('close')">稍后处理</button>
      </div>

      <div class="editor-modal__body editor-modal__body--workorder">
        <section class="workorder-prompt__section">
          <div class="workorder-prompt__section-title">业务定位</div>
          <div class="workorder-prompt__context-grid">
            <div class="workorder-prompt__context-item">
              <span>介质</span>
              <strong>{{ mediumLabel }}</strong>
            </div>
            <div class="workorder-prompt__context-item">
              <span>区域</span>
              <strong>{{ area || '未分区' }}</strong>
            </div>
            <div class="workorder-prompt__context-item workorder-prompt__context-item--wide">
              <span>关联楼宇</span>
              <strong>{{ linkedBuildingNames.length ? linkedBuildingNames.join('、') : '未识别' }}</strong>
            </div>
          </div>
        </section>

        <section class="workorder-prompt__section">
          <div class="workorder-prompt__section-title">联动摘要</div>
          <div class="workorder-prompt__summary">
            <div v-for="line in summaryLines" :key="line" class="workorder-prompt__summary-item">
              {{ line }}
            </div>
          </div>
        </section>

        <section v-if="insightLoading || insightError || impactSummary || recommendation" class="workorder-prompt__section">
          <div class="workorder-prompt__section-title">自动分析</div>

          <div v-if="insightLoading" class="workorder-prompt__empty-link">
            正在分析影响范围并推荐工单模板...
          </div>

          <div v-else-if="insightError" class="workorder-prompt__empty-link">
            {{ insightError }}
          </div>

          <div v-if="impactSummary" class="workorder-prompt__impact">
            <div class="workorder-prompt__impact-title">影响范围预分析</div>
            <div class="workorder-prompt__impact-grid">
              <div class="workorder-prompt__impact-item">
                <span>影响楼宇</span>
                <strong>{{ impactSummary.buildingCount }} 栋</strong>
              </div>
              <div class="workorder-prompt__impact-item">
                <span>预计影响人数</span>
                <strong>{{ impactSummary.affectedUserCount }} 人</strong>
              </div>
              <div class="workorder-prompt__impact-item">
                <span>预计影响时长</span>
                <strong>{{ impactSummary.estimatedImpactHours }} 小时</strong>
              </div>
            </div>
            <div v-if="impactSummary.buildingNames.length" class="workorder-prompt__context">
              <span
                v-for="name in impactSummary.buildingNames.slice(0, 6)"
                :key="name"
                class="token token--soft"
              >{{ name }}</span>
            </div>
          </div>

          <div v-if="recommendation" class="workorder-prompt__recommend">
            <div class="workorder-prompt__recommend-head">
              <div>
                <div class="workorder-prompt__recommend-title">推荐模板</div>
                <div class="workorder-prompt__recommend-reason">{{ recommendation.reason }}</div>
              </div>
              <button class="btn btn--sm" type="button" :disabled="submitting" @click="applyRecommendation">
                应用推荐
              </button>
            </div>
            <div class="workorder-prompt__recommend-meta">
              <span>{{ recommendation.title }}</span>
              <span>匹配度 {{ Math.round(recommendation.confidence * 100) }}%</span>
            </div>
          </div>
        </section>

        <section class="workorder-prompt__section">
          <div class="workorder-prompt__section-title">工单处理方式</div>
          <div class="workorder-prompt__action-switch">
            <button
              class="workorder-prompt__action-btn"
              :class="{ 'workorder-prompt__action-btn--active': form.action === 'create' }"
              type="button"
              @click="form.action = 'create'"
            >
              创建新工单
            </button>
            <button
              class="workorder-prompt__action-btn"
              :class="{ 'workorder-prompt__action-btn--active': form.action === 'link' }"
              type="button"
              :disabled="!hasExistingWorkorders"
              @click="form.action = 'link'"
            >
              关联已有工单
            </button>
          </div>
        </section>

        <template v-if="form.action === 'link'">
          <section class="workorder-prompt__section">
            <div class="workorder-prompt__section-title">选择已有工单</div>
            <div v-if="orderedRelatedWorkorders.length" class="workorder-prompt__existing-list">
              <label
                v-for="item in orderedRelatedWorkorders"
                :key="item.id"
                class="workorder-prompt__existing-item"
                :class="{ 'workorder-prompt__existing-item--source': item.id === sourceWorkorderId }"
              >
                <input
                  v-model="selectedExistingWorkorderId"
                  class="workorder-prompt__radio"
                  type="radio"
                  :value="item.id"
                >
                <span class="workorder-prompt__existing-body">
                  <strong>
                    {{ item.id }} · {{ item.title }}
                    <span v-if="item.id === sourceWorkorderId" class="workorder-prompt__source-badge">当前来源工单</span>
                  </strong>
                  <span>{{ workorderTypeLabel[item.type] }} · {{ workorderStatusLabel[item.status] }} · {{ item.updatedAt }}</span>
                </span>
              </label>
            </div>
            <div v-else class="workorder-prompt__empty-link">
              当前没有可关联的工单，请切换为新建工单。
            </div>
          </section>
        </template>

        <template v-else>
          <section class="workorder-prompt__section">
            <div class="workorder-prompt__section-title">工单信息</div>
            <div class="workorder-prompt__choice-grid">
              <button
                v-for="item in availableTypes"
                :key="item.value"
                class="workorder-prompt__type"
                :class="{ 'workorder-prompt__type--active': form.type === item.value }"
                type="button"
                @click="form.type = item.value"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ item.description }}</span>
              </button>
            </div>

            <div class="ops-form__row ops-form__row--aligned">
              <label class="ops-create-field">
                <span class="ops-create-field__label">工单标题</span>
                <input v-model="form.title" class="ops-input" placeholder="请输入工单标题" />
              </label>
              <label class="ops-create-field">
                <span class="ops-create-field__label">优先级</span>
                <select v-model="form.priority" class="ops-input">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </select>
              </label>
            </div>

            <label class="ops-create-field">
              <span class="ops-create-field__label">工单描述</span>
              <textarea
                v-model="form.description"
                class="ops-input workorder-prompt__textarea"
                rows="4"
                placeholder="补充本次变更原因、影响范围和处置目标"
              />
            </label>

            <div class="ops-form__row ops-form__row--aligned">
              <label class="ops-create-field">
                <span class="ops-create-field__label">区域</span>
                <input v-model="form.area" class="ops-input" placeholder="教学区 / 生活区 / 实验区" />
              </label>
              <label class="ops-create-field">
                <span class="ops-create-field__label">执行人</span>
                <input v-model="form.assignee" class="ops-input" placeholder="班组或人员" />
              </label>
            </div>

            <div class="ops-form__row ops-form__row--aligned">
              <label class="ops-create-field">
                <span class="ops-create-field__label">审核人</span>
                <input v-model="form.reviewer" class="ops-input" placeholder="审核人" />
              </label>
              <label class="ops-create-field">
                <span class="ops-create-field__label">计划日期</span>
                <input v-model="form.plannedDate" class="ops-input" type="date" />
              </label>
            </div>

            <label class="ops-create-field">
              <span class="ops-create-field__label">截止时间</span>
              <input v-model="form.deadlineAt" class="ops-input" type="datetime-local" />
            </label>
          </section>
        </template>
      </div>

      <div class="editor-modal__foot">
        <button class="btn btn--sm btn--ghost" type="button" :disabled="submitting" @click="emit('close')">稍后处理</button>
        <button class="btn btn--primary" type="button" :disabled="submitting || !canConfirm" @click="handleConfirm">
          {{ submitting ? '处理中...' : form.action === 'link' ? '关联到工单' : '创建联动工单' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-modal-mask {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  background: rgba(2, 6, 23, 0.38);
  backdrop-filter: blur(4px);
}

.editor-modal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-radius: 16px;
  border: 1px solid #d9e2ec;
  background: #f6f8fb;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
  color: #1f2937;
  overflow: hidden;
}

.editor-modal--workorder {
  width: min(1120px, calc(100vw - 48px), calc((100vh - 48px) * 16 / 9));
  height: min(720px, calc(100vh - 48px), calc((100vw - 48px) * 9 / 16));
  min-height: 560px;
  max-height: calc(100vh - 48px);
}

.editor-modal__head,
.editor-modal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5eaf0;
  background: #ffffff;
}

.editor-modal__foot {
  border-top: 1px solid #e5eaf0;
  border-bottom: none;
}

.editor-modal__head-main {
  display: grid;
  gap: 4px;
}

.editor-modal__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
}

.editor-modal__title {
  font-size: 18px;
  font-weight: 700;
}

.editor-modal__sub {
  font-size: 13px;
  color: #6b7280;
}

.editor-modal__body--workorder {
  display: grid;
  gap: 12px;
  padding: 18px 20px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.btn {
  height: 36px;
  border-radius: 8px;
  border: 1px solid #cfd8e3;
  background: #ffffff;
  color: #334155;
  padding: 0 14px;
  font-size: 13px;
}

.btn--primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.btn--ghost {
  background: #f8fafc;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ops-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ops-create-field {
  display: grid;
  gap: 8px;
}

.ops-create-field__label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.ops-input {
  width: 100%;
  min-height: 42px;
  border-radius: 8px;
  border: 1px solid #d7dee8;
  background: #ffffff;
  color: #1f2937;
  padding: 10px 12px;
  font-size: 14px;
}

.ops-input::placeholder {
  color: #94a3b8;
}

.workorder-prompt__section {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #dde5ee;
  background: #ffffff;
}

.workorder-prompt__section-title {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}

.token {
  height: 24px;
  border-radius: 999px;
  border: 1px solid #dbe7ff;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
}

.token--soft {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #475569;
}

.workorder-prompt__context {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workorder-prompt__context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.workorder-prompt__context-item {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.workorder-prompt__context-item span {
  font-size: 12px;
  color: #64748b;
}

.workorder-prompt__context-item strong {
  min-width: 0;
  font-size: 14px;
  line-height: 1.45;
  color: #1f2937;
}

.workorder-prompt__context-item--wide {
  grid-column: 1 / -1;
}

.workorder-prompt__summary {
  display: grid;
  gap: 8px;
}

.workorder-prompt__summary-item {
  position: relative;
  padding-left: 14px;
  color: #334155;
  font-size: 13px;
  line-height: 1.5;
}

.workorder-prompt__summary-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #2563eb;
}

.workorder-prompt__impact,
.workorder-prompt__recommend {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e5eaf0;
  background: #f8fafc;
}

.workorder-prompt__impact-title,
.workorder-prompt__recommend-title {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}

.workorder-prompt__recommend-reason {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.workorder-prompt__impact-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.workorder-prompt__impact-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #e5eaf0;
  background: #ffffff;
}

.workorder-prompt__impact-item span,
.workorder-prompt__recommend-meta {
  color: #64748b;
  font-size: 12px;
}

.workorder-prompt__impact-item strong {
  font-size: 15px;
  color: #0f172a;
}

.workorder-prompt__recommend-head,
.workorder-prompt__recommend-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workorder-prompt__choice-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workorder-prompt__action-switch {
  display: flex;
  gap: 10px;
}

.workorder-prompt__action-btn {
  flex: 1;
  min-height: 40px;
  border-radius: 8px;
  border: 1px solid #d7dee8;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
}

.workorder-prompt__action-btn--active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);
}

.workorder-prompt__type {
  display: grid;
  gap: 6px;
  padding: 14px;
  text-align: left;
  border-radius: 10px;
  border: 1px solid #d7dee8;
  background: #ffffff;
  color: #1f2937;
}

.workorder-prompt__type strong {
  font-size: 14px;
}

.workorder-prompt__type span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.workorder-prompt__type--active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
}

.workorder-prompt__textarea {
  min-height: 92px;
  resize: vertical;
}

.workorder-prompt__existing-list {
  display: grid;
  gap: 10px;
}

.workorder-prompt__existing-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #d7dee8;
  background: #ffffff;
}

.workorder-prompt__existing-item--source {
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);
}

.workorder-prompt__existing-body {
  display: grid;
  gap: 4px;
}

.workorder-prompt__existing-body strong {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}

.workorder-prompt__source-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #dbe7ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.workorder-prompt__existing-body span,
.workorder-prompt__empty-link {
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 720px) {
  .editor-modal-mask {
    padding: 12px;
  }

  .editor-modal--workorder {
    width: min(calc(100vw - 24px), calc((100vh - 24px) * 4 / 3));
    height: min(calc(100vh - 24px), calc((100vw - 24px) * 3 / 4));
    min-height: 0;
    max-height: calc(100vh - 24px);
  }

  .editor-modal__head,
  .editor-modal__foot {
    flex-direction: column;
    align-items: stretch;
  }

  .workorder-prompt__choice-grid {
    grid-template-columns: 1fr;
  }

  .workorder-prompt__context-grid {
    grid-template-columns: 1fr;
  }

  .workorder-prompt__action-switch {
    flex-direction: column;
  }

  .workorder-prompt__impact-grid,
  .workorder-prompt__recommend-head,
  .workorder-prompt__recommend-meta {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .ops-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
