<template>
    <div v-if="open" class="mask" @click.self="$emit('close')">
      <div class="dialog">
        <div class="title">分配维修队伍</div>
        <div class="sub">{{ item?.workorderNo }} · {{ item?.roomLabel }}</div>
        <div class="grid">
          <label class="field"><span>队伍名称</span><input class="input" :value="form.teamName" @input="$emit('update:field','teamName',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>负责人</span><input class="input" :value="form.assignee" @input="$emit('update:field','assignee',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>预计到场</span><input class="input" type="datetime-local" :value="form.planArrivalAt" @input="$emit('update:field','planArrivalAt',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>操作人</span><input class="input" :value="form.operatorName" @input="$emit('update:field','operatorName',($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="actions">
          <button class="btn" @click="$emit('close')">取消</button>
          <button class="btn btn--primary" :disabled="submitting" @click="$emit('submit')">{{ submitting ? '提交中...' : '确认派工' }}</button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { ServiceWorkOrder } from '~/services/services-workorders'
  defineProps<{ open: boolean; submitting: boolean; item: ServiceWorkOrder | null; form: Record<string, any> }>()
  defineEmits<{ close: []; submit: []; 'update:field':[string,string] }>()
  </script>
  
  <style scoped>
  .mask{position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;z-index:1000}
  .dialog{width:min(620px,94vw);background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:14px;display:grid;gap:12px}
  .title{font-size:16px;font-weight:700}.sub{font-size:13px;color:#646a73}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field{display:grid;gap:6px;font-size:12px;color:#646a73}
  .input{border:1px solid var(--border,#dfe3ea);border-radius:8px;padding:8px 10px;font-size:13px}
  .actions{display:flex;justify-content:flex-end;gap:8px}
  .btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn--primary{background:#3370ff;border-color:#3370ff;color:#fff}
  </style>