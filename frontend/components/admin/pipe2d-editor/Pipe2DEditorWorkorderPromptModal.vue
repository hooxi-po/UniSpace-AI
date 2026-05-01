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

const props = defineProps<{
  open: boolean
  submitting: boolean
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

const hasExistingWorkorders = computed(() => props.relatedWorkorders.length > 0)
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

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.action = props.relatedWorkorders.length ? 'link' : 'create'
    form.type = props.availableTypes[0]?.value || 'retrofit'
    form.title = props.initialTitle
    form.description = props.initialDescription
    form.area = props.area
    form.priority = props.initialPriority
    form.assignee = ''
    form.reviewer = ''
    form.plannedDate = ''
    form.deadlineAt = ''
    selectedExistingWorkorderId.value = props.relatedWorkorders[0]?.id || ''
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
</script>

<template>
  <div v-if="open" class="editor-modal-mask" @click.self="emit('close')">
    <div class="editor-modal editor-modal--workorder">
      <div class="editor-modal__head">
        <div>
          <div class="editor-modal__title">保存成功，可继续联动工单</div>
          <div class="editor-modal__sub">{{ featureName }} 的拓扑变更已保存到服务端</div>
        </div>
        <button class="btn btn--sm" type="button" :disabled="submitting" @click="emit('close')">稍后处理</button>
      </div>

      <div class="editor-modal__body editor-modal__body--workorder">
        <div class="workorder-prompt__context">
          <span class="token">{{ mediumLabel }}</span>
          <span v-if="area" class="token">{{ area }}</span>
          <span v-for="name in linkedBuildingNames.slice(0, 3)" :key="name" class="token token--soft">{{ name }}</span>
        </div>

        <div class="workorder-prompt__summary">
          <div v-for="line in summaryLines" :key="line" class="workorder-prompt__summary-item">
            {{ line }}
          </div>
        </div>

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

        <template v-if="form.action === 'link'">
          <div v-if="relatedWorkorders.length" class="workorder-prompt__existing-list">
            <label
              v-for="item in relatedWorkorders"
              :key="item.id"
              class="workorder-prompt__existing-item"
            >
              <input
                v-model="selectedExistingWorkorderId"
                class="workorder-prompt__radio"
                type="radio"
                :value="item.id"
              >
              <span class="workorder-prompt__existing-body">
                <strong>{{ item.id }} · {{ item.title }}</strong>
                <span>{{ workorderTypeLabel[item.type] }} · {{ workorderStatusLabel[item.status] }} · {{ item.updatedAt }}</span>
              </span>
            </label>
          </div>
          <div v-else class="workorder-prompt__empty-link">
            当前没有可关联的工单，请切换为新建工单。
          </div>
        </template>

        <template v-else>
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
        </template>
      </div>

      <div class="editor-modal__foot">
        <button class="btn btn--sm" type="button" :disabled="submitting" @click="emit('close')">仅保存拓扑</button>
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
  background: rgba(2, 6, 23, 0.38);
  backdrop-filter: blur(4px);
}

.editor-modal {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.92));
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.45);
  color: #e2e8f0;
  overflow: hidden;
}

.editor-modal--workorder {
  width: min(720px, calc(100vw - 40px));
}

.editor-modal__head,
.editor-modal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.editor-modal__foot {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  border-bottom: none;
}

.editor-modal__title {
  font-size: 18px;
  font-weight: 700;
}

.editor-modal__sub {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(148, 163, 184, 0.92);
}

.editor-modal__body--workorder {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.btn {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(30, 41, 59, 0.88);
  color: #e2e8f0;
  padding: 0 14px;
  font-size: 13px;
}

.btn--primary {
  border-color: rgba(34, 211, 238, 0.28);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.92), rgba(34, 197, 94, 0.88));
  color: #f8fafc;
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
  color: rgba(148, 163, 184, 0.92);
}

.ops-input {
  width: 100%;
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  padding: 10px 12px;
  font-size: 14px;
}

.ops-input::placeholder {
  color: rgba(100, 116, 139, 0.9);
}

.token {
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  background: rgba(8, 47, 73, 0.82);
  color: #7dd3fc;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
}

.token--soft {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(30, 41, 59, 0.88);
  color: #cbd5e1;
}

.workorder-prompt__context {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workorder-prompt__summary {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.workorder-prompt__summary-item {
  color: rgba(226, 232, 240, 0.84);
  font-size: 13px;
  line-height: 1.5;
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
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  font-size: 13px;
}

.workorder-prompt__action-btn--active {
  border-color: rgba(34, 211, 238, 0.56);
  color: #f8fafc;
  box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.24);
}

.workorder-prompt__type {
  display: grid;
  gap: 6px;
  padding: 14px;
  text-align: left;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
}

.workorder-prompt__type strong {
  font-size: 14px;
}

.workorder-prompt__type span {
  color: rgba(148, 163, 184, 0.92);
  font-size: 12px;
  line-height: 1.45;
}

.workorder-prompt__type--active {
  border-color: rgba(34, 211, 238, 0.56);
  box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.24);
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
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
}

.workorder-prompt__existing-body {
  display: grid;
  gap: 4px;
}

.workorder-prompt__existing-body strong {
  font-size: 13px;
}

.workorder-prompt__existing-body span,
.workorder-prompt__empty-link {
  color: rgba(148, 163, 184, 0.92);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 720px) {
  .editor-modal__head,
  .editor-modal__foot {
    flex-direction: column;
    align-items: stretch;
  }

  .workorder-prompt__choice-grid {
    grid-template-columns: 1fr;
  }

  .workorder-prompt__action-switch {
    flex-direction: column;
  }

  .ops-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
