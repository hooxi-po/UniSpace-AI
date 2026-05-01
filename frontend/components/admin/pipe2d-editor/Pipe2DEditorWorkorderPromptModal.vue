<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { PipelineMedium, PipelineOrderType, PipelinePriority } from '~/types/pipeline-ops'

type WorkorderPromptPayload = {
  type: Extract<PipelineOrderType, 'maintenance' | 'retrofit'>
  title: string
  description: string
  area: string
  priority: PipelinePriority
  assignee: string
  reviewer: string
  plannedDate: string
  deadlineAt: string
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
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: WorkorderPromptPayload): void
}>()

const form = reactive<WorkorderPromptPayload>({
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
    form.type = 'retrofit'
    form.title = props.initialTitle
    form.description = props.initialDescription
    form.area = props.area
    form.priority = props.initialPriority
    form.assignee = ''
    form.reviewer = ''
    form.plannedDate = ''
    form.deadlineAt = ''
  },
  { immediate: true },
)

function handleConfirm() {
  emit('confirm', {
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
    area: form.area.trim(),
    assignee: form.assignee.trim(),
    reviewer: form.reviewer.trim(),
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

        <div class="workorder-prompt__choice-grid">
          <button
            class="workorder-prompt__type"
            :class="{ 'workorder-prompt__type--active': form.type === 'maintenance' }"
            type="button"
            @click="form.type = 'maintenance'"
          >
            <strong>维修工单</strong>
            <span>适合故障修复、应急处置和恢复执行</span>
          </button>
          <button
            class="workorder-prompt__type"
            :class="{ 'workorder-prompt__type--active': form.type === 'retrofit' }"
            type="button"
            @click="form.type = 'retrofit'"
          >
            <strong>改造工单</strong>
            <span>适合线路调整、结构变更和台账回写</span>
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
      </div>

      <div class="editor-modal__foot">
        <button class="btn btn--sm" type="button" :disabled="submitting" @click="emit('close')">仅保存拓扑</button>
        <button class="btn btn--primary" type="button" :disabled="submitting || !form.title.trim()" @click="handleConfirm">
          {{ submitting ? '创建中...' : '创建联动工单' }}
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

@media (max-width: 720px) {
  .editor-modal__head,
  .editor-modal__foot {
    flex-direction: column;
    align-items: stretch;
  }

  .workorder-prompt__choice-grid {
    grid-template-columns: 1fr;
  }

  .ops-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
