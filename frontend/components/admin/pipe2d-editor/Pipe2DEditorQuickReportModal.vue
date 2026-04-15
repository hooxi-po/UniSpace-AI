<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

export type QuickReportDraft = {
  faultType: 'leak' | 'burst' | 'blockage' | 'other'
  severity: 'low' | 'medium' | 'high'
  note: string
}

const props = defineProps<{
  visible: boolean
  pipeName: string
  locationText: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: QuickReportDraft): void
}>()

const form = reactive<QuickReportDraft>({
  faultType: 'leak',
  severity: 'medium',
  note: '',
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  form.faultType = 'leak'
  form.severity = 'medium'
  form.note = ''
})

const submitDisabled = computed(() => props.submitting)
</script>

<template>
  <div v-if="visible" class="editor-modal-mask" @click.self="emit('close')">
    <div class="editor-modal">
      <div class="editor-modal__head">
        <div>
          <div class="editor-modal__title">快速故障标注</div>
          <div class="editor-modal__sub">{{ pipeName }} · {{ locationText }}</div>
        </div>
      </div>

      <div class="editor-modal__body form-grid">
        <label class="field">
          <span>故障类型</span>
          <select v-model="form.faultType" class="field__control">
            <option value="leak">漏水</option>
            <option value="burst">破裂</option>
            <option value="blockage">堵塞</option>
            <option value="other">其他</option>
          </select>
        </label>

        <label class="field">
          <span>严重程度</span>
          <select v-model="form.severity" class="field__control">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </label>

        <label class="field field--full">
          <span>备注</span>
          <textarea
            v-model="form.note"
            class="field__control field__control--textarea"
            rows="4"
            maxlength="240"
            placeholder="可填写现场现象、是否影响楼栋、临时处理说明"
          />
        </label>
      </div>

      <div class="editor-modal__foot">
        <button class="btn btn--sm" type="button" :disabled="submitDisabled" @click="emit('close')">取消</button>
        <button class="btn btn--danger" type="button" :disabled="submitDisabled" @click="emit('submit', { ...form })">
          {{ submitting ? '提交中...' : '提交故障' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-modal-mask {
  position: absolute;
  inset: 0;
  z-index: 26;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(6px);
}

.editor-modal {
  width: min(560px, calc(100vw - 48px));
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.editor-modal__head,
.editor-modal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
}

.editor-modal__body {
  padding: 0 20px 20px;
}

.editor-modal__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.editor-modal__sub {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
}

.field--full {
  grid-column: 1 / -1;
}

.field__control {
  width: 100%;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  color: #0f172a;
  background: #fff;
}

.field__control--textarea {
  resize: vertical;
  min-height: 104px;
}

.editor-modal__foot {
  border-top: 1px solid #e2e8f0;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
