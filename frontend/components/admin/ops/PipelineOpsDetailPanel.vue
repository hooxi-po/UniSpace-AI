<template>
  <div v-if="open && detail" class="detail-mask" @click.self="emit('close')">
    <div class="detail-panel">
      <div class="detail-panel__hero">
        <div class="detail-panel__hero-header">
          <div class="detail-panel__hero-main">
            <div class="detail-panel__badges">
              <span class="detail-badge detail-badge--neutral">{{ detail.id }}</span>
              <span class="detail-badge detail-badge--type">{{ typeLabel[detail.type] }}</span>
              <span class="detail-badge detail-badge--status" :class="`detail-badge--status-${detail.status}`">{{ statusLabel[detail.status] }}</span>
              <span class="detail-badge detail-badge--priority" :class="`detail-badge--priority-${detail.priority}`">{{ priorityLabel[detail.priority] }}</span>
              <span class="detail-badge detail-badge--medium" :class="`detail-badge--medium-${detail.pipelineMedium}`">{{ mediumLabel[detail.pipelineMedium] }}</span>
            </div>
            <h3>{{ detail.title }}</h3>
            <p class="detail-panel__desc">{{ detail.description || '暂无工单描述，建议补充现场背景、影响范围和处置目标。' }}</p>
          </div>
          <div class="detail-actions">
            <button class="ops-btn ops-btn--hero" @click="emit('locate', detail)">三维定位</button>
            <button class="ops-btn ops-btn--hero" @click="emit('open-pipe-editor', detail)">管网二维运维工作台</button>
            <button class="ops-btn" @click="emit('close')">关闭</button>
          </div>
        </div>

        <div class="detail-meta-grid">
          <div class="detail-meta-card">
            <span class="detail-meta-card__label">责任人</span>
            <span class="detail-meta-card__value">{{ detail.assignee || '待分配' }}</span>
          </div>
          <div class="detail-meta-card">
            <span class="detail-meta-card__label">审核人</span>
            <span class="detail-meta-card__value">{{ detail.reviewer || '未设置' }}</span>
          </div>
          <div class="detail-meta-card">
            <span class="detail-meta-card__label">所属区域</span>
            <span class="detail-meta-card__value">{{ detail.area || '未分区' }}</span>
          </div>
          <div class="detail-meta-card">
            <span class="detail-meta-card__label">创建人</span>
            <span class="detail-meta-card__value">{{ detail.createdBy || 'admin-ui' }}</span>
          </div>
        </div>

        <div class="detail-summary-grid">
          <div class="detail-summary-card">
            <div class="detail-summary-card__label">影响楼宇</div>
            <div class="detail-summary-card__value">{{ impactedBuildingsCount }}</div>
          </div>
          <div class="detail-summary-card">
            <div class="detail-summary-card__label">影响房间</div>
            <div class="detail-summary-card__value">{{ impactedRoomsCount }}</div>
          </div>
          <div class="detail-summary-card">
            <div class="detail-summary-card__label">执行日志</div>
            <div class="detail-summary-card__value">{{ detail.executionLogs.length }}</div>
          </div>
          <div class="detail-summary-card">
            <div class="detail-summary-card__label">泵控记录</div>
            <div class="detail-summary-card__value">{{ detail.pumpControls.length }}</div>
          </div>
        </div>
      </div>

      <div class="detail-layout">
        <div class="detail-layout__main">
          <div class="detail-card detail-card--overview">
            <div class="detail-card__title">工单概览</div>
            <div class="detail-overview-grid">
              <div class="detail-overview-block">
                <div class="detail-overview-block__title">业务信息</div>
                <div class="detail-kv-list">
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">结果摘要</span>
                    <span class="detail-kv-item__value">{{ detail.resultSummary || '尚未填写' }}</span>
                  </div>
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">避让要求</span>
                    <span class="detail-kv-item__value">{{ detail.impactScope.bypassRequirement || '暂无避让要求' }}</span>
                  </div>
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">关联工单</span>
                    <span class="detail-kv-item__value">{{ detail.linkedWorkorderIds.join('、') || '无' }}</span>
                  </div>
                </div>
              </div>

              <div class="detail-overview-block">
                <div class="detail-overview-block__title">时间节点</div>
                <div class="detail-kv-list">
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">计划日期</span>
                    <span class="detail-kv-item__value">{{ formatTime(detail.plannedDate) }}</span>
                  </div>
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">截止时间</span>
                    <span class="detail-kv-item__value">{{ formatTime(detail.deadlineAt) }}</span>
                  </div>
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">开始执行</span>
                    <span class="detail-kv-item__value">{{ formatTime(detail.startedAt) }}</span>
                  </div>
                  <div class="detail-kv-item">
                    <span class="detail-kv-item__label">最近更新</span>
                    <span class="detail-kv-item__value">{{ formatTime(detail.updatedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="detail-overview-block">
              <div class="detail-overview-block__title">拓扑链路</div>
              <div v-if="detail.topologyChain.length" class="detail-topology-chain">
                <span v-for="node in detail.topologyChain" :key="node" class="detail-topology-node">{{ node }}</span>
              </div>
              <div v-else class="detail-empty-state detail-empty-state--inline">当前工单未绑定节点或管段。</div>
            </div>
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
        </div>

        <div class="detail-layout__side">
          <div class="detail-card detail-card--compact">
            <div class="detail-card__title">责任与状态</div>
            <div class="detail-kv-list">
              <div class="detail-kv-item">
                <span class="detail-kv-item__label">当前状态</span>
                <span class="detail-kv-item__value">{{ statusLabel[detail.status] }}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-kv-item__label">执行人</span>
                <span class="detail-kv-item__value">{{ detail.assignee || '待分配' }}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-kv-item__label">审核人</span>
                <span class="detail-kv-item__value">{{ detail.reviewer || '未设置' }}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-kv-item__label">人工调整</span>
                <span class="detail-kv-item__value">{{ detail.impactScope.manualAdjusted ? '已调整' : '自动推断' }}</span>
              </div>
            </div>
          </div>

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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

const props = defineProps<{
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
  (e: 'open-pipe-editor', detail: PipelineWorkOrder): void
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

const impactedBuildingsCount = computed(() => props.detail?.impactScope.impactedBuildings.length || 0)
const impactedRoomsCount = computed(() =>
  props.detail?.impactScope.impactedBuildings.reduce((sum, building) => sum + building.rooms.length, 0) || 0,
)
</script>
