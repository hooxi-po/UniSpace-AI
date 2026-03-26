<template>
  <div v-if="open" class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialogHeader">
        <div class="dialogTitle">分配宿舍房间</div>
        <div class="dialogSub">申请人：{{ target?.applicantName || '-' }}（{{ target?.applicantType || '-' }}）</div>
      </div>

      <div class="field">
        <label>选择可用房间（空置）</label>
        <select :value="selectedRoomId" class="input" @change="$emit('update:selectedRoomId', ($event.target as HTMLSelectElement).value)">
          <option value="">请选择房间</option>
          <option v-for="opt in roomOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
        </select>
      </div>

      <div class="dialogActions">
        <button class="btn" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" :disabled="submitting || !selectedRoomId" @click="$emit('submit')">
          {{ submitting ? '分配中...' : '确认分配' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApartmentApplicationItem } from '~/services/apartments'

defineProps<{
  open: boolean
  submitting: boolean
  target: ApartmentApplicationItem | null
  selectedRoomId: string
  roomOptions: Array<{ id: string; label: string }>
}>()

defineEmits<{
  close: []
  submit: []
  'update:selectedRoomId': [value: string]
}>()
</script>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { width: min(560px, 94vw); background: #fff; border-radius: 12px; border: 1px solid var(--border, #dfe3ea); padding: 14px; display: grid; gap: 12px; }
.dialogHeader { border-bottom: 1px solid var(--border-light, #edf0f5); padding-bottom: 8px; }
.dialogTitle { font-size: 16px; font-weight: 700; }
.dialogSub { margin-top: 4px; font-size: 13px; color: #646a73; }
.field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
.input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #1f2329; }
.dialogActions { display: flex; justify-content: flex-end; gap: 8px; }
.btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
.btn--primary { background: #3370ff; border-color: #3370ff; color: #fff; }
</style>

