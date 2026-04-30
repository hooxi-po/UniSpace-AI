<template>
  <div class="detail-card">
    <div class="detail-card__header">
      <div>
        <div class="detail-card__title">执行日志</div>
        <div class="detail-card__caption">时间轴与现场记录分开展示，便于快速回溯处置过程。</div>
      </div>
      <span class="detail-chip detail-chip--soft">{{ detail.executionLogs.length }} 条记录</span>
    </div>

    <div class="detail-card__sub-title">状态时间轴</div>
    <div v-if="timelineEntries.length" class="ops-timeline ops-timeline--rich">
      <div v-for="item in timelineEntries.slice(-10)" :key="item.id" class="ops-timeline__item ops-timeline__item--rich">
        <div class="ops-timeline__dot" />
        <div class="ops-timeline__content">
          <div class="detail-kv detail-kv--emphasis">{{ item.label }}</div>
          <div class="detail-kv detail-kv--minor">{{ item.content }}</div>
          <div class="detail-kv detail-kv--muted">{{ formatTime(item.createdAt) }}</div>
        </div>
      </div>
    </div>
    <div v-else class="detail-empty-state">暂无时间轴记录</div>

    <div class="detail-card__sub-title">最近现场记录</div>
    <div v-if="detail.executionLogs.length" class="detail-log-list">
      <div v-for="log in detail.executionLogs.slice().reverse().slice(0, 8)" :key="log.id" class="detail-log-item">
        <div class="detail-log-item__head">
          <span class="detail-chip detail-chip--ghost">{{ log.stage }}</span>
          <span class="detail-kv detail-kv--muted">{{ formatTime(log.createdAt) }}</span>
        </div>
        <div class="detail-kv detail-kv--emphasis">{{ log.actor || 'system' }}</div>
        <div class="detail-kv detail-kv--minor">{{ log.content }}</div>
        <div v-if="log.nodeId || log.location" class="detail-log-item__meta">
          <span v-if="log.nodeId">节点 {{ log.nodeId }}</span>
          <span v-if="log.location">坐标 {{ log.location.lng }}, {{ log.location.lat }}</span>
        </div>
      </div>
    </div>
    <div v-else class="detail-empty-state">暂无执行记录</div>

    <div class="detail-editor">
      <div class="detail-card__sub-title">新增执行日志</div>
      <label class="detail-field">
        <span class="detail-field__label">日志内容</span>
        <input v-model="logForm.content" class="ops-input" placeholder="填写本次处理动作、异常情况或通知结果" />
      </label>
      <div class="detail-row detail-row--triple">
        <label class="detail-field">
          <span class="detail-field__label">记录人</span>
          <input v-model="logForm.actor" class="ops-input" placeholder="记录人" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">日志类型</span>
          <select v-model="logForm.stage" class="ops-input">
            <option value="progress">过程记录</option>
            <option value="pause_or_exception">暂停/异常</option>
            <option value="acceptance">完成验收</option>
            <option value="notification">消息通知</option>
          </select>
        </label>
        <label class="detail-field">
          <span class="detail-field__label">节点 ID</span>
          <input v-model="logForm.nodeId" class="ops-input" placeholder="可选" />
        </label>
      </div>
      <div class="detail-row detail-row--triple">
        <label class="detail-field">
          <span class="detail-field__label">经度</span>
          <input v-model.number="logForm.lng" class="ops-input" type="number" step="0.000001" placeholder="可选" />
        </label>
        <label class="detail-field">
          <span class="detail-field__label">纬度</span>
          <input v-model.number="logForm.lat" class="ops-input" type="number" step="0.000001" placeholder="可选" />
        </label>
        <label class="detail-check detail-check--panel">
          <input v-model="logForm.mobile" type="checkbox" />
          <span>标记为移动端上传</span>
        </label>
      </div>
      <div class="detail-actions-inline">
        <button class="ops-btn ops-btn--primary" :disabled="submitting" @click="emit('submit')">写入日志</button>
      </div>
    </div>
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
