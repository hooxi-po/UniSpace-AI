<template>
  <div class="card">
    <div class="cardHeader">
      <div>
        <h3 class="cardTitle">提交用房申请</h3>
        <p class="cardSubtitle">按部门与用途提交新增/调整用房需求，进入审批流程</p>
      </div>
    </div>

    <form class="grid" @submit.prevent="onSubmit">
      <label class="field">
        <span class="label">申请部门</span>
        <input v-model.trim="applyForm.department" class="input" placeholder="如：信息化中心" required />
      </label>

      <label class="field">
        <span class="label">申请人</span>
        <input v-model.trim="applyForm.applicant" class="input" placeholder="姓名" required />
      </label>

      <label class="field">
        <span class="label">工号</span>
        <input v-model.trim="applyForm.applicantId" class="input" placeholder="教工号/工号" required />
      </label>

      <label class="field">
        <span class="label">联系电话</span>
        <input v-model.trim="applyForm.applicantPhone" class="input" placeholder="手机号" required />
      </label>

      <label class="field">
        <span class="label">申请面积（m²）</span>
        <input v-model.number="applyForm.area" type="number" min="1" class="input" required />
      </label>

      <label class="field">
        <span class="label">用途类型</span>
        <select v-model="applyForm.useType" class="select">
          <option value="Office">行政办公</option>
          <option value="Teaching">教学用房</option>
          <option value="Lab">科研实验室</option>
          <option value="Student">学生用房</option>
          <option value="Meeting">会议室</option>
          <option value="Storage">库房</option>
        </select>
      </label>

      <label class="field field--full">
        <span class="label">申请理由</span>
        <textarea v-model.trim="applyForm.reason" class="textarea" rows="4" placeholder="请填写申请背景与用途说明" required />
      </label>

      <div class="actions field--full">
        <button class="btn btn--primary" :disabled="submitting" type="submit">
          <Send :size="16" />
          <span>{{ submitting ? '提交中...' : '提交申请' }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Send } from 'lucide-vue-next'
import { useAllocationApproval } from '~/composables/property/useAllocationApproval'
import type { AllocationRequest } from '~/server/utils/allocation-db'

const { createRequest } = useAllocationApproval()

const submitting = ref(false)

const applyForm = reactive({
  department: '',
  applicant: '',
  applicantId: '',
  applicantPhone: '',
  area: 0,
  useType: 'Office' as AllocationRequest['useType'],
  urgency: 'Normal' as AllocationRequest['urgency'],
  reason: '',
})

function resetForm() {
  applyForm.department = ''
  applyForm.applicant = ''
  applyForm.applicantId = ''
  applyForm.applicantPhone = ''
  applyForm.area = 0
  applyForm.useType = 'Office'
  applyForm.urgency = 'Normal'
  applyForm.reason = ''
}

async function onSubmit() {
  if (submitting.value) return

  submitting.value = true
  try {
    await createRequest({
      department: applyForm.department,
      applicant: applyForm.applicant,
      applicantId: applyForm.applicantId,
      applicantPhone: applyForm.applicantPhone,
      area: applyForm.area,
      useType: applyForm.useType,
      urgency: applyForm.urgency,
      reason: applyForm.reason,
    })
    resetForm()
    alert('申请已提交，等待审批')
  } catch (e: any) {
    alert(e?.statusMessage || e?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  padding: 16px;
}

.cardHeader {
  margin-bottom: 16px;
}

.cardTitle {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.cardSubtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
}

.field--full {
  grid-column: 1 / -1;
}

.label {
  font-size: 12px;
  color: var(--muted);
}

.input,
.select,
.textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  outline: none;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
</style>
