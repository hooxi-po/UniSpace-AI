<template>
    <div v-if="open" class="mask" @click.self="$emit('close')">
      <div class="dialog">
        <div class="header">
          <div class="title">{{ mode === 'vacate' ? '确认腾退' : '再分配房间' }}</div>
          <div class="sub">{{ room?.buildingName }} {{ room?.roomNo }}</div>
        </div>
  
        <template v-if="mode === 'reassign'">
          <label class="field">
            <span>新分配类型</span>
            <select :value="reassignType" class="input" @change="$emit('update:reassignType', ($event.target as HTMLSelectElement).value)">
              <option value="学生宿舍">学生宿舍</option>
              <option value="教师宿舍">教师宿舍</option>
            </select>
          </label>
          <label class="field">
            <span>部门/住户</span>
            <input :value="reassignDepartment" class="input" @input="$emit('update:reassignDepartment', ($event.target as HTMLInputElement).value)" />
          </label>
        </template>
  
        <label class="field">
          <span>原住户（通知用，可选）</span>
          <input :value="oldTenantName" class="input" @input="$emit('update:oldTenantName', ($event.target as HTMLInputElement).value)" />
        </label>
  
        <label class="field">
          <span>通知备注（可选）</span>
          <textarea :value="noticeRemark" class="input" rows="2" @input="$emit('update:noticeRemark', ($event.target as HTMLTextAreaElement).value)" />
        </label>
  
        <div class="actions">
          <button class="btn" :disabled="submitting" @click="$emit('close')">取消</button>
          <button class="btn btn--primary" :disabled="submitting" @click="$emit('submit')">{{ submitting ? '处理中...' : '确认' }}</button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { ApartmentRoom, DormType } from '~/services/apartments'
  defineProps<{
    open: boolean
    submitting: boolean
    mode: 'vacate' | 'reassign'
    room: ApartmentRoom | null
    reassignType: DormType
    reassignDepartment: string
    oldTenantName: string
    noticeRemark: string
  }>()
  defineEmits([
    'close',
    'submit',
    'update:reassignType',
    'update:reassignDepartment',
    'update:oldTenantName',
    'update:noticeRemark',
  ])
  </script>
  
  <style scoped>
  .mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .dialog { width: min(560px, 94vw); background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; display: grid; gap: 10px; }
  .header { border-bottom: 1px solid var(--border-light, #edf0f5); padding-bottom: 8px; }
  .title { font-size: 16px; font-weight: 700; }
  .sub { color: #646a73; font-size: 13px; margin-top: 2px; }
  .field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
  .input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  .btn--primary { border-color: #3370ff; background: #3370ff; color: #fff; }
  </style>