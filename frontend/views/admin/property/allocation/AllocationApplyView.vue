<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">申请用房</h2>
        <p class="subtitle">提交新的用房申请，提交后可在“用房审批”中查看进度。</p>
      </div>
    </div>

    <div class="formCard">
      <div class="formGrid">
        <div class="formItem">
          <label>申请部门 *</label>
          <input v-model="applyForm.department" class="input" placeholder="请输入部门" />
        </div>
        <div class="formItem">
          <label>申请人姓名 *</label>
          <input v-model="applyForm.applicant" class="input" placeholder="请输入姓名" />
        </div>
        <div class="formItem">
          <label>申请人工号/ID *</label>
          <input v-model="applyForm.applicantId" class="input" placeholder="请输入工号" />
        </div>
        <div class="formItem">
          <label>联系电话</label>
          <input v-model="applyForm.applicantPhone" class="input" placeholder="请输入电话" />
        </div>
        <div class="formItem">
          <label>申请面积 (m²) *</label>
          <input v-model.number="applyForm.area" type="number" class="input" />
        </div>
        <div class="formItem">
          <label>用途类型 *</label>
          <select v-model="applyForm.useType" class="select">
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
          <select v-model="applyForm.urgency" class="select">
            <option value="Normal">普通</option>
            <option value="Urgent">加急</option>
          </select>
        </div>
        <div class="formItem full">
          <label>申请理由 *</label>
          <textarea v-model="applyForm.reason" class="textarea" placeholder="请详细说明用房原因"></textarea>
        </div>
      </div>
      <div class="actions">
        <button class="btnPrimary" :disabled="!isApplyValid" @click="onApply">
          <Send :size="14" /> 提交申请
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Send } from 'lucide-vue-next'
import { useAllocationApproval } from '~/composables/useAllocationApproval'
import type { AllocationRequest } from '~/server/utils/allocation-db'

const { createRequest } = useAllocationApproval()

const applyForm = reactive({
  department: '',
  applicant: '',
  applicantId: '',
  applicantPhone: '',
  area: 0,
  useType: 'Office' as AllocationRequest['useType'],
  urgency: 'Normal' as AllocationRequest['urgency'],
  reason: ''
})

const isApplyValid = computed(() => {
  return applyForm.department.trim() && applyForm.applicant.trim() && applyForm.applicantId.trim() && applyForm.area > 0 && applyForm.reason.trim()
})

async function onApply() {
  await createRequest({ ...applyForm })
  alert('申请已提交')
  // 重置表单
  applyForm.department = ''
  applyForm.applicant = ''
  applyForm.applicantId = ''
  applyForm.applicantPhone = ''
  applyForm.area = 0
  applyForm.useType = 'Office'
  applyForm.urgency = 'Normal'
  applyForm.reason = ''
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  margin-bottom: 8px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: #646a73;
}

.formCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
}

.formGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.formItem.full {
  grid-column: 1 / -1;
}

label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1f2329;
  margin-bottom: 8px;
}

.input, .select, .textarea {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input:focus, .select:focus, .textarea:focus {
  border-color: #3370ff;
  outline: none;
}

.textarea {
  min-height: 120px;
  resize: vertical;
}

.actions {
  margin-top: 32px;
  display: flex;
  justify-content: flex-end;
}

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.btnPrimary:disabled {
  background: #f5f6f7;
  color: #8f959e;
  cursor: not-allowed;
}
</style>

