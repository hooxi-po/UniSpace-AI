<template>
  <div class="ops-board">
    <PipelineOpsOverviewSection
      :meta="meta"
      :loading="loading"
      :form-open="formOpen"
      :feedback-text="feedbackText"
      :feedback-type="feedbackType"
      :stats="stats"
      :dashboard="dashboard"
      @refresh="refresh"
      @toggle-form="formOpen = !formOpen"
      @dismiss-feedback="dismissFeedback"
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
      @submit-impact-adjust="submitImpactAdjust"
      @submit-log="submitLog"
      @submit-pump-control="submitPumpControl"
      @submit-inspection-record="submitInspectionRecord"
      @convert-inspection="convertInspection"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PipelineOpsActionDialog from './PipelineOpsActionDialog.vue'
import PipelineOpsCreateSection from './PipelineOpsCreateSection.vue'
import PipelineOpsDetailPanel from './PipelineOpsDetailPanel.vue'
import PipelineOpsListSection from './PipelineOpsListSection.vue'
import PipelineOpsOverviewSection from './PipelineOpsOverviewSection.vue'
import { usePipelineOpsBoardUi } from '~/composables/admin/usePipelineOpsBoardUi'
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
  queryNodeId,
  queryBuildingId,
  queryAssignee,
  queryCreatedFrom,
  queryCreatedTo,
  queryKeyword,
  refresh,
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
  formatTime,
} = usePipelineOpsBoardUi(props.mode)

const typeLabel = pipelineOpsTypeLabel
const sourceLabel = pipelineOpsSourceLabel
const statusLabel = pipelineOpsStatusLabel
const mediumLabel = pipelineOpsMediumLabel
const priorityLabel = pipelineOpsPriorityLabel
const actionText = pipelineOpsActionText
</script>
<style scoped src="./pipeline-ops-board.css"></style>
