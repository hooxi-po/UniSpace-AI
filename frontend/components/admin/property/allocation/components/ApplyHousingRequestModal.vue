<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal small" @click.stop>
      <div class="modalHeader">
        <div class="modalTitle">提交用房申请</div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>
      <div class="modalBody">
        <div class="formGrid">
          <div class="formItem">
            <label>申请部门 *</label>
            <input v-model="localForm.department" class="input" placeholder="请输入部门" />
          </div>
          <div class="formItem">
            <label>申请人 *</label>
            <input v-model="localForm.applicant" class="input" placeholder="请输入姓名" />
          </div>
          <div class="formItem">
            <label>联系电话</label>
            <input v-model="localForm.applicantPhone" class="input" placeholder="请输入电话" />
          </div>
          <div class="formItem">
            <label>申请面积 (m²) *</label>
            <input v-model.number="localForm.area" type="number" class="input" />
          </div>
          <div class="formItem">
            <label>用途类型 *</label>
            <select v-model="localForm.useType" class="select">
              <option value="Office">行政办公</option>
              <option value="Teaching">教学用房</option>
              <option value="Lab">科研实验室</option>
              <option value="Student">学生用房</option>
              <option value="Meeting">会议室</option>
              <option value="Storage">库房</option>
              <option value="Other">其他</option>
            </select>
          </div>
          <div class="formItem">
            <label>紧急程度</label>
            <select v-model="localForm.urgency" class="select">
              <option value="Normal">普通</option>
              <option value="Urgent">加急</option>
            </select>
          </div>
          <div class="formItem full">
            <label>申请理由 *</label>
            <textarea v-model="localForm.reason" class="textarea" placeholder="请详细说明用房原因"></textarea>
          </div>
        </div>
        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">取消</button>
          <button class="btnPrimary" :disabled="!isValid" @click="submit">提交申请</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { AllocationRequest } from '~/server/utils/allocation-db'

type Form = {
  department: string
  applicant: string
  applicantPhone: string
  area: number
  useType: AllocationRequest['useType']
  urgency: AllocationRequest['urgency']
  reason: string
}

const props = defineProps<{ form: Form }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: Form): void
}>()

const localForm = reactive<Form>({ ...props.form })

watch(
  () => props.form,
  (v) => {
    Object.assign(localForm, v)
  },
  { deep: true }
)

const isValid = computed(() => {
  return localForm.department.trim() && localForm.applicant.trim() && localForm.area > 0 && localForm.reason.trim()
})

function submit() {
  if (!isValid.value) return
  emit('submit', { ...localForm })
}
</script>

<style scoped>
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
}

.modal {
  width: 100%;
  max-width: 880px;
  max-height: 90vh;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.modal.small {
  max-width: 560px;
}

.modalHeader {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modalTitle {
  font-weight: 800;
  color: #1f2329;
}

.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.modalBody {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.formGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.formItem.full {
  grid-column: 1 / -1;
}

label {
  display: block;
  font-size: 12px;
  color: #646a73;
  margin-bottom: 6px;
}

.input,
.select,
.textarea {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.textarea {
  min-height: 110px;
}

.actions {
  margin-top: 4px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnPrimary {
  border: 1px solid #3370ff;
  background: #3370ff;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.btnPrimary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

