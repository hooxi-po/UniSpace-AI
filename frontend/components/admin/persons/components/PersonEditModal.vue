<template>
  <div v-if="isOpen && person" class="modal-mask" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">编辑人员信息 - {{ person.personName }}</h3>
        <button class="close-btn" @click="$emit('close')"><X :size="20" /></button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">所属部门</label>
          <input v-model="form.departmentName" type="text" class="form-input" placeholder="请输入部门名称" />
        </div>

        <div class="form-group">
          <label class="form-label">职称</label>
          <select v-model="form.title" class="form-select">
            <option value="Professor">教授</option>
            <option value="AssociateProfessor">副教授</option>
            <option value="Lecturer">讲师</option>
            <option value="Assistant">助教</option>
            <option value="Other">其他</option>
          </select>
          <p class="form-hint">职称将直接影响公用房定额面积计算。</p>
        </div>

        <div class="form-group">
          <label class="form-label">在职状态</label>
          <div class="status-toggle">
            <button 
              :class="['toggle-btn', form.status === 'Active' ? 'active' : '']" 
              @click="form.status = 'Active'"
            >
              在职
            </button>
            <button 
              :class="['toggle-btn', form.status === 'Inactive' ? 'active inactive' : '']" 
              @click="form.status = 'Inactive'"
            >
              离职
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" @click="$emit('close')">取消</button>
        <button class="btn-primary" :disabled="loading" @click="handleSave">
          {{ loading ? '保存中...' : '保存修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { Person } from '~/server/utils/persons-db'

const props = defineProps<{
  isOpen: boolean
  person: Person | null
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [person: Person]
}>()

const form = ref<Person>({
  personId: '',
  personName: '',
  departmentName: '',
  title: 'Other',
  status: 'Active'
})

watch(() => props.person, (newVal) => {
  if (newVal) {
    form.value = { ...newVal }
  }
}, { immediate: true })

function handleSave() {
  emit('save', { ...form.value })
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #1f2329;
}

.close-btn {
  background: transparent;
  border: none;
  color: #8f959e;
  cursor: pointer;
  padding: 4px;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.form-input, .form-select {
  padding: 8px 12px;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus, .form-select:focus {
  border-color: #3370ff;
}

.form-hint {
  font-size: 12px;
  color: #8f959e;
}

.status-toggle {
  display: flex;
  background: #f5f6f7;
  padding: 4px;
  border-radius: 8px;
  gap: 4px;
}

.toggle-btn {
  flex: 1;
  padding: 6px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: #646a73;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: white;
  color: #3370ff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.toggle-btn.active.inactive {
  color: #8f959e;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #eef0f2;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-ghost {
  padding: 8px 16px;
  background: white;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  font-size: 14px;
  color: #1f2329;
  cursor: pointer;
}

.btn-primary {
  padding: 8px 16px;
  background: #3370ff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  color: white;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

