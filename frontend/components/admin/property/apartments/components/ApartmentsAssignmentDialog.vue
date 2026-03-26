<template>
    <div v-if="open" class="mask" @click.self="$emit('close')">
      <div class="dialog">
        <div class="header">
          <div class="title">床位分配</div>
          <div class="sub">{{ form.roomLabel }}</div>
        </div>
  
        <div class="grid">
          <label class="field">
            <span>分配对象</span>
            <select
              :value="form.personType"
              class="input"
              @change="$emit('update:field', 'personType', ($event.target as HTMLSelectElement).value)"
            >
              <option value="学生">学生</option>
              <option value="教师">教师</option>
            </select>
          </label>
  
          <label class="field">
            <span>姓名</span>
            <input
              :value="form.personName"
              class="input"
              @input="$emit('update:field', 'personName', ($event.target as HTMLInputElement).value)"
            />
          </label>
  
          <label class="field">
            <span>学号/工号</span>
            <input
              :value="form.personNo"
              class="input"
              @input="$emit('update:field', 'personNo', ($event.target as HTMLInputElement).value)"
            />
          </label>
  
          <label class="field">
            <span>院系/部门</span>
            <input
              :value="form.department"
              class="input"
              @input="$emit('update:field', 'department', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
  
        <div class="actions">
          <button class="btn" :disabled="submitting" @click="$emit('close')">取消</button>
          <button
            class="btn btn--primary"
            :disabled="submitting || !form.personName.trim() || !form.personNo.trim()"
            @click="$emit('submit')"
          >
            {{ submitting ? '提交中...' : '确认分配' }}
          </button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  defineProps<{
    open: boolean
    submitting: boolean
    form: {
      roomLabel: string
      personType: '学生' | '教师'
      personName: string
      personNo: string
      department: string
    }
  }>()
  
  defineEmits<{
    close: []
    submit: []
    'update:field': [field: string, value: string]
  }>()
  </script>
  
  <style scoped>
  .mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .dialog { width: min(620px, 94vw); background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; display: grid; gap: 12px; }
  .header { border-bottom: 1px solid var(--border-light, #edf0f5); padding-bottom: 8px; }
  .title { font-size: 16px; font-weight: 700; }
  .sub { margin-top: 4px; color: #646a73; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
  .input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px; }
  .btn--primary { border-color: #3370ff; background: #3370ff; color: #fff; }
  
  @media (max-width: 760px) {
    .grid { grid-template-columns: 1fr; }
  }
  </style>