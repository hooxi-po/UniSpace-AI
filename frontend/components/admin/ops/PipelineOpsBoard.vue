<template>
  <div class="ops-board">
    <div
      v-if="feedbackText"
      :class="['ops-notice', `ops-notice--${feedbackType}`]"
    >
      <span>{{ feedbackText }}</span>
      <button class="ops-notice__close" type="button" @click="dismissFeedback">知道了</button>
    </div>

    <div v-if="formOpen" class="detail-mask detail-mask--center" @click.self="formOpen = false">
      <div class="ops-create-dialog">
        <PipelineOpsCreateSection
          :open="formOpen"
          :mode="mode"
          :submitting="submitting"
          :form="form"
          :auto-form="autoForm"
          @close="formOpen = false"
          @submit-create="submitCreate"
          @submit-auto-create="submitAutoCreate"
        />
      </div>
    </div>

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
      @close="closeDetail"
      @locate="locateOnMap"
      @open-pipe-editor="openPipeEditorFromWorkorder"
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
import { computed } from 'vue'
import PipelineOpsActionDialog from './PipelineOpsActionDialog.vue'
import PipelineOpsCreateSection from './PipelineOpsCreateSection.vue'
import PipelineOpsDetailPanel from './PipelineOpsDetailPanel.vue'
import PipelineOpsListSection from './PipelineOpsListSection.vue'
import { usePipelineOpsBoardUi } from '~/composables/admin/usePipelineOpsBoardUi'
import type { PipelineOpsBoardMode } from '~/composables/admin/usePipelineOpsBoard'
import {
  pipelineOpsActionText,
  pipelineOpsMediumLabel,
  pipelineOpsPriorityLabel,
  pipelineOpsSourceLabel,
  pipelineOpsStatusLabel,
  pipelineOpsTypeLabel,
} from './pipeline-ops-view-constants'

const props = defineProps<{
  mode: PipelineOpsBoardMode
  realtimeEnabled?: boolean
}>()
const mode = computed(() => props.mode)

const {
  loading,
  submitting,
  list,
  detail,
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
  closeDetail,
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
  openPipeEditorFromWorkorder,
  locateBuildingOnMap,
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
