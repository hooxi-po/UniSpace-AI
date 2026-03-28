<template>
  <div class="detail-card">
    <div class="detail-card__title">执行日志</div>
    <div class="detail-card__sub-title">状态时间轴</div>
    <div class="ops-timeline">
      <div v-for="item in timelineEntries.slice(-10)" :key="item.id" class="ops-timeline__item">
        <div class="ops-timeline__dot" />
        <div class="ops-timeline__content">
          <div class="detail-kv">{{ item.label }} · {{ formatTime(item.createdAt) }}</div>
          <div class="detail-kv detail-kv--minor">{{ item.content }}</div>
        </div>
      </div>
    </div>
    <div v-for="log in detail.executionLogs.slice().reverse().slice(0, 8)" :key="log.id" class="detail-block">
      <div class="detail-kv">{{ formatTime(log.createdAt) }} · {{ log.stage }} · {{ log.actor }}</div>
      <div class="detail-kv detail-kv--minor">{{ log.content }}</div>
    </div>
    <div class="detail-card__sub-title">新增执行日志</div>
    <input v-model="logForm.content" class="ops-input" placeholder="执行日志内容" />
    <div class="detail-row">
      <input v-model="logForm.actor" class="ops-input" placeholder="记录人" />
      <select v-model="logForm.stage" class="ops-input">
        <option value="progress">过程记录</option>
        <option value="pause_or_exception">暂停/异常</option>
        <option value="acceptance">完成验收</option>
        <option value="notification">消息通知</option>
      </select>
      <input v-model="logForm.nodeId" class="ops-input" placeholder="节点ID(可选)" />
    </div>
    <div class="detail-row">
      <input v-model.number="logForm.lng" class="ops-input" type="number" step="0.000001" placeholder="经度(可选)" />
      <input v-model.number="logForm.lat" class="ops-input" type="number" step="0.000001" placeholder="纬度(可选)" />
      <label class="detail-check"><input v-model="logForm.mobile" type="checkbox" />移动端上传</label>
    </div>
    <button class="ops-btn ops-btn--mini" :disabled="submitting" @click="emit('submit')">写入日志</button>
  </div>
</template>

<script setup lang="ts">
import type { PipelineWorkOrder } from '~/types/pipeline-ops'
import type { LogFormState, TimelineEntry } from './pipeline-ops-detail-types'

defineProps<{
  detail: PipelineWorkOrder
  logForm: LogFormState
  timelineEntries: TimelineEntry[]
  submitting: boolean
  formatTime: (input?: string) => string
}>()

const emit = defineEmits<{
  (e: 'submit'): void
}>()
</script>
