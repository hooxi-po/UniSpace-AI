<template>
  <div v-if="open" class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialogHeader">
        <div class="dialogTitle">{{ mode === 'create' ? '发起入住申请' : '编辑入住申请' }}</div>
      </div>

      <div class="formGrid">
        <label class="field">
          <span>申请人</span>
          <input :value="form.applicantName" class="input" @input="update('applicantName', $event)" />
        </label>
        <label class="field">
          <span>宿舍类型</span>
          <select :value="form.applicantType" class="input" @change="update('applicantType', $event)">
            <option value="学生宿舍">学生宿舍</option>
            <option value="教师宿舍">教师宿舍</option>
          </select>
        </label>
        <label class="field">
          <span>学工号</span>
          <input :value="form.applicantNo" class="input" @input="update('applicantNo', $event)" />
        </label>
        <label class="field">
          <span>联系电话</span>
          <input :value="form.applicantPhone" class="input" @input="update('applicantPhone', $event)" />
        </label>
        <label class="field">
          <span>部门</span>
          <input :value="form.department" class="input" @input="update('department', $event)" />
        </label>
        <label class="field">
          <span>意向楼栋编码</span>
          <input :value="form.preferredBuildingCode" class="input" @input="update('preferredBuildingCode', $event)" />
        </label>
        <label class="field field--full">
          <span>备注</span>
          <textarea :value="form.note" class="input" rows="3" @input="update('note', $event)" />
        </label>
      </div>

      <div class="dialogActions">
        <button class="btn" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" :disabled="submitting || !form.applicantName.trim()" @click="$emit('submit')">
          {{ submitting ? '提交中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DormType } from '~/services/apartments'

defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  submitting: boolean
  form: {
    applicantName: string
    applicantNo: string
    applicantPhone: string
    applicantType: DormType
    department: string
    preferredBuildingCode: string
    note: string
  }
}>()

const emit = defineEmits<{
  close: []
  submit: []
  'update:field': [field: string, value: string]
}>()

function update(field: string, event: Event) {
  emit('update:field', field, (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value)
}
</script>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { width: min(720px, 94vw); background: #fff; border-radius: 12px; border: 1px solid var(--border, #dfe3ea); padding: 14px; display: grid; gap: 12px; }
.dialogHeader { border-bottom: 1px solid var(--border-light, #edf0f5); padding-bottom: 8px; }
.dialogTitle { font-size: 16px; font-weight: 700; }
.formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
.field--full { grid-column: 1 / -1; }
.input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #1f2329; }
.dialogActions { display: flex; justify-content: flex-end; gap: 8px; }
.btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
.btn--primary { background: #3370ff; border-color: #3370ff; color: #fff; }
</style>
