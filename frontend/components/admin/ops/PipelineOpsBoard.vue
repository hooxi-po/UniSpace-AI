<template>
  <div class="ops-board">
    <PipelineOpsOverviewSection
      :meta="meta"
      :loading="loading"
      :form-open="formOpen"
      :report-open="reportOpen"
      :feedback-text="feedbackText"
      :feedback-type="feedbackType"
      :stats="stats"
      :dashboard="dashboard"
      :realtime-enabled="realtimeEnabled"
      :last-update-time="lastUpdateTime"
      :format-time="formatTime"
      @refresh="refresh"
      @toggle-form="formOpen = !formOpen"
      @toggle-report="reportOpen = !reportOpen"
      @toggle-realtime="realtimeEnabled = $event"
      @dismiss-feedback="dismissFeedback"
      @filter-by-status="handleFilterByStatus"
    />

    <!-- 报表区域 -->
    <PipelineOpsReportSection
      v-if="reportOpen"
      :stats="stats"
      :dashboard="dashboard"
    />

    <!-- 异常预警监控 -->
    <PipelineOpsAlertMonitor
      :format-time="formatTime"
      @auto-create-success="handleAlertAutoCreateSuccess"
    />

    <PipelineOpsCreateSection
      :open="formOpen"
      :mode="mode"
      :submitting="submitting"
      :form="form"
      :auto-form="autoForm"
      @submit-create="submitCreate"
      @submit-auto-create="submitAutoCreate"
    />

    <PipelineOpsListSection
      v-model:page="page"
      v-model:query-status="queryStatus"
      v-model:query-area="queryArea"
      v-model:query-medium="queryMedium"
      v-model:query-priority="queryPriority"
      v-model:query-node-id="queryNodeId"
      v-model:query-building-id="queryBuildingId"
      v-model:query-assignee="queryAssignee"
      v-model:query-created-from="queryCreatedFrom"
      v-model:query-created-to="queryCreatedTo"
      v-model:query-keyword="queryKeyword"
      :loading="loading"
      :submitting="submitting"
      :list="list"
      :total-pages="totalPages"
      :total="total"
      :type-label="typeLabel"
      :source-label="sourceLabel"
      :status-label="statusLabel"
      :priority-label="priorityLabel"
      :action-text="actionText"
      :available-actions="availableActions"
      :format-time="formatTime"
      @open-detail="openDetail"
      @trigger-action="triggerAction"
      @locate-on-map="locateOnMap"
    />

    <PipelineOpsActionDialog
      :dialog="actionDialog"
      :submitting="submitting"
      @close="closeActionDialog"
      @confirm="submitActionDialog"
    />

    <PipelineOpsDetailPanel
      :open="detailOpen"
      :detail="detail"
      :submitting="submitting"
      :impact-form="impactForm"
      :log-form="logForm"
      :pump-form="pumpForm"
      :pump-ui="pumpUi"
      :inspection-form="inspectionForm"
      :timeline-entries="timelineEntries"
      :type-label="typeLabel"
      :status-label="statusLabel"
      :priority-label="priorityLabel"
      :medium-label="mediumLabel"
      :format-time="formatTime"
      @close="detailOpen = false"
      @locate="locateOnMap"
      @locate-building="locateBuildingOnMap"
      @submit-impact-adjust="submitImpactAdjust"
      @submit-log="submitLog"
      @submit-pump-control="submitPumpControl"
      @submit-inspection-record="submitInspectionRecord"
      @convert-inspection="convertInspection"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PipelineOpsActionDialog from './PipelineOpsActionDialog.vue'
import PipelineOpsCreateSection from './PipelineOpsCreateSection.vue'
import PipelineOpsDetailPanel from './PipelineOpsDetailPanel.vue'
import PipelineOpsListSection from './PipelineOpsListSection.vue'
import PipelineOpsOverviewSection from './PipelineOpsOverviewSection.vue'
import PipelineOpsReportSection from './PipelineOpsReportSection.vue'
import { usePipelineOpsBoardUi } from '~/composables/admin/usePipelineOpsBoardUi'
import { usePipelineOpsRealtime } from '~/composables/admin/usePipelineOpsRealtime'
import type { PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'
import {
  pipelineOpsActionText,
  pipelineOpsMediumLabel,
  pipelineOpsMetaMap,
  pipelineOpsPriorityLabel,
  pipelineOpsSourceLabel,
  pipelineOpsStatusLabel,
  pipelineOpsTypeLabel,
} from './pipeline-ops-view-constants'

const props = defineProps<{ mode: PipelineOpsBoardMode }>()
const mode = computed(() => props.mode)
const meta = computed(() => pipelineOpsMetaMap[props.mode])

const {
  loading,
  submitting,
  list,
  detail,
  stats,
  dashboard,
  page,
  total,
  totalPages,
  queryStatus,
  queryArea,
  queryMedium,
  queryPriority,
  queryNodeId,
  queryBuildingId,
  queryAssignee,
  queryCreatedFrom,
  queryCreatedTo,
  queryKeyword,
  refresh,
  loadDetail,
  formOpen,
  detailOpen,
  actionDialog,
  form,
  autoForm,
  impactForm,
  logForm,
  pumpForm,
  pumpUi,
  inspectionForm,
  feedbackText,
  feedbackType,
  timelineEntries,
  dismissFeedback,
  closeActionDialog,
  availableActions,
  triggerAction,
  submitActionDialog,
  submitCreate,
  submitAutoCreate,
  openDetail,
  submitImpactAdjust,
  submitLog,
  submitPumpControl,
  submitInspectionRecord,
  convertInspection,
  locateOnMap,
  locateBuildingOnMap,
  formatTime,
  showNotice,
} = usePipelineOpsBoardUi(props.mode)

const reportOpen = ref(false)
const realtimeEnabled = ref(false)

// 实时更新功能
const { lastUpdateTime } = usePipelineOpsRealtime({
  enabled: realtimeEnabled,
  interval: 30000, // 30秒轮询一次
  onUpdate: async () => {
    const activeDetailId = detailOpen.value ? detail.value?.id || '' : ''
    await refresh()
    if (!activeDetailId) return
    if (list.value.some(item => item.id === activeDetailId)) return
    try {
      await loadDetail(activeDetailId)
    } catch {
      // loadDetail already updates the shared error state
    }
  },
})

const typeLabel = pipelineOpsTypeLabel
const sourceLabel = pipelineOpsSourceLabel
const statusLabel = pipelineOpsStatusLabel
const mediumLabel = pipelineOpsMediumLabel
const priorityLabel = pipelineOpsPriorityLabel
const actionText = pipelineOpsActionText

function handleFilterByStatus(status: string) {
  queryStatus.value = status as any
  page.value = 1
}

function handleAlertAutoCreateSuccess(workorderId: string) {
  showNotice('success', `已自动创建工单: ${workorderId}`)
  refresh()
}
</script>
<style scoped src="./pipeline-ops-board.css"></style>
