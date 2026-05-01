<template>
  <div class="detail-card">
    <div class="detail-card__header">
      <div>
        <div class="detail-card__title">泵控联动</div>
        <div class="detail-card__caption">支持按影响楼宇批量下发泵控动作，联动记录会自动写入工单。</div>
      </div>
      <span class="detail-chip detail-chip--soft">{{ detail.pumpControls.length }} 次联动</span>
    </div>

    <div class="detail-editor">
      <div class="detail-row detail-row--triple">
        <label class="detail-field">
          <span class="detail-field__label">控制动作</span>
          <select v-model="pumpForm.action" class="ops-input">
            <option value="open">开启热水泵</option>
            <option value="close">关闭热水泵</option>
            <option value="set_duration">设置时长</option>
          </select>
        </label>
        <label class="detail-field">
          <span class="detail-field__label">时长(分钟)</span>
          <input v-model.number="pumpForm.durationMinutes" class="ops-input" type="number" min="1" placeholder="仅定时动作需要" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">执行人</span>
          <input v-model="pumpForm.actor" class="ops-input" placeholder="执行人" />
        </label>
      </div>

      <label class="detail-field">
        <span class="detail-field__label">目标楼宇</span>
        <input
          v-model="pumpForm.buildingIdsText"
          class="ops-input"
          placeholder="楼宇编码(逗号分隔)，为空则使用当前影响楼宇"
        />
      </label>

      <div class="detail-actions-inline">
        <button class="ops-btn ops-btn--primary" :disabled="submitting" @click="emit('submit')">执行批量控制</button>
      </div>
    </div>

    <div v-if="pumpUi.running" class="pump-progress">
      <div class="pump-progress__bar">
        <div class="pump-progress__inner" :style="{ width: `${pumpUi.progress}%` }" />
      </div>
      <div class="detail-kv detail-kv--minor detail-kv--muted">
        批量执行中：{{ pumpUi.completed }}/{{ pumpUi.total }}，倒计时 {{ pumpUi.countdown }}s
      </div>
    </div>

    <div class="detail-card__sub-title">最近联动记录</div>
    <div v-if="detail.pumpControls.length" class="detail-log-list">
      <div v-for="item in detail.pumpControls.slice().reverse().slice(0, 6)" :key="item.id" class="detail-log-item">
        <div class="detail-log-item__head">
          <span class="detail-chip detail-chip--ghost">{{ item.action }}</span>
          <span class="detail-kv detail-kv--muted">{{ formatTime(item.executedAt) }}</span>
        </div>
        <div class="detail-kv detail-kv--emphasis">{{ item.buildingName }}</div>
        <div class="detail-kv detail-kv--minor">
          {{ item.beforeStatus || '-' }} -> {{ item.afterStatus || '-' }} · 结果 {{ item.result }}
        </div>
        <div class="detail-log-item__meta">
          <span>执行人 {{ item.executedBy }}</span>
          <span>进度 {{ item.progressPercent ?? 0 }}%</span>
        </div>
      </div>
    </div>
    <div v-else class="detail-empty-state">暂无泵控联动记录</div>
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
