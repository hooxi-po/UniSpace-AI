<template>
  <div v-if="open && detail" class="detail-mask" @click.self="emit('close')">
    <div class="detail-panel">
      <div class="detail-panel__header">
        <div>
          <h3>{{ detail.title }}</h3>
          <div class="detail-sub">{{ detail.id }} · {{ typeLabel[detail.type] }} · {{ statusLabel[detail.status] }}</div>
        </div>
        <div class="detail-actions">
          <button class="ops-btn" @click="emit('locate', detail)">三维定位</button>
          <button class="ops-btn" @click="emit('close')">关闭</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-card">
          <div class="detail-card__title">基本信息</div>
          <div class="detail-kv">描述: {{ detail.description || '-' }}</div>
          <div class="detail-kv">
            优先级:
            <span class="priority-badge" :class="`priority-badge--${detail.priority}`">
              <span class="priority-badge__dot"></span>
              {{ priorityLabel[detail.priority] }}
            </span>
          </div>
          <div class="detail-kv">管网介质: {{ mediumLabel[detail.pipelineMedium] }}</div>
          <div class="detail-kv">区域: {{ detail.area }}</div>
          <div class="detail-kv">拓扑链路: {{ detail.topologyChain.join(' -> ') || '-' }}</div>
          <div class="detail-kv">避让要求: {{ detail.impactScope.bypassRequirement || '-' }}</div>
        </div>

        <PipelineOpsImpactCard
          :detail="detail"
          :impact-form="impactForm"
          :submitting="submitting"
          :format-time="formatTime"
          @submit="emit('submit-impact-adjust')"
          @locate-building="handleLocateBuilding"
        />

        <PipelineOpsLogsCard
          :detail="detail"
          :log-form="logForm"
          :timeline-entries="timelineEntries"
          :submitting="submitting"
          :format-time="formatTime"
          @submit="emit('submit-log')"
        />

        <PipelineOpsPumpCard
          :detail="detail"
          :pump-form="pumpForm"
          :pump-ui="pumpUi"
          :submitting="submitting"
          :format-time="formatTime"
          @submit="emit('submit-pump-control')"
        />

        <PipelineOpsInspectionCard
          :detail="detail"
          :inspection-form="inspectionForm"
          :submitting="submitting"
          @submit-record="emit('submit-inspection-record')"
          @convert="emit('convert-inspection')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PipelineOpsImpactCard from './PipelineOpsImpactCard.vue'
import PipelineOpsInspectionCard from './PipelineOpsInspectionCard.vue'
import PipelineOpsLogsCard from './PipelineOpsLogsCard.vue'
import PipelineOpsPumpCard from './PipelineOpsPumpCard.vue'
import type {
  PipelineMedium,
  PipelineOrderStatus,
  PipelineOrderType,
  PipelinePriority,
  PipelineWorkOrder,
} from '~/types/pipeline-ops'
import type {
  ImpactFormState,
  InspectionFormState,
  LogFormState,
  PumpFormState,
  PumpUiState,
  TimelineEntry,
} from './pipeline-ops-detail-types'

defineProps<{
  open: boolean
  detail: PipelineWorkOrder | null
  submitting: boolean
  impactForm: ImpactFormState
  logForm: LogFormState
  pumpForm: PumpFormState
  pumpUi: PumpUiState
  inspectionForm: InspectionFormState
  timelineEntries: TimelineEntry[]
  typeLabel: Record<PipelineOrderType, string>
  statusLabel: Record<PipelineOrderStatus, string>
  priorityLabel: Record<PipelinePriority, string>
  mediumLabel: Record<PipelineMedium, string>
  formatTime: (input?: string) => string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locate', detail: PipelineWorkOrder): void
  (e: 'locate-building', buildingId: string): void
  (e: 'submit-impact-adjust'): void
  (e: 'submit-log'): void
  (e: 'submit-pump-control'): void
  (e: 'submit-inspection-record'): void
  (e: 'convert-inspection'): void
}>()

function handleLocateBuilding(buildingId: string) {
  emit('locate-building', buildingId)
}
</script>
