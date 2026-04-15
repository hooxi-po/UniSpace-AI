<template>
  <div class="detail-card">
    <div class="detail-card__title">热水泵控制</div>
    <div class="detail-row">
      <select v-model="pumpForm.action" class="ops-input">
        <option value="open">开启热水泵</option>
        <option value="close">关闭热水泵</option>
        <option value="set_duration">设置时长</option>
      </select>
      <input v-model.number="pumpForm.durationMinutes" class="ops-input" type="number" min="1" placeholder="时长(分钟)" />
      <input v-model="pumpForm.actor" class="ops-input" placeholder="执行人" />
    </div>
    <input
      v-model="pumpForm.buildingIdsText"
      class="ops-input"
      placeholder="楼宇编码(逗号)，为空则使用当前影响楼宇"
    />
    <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="emit('submit')">执行批量控制</button>
    <div v-if="pumpUi.running" class="pump-progress">
      <div class="pump-progress__bar">
        <div class="pump-progress__inner" :style="{ width: `${pumpUi.progress}%` }" />
      </div>
      <div class="detail-kv detail-kv--minor">
        批量执行中：{{ pumpUi.completed }}/{{ pumpUi.total }}，倒计时 {{ pumpUi.countdown }}s
      </div>
    </div>
    <div v-for="item in detail.pumpControls.slice().reverse().slice(0, 6)" :key="item.id" class="detail-kv detail-kv--minor">
      {{ formatTime(item.executedAt) }} · {{ item.buildingName }} · {{ item.action }} · {{ item.result }}
      · {{ item.beforeStatus || '-' }} -> {{ item.afterStatus || '-' }}
      · 进度{{ item.progressPercent ?? 0 }}%
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import type { PumpFormState, PumpUiState } from './pipeline-ops-detail-types'

defineProps<{
  detail: PipelineWorkOrder
  pumpForm: PumpFormState
  pumpUi: PumpUiState
  submitting: boolean
  formatTime: (input?: string) => string
}>()

const emit = defineEmits<{
  (e: 'submit'): void
}>()
</script>
