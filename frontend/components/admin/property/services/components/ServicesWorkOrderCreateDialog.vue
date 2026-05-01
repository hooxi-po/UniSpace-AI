<template>
    <div v-if="open" class="mask" @click.self="$emit('close')">
      <div class="dialog">
        <div class="title">发起报修</div>
        <div class="grid">
          <label class="field"><span>房间ID</span><input class="input" :value="form.roomId" @input="$emit('update:field','roomId',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>房间标识</span><input class="input" :value="form.roomLabel" @input="$emit('update:field','roomLabel',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>资产名称</span><input class="input" :value="form.assetName" @input="$emit('update:field','assetName',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>优先级</span>
            <select class="input" :value="form.priority" @change="$emit('update:field','priority',($event.target as HTMLSelectElement).value)">
              <option value="低">低</option><option value="中">中</option><option value="高">高</option><option value="紧急">紧急</option>
            </select>
          </label>
          <label class="field"><span>报修人</span><input class="input" :value="form.reporter" @input="$emit('update:field','reporter',($event.target as HTMLInputElement).value)" /></label>
          <label class="field"><span>联系电话</span><input class="input" :value="form.reportPhone" @input="$emit('update:field','reportPhone',($event.target as HTMLInputElement).value)" /></label>
          <label class="field full"><span>故障描述</span><textarea class="input" rows="3" :value="form.faultDesc" @input="$emit('update:field','faultDesc',($event.target as HTMLTextAreaElement).value)" /></label>
        </div>
        <div class="actions">
          <button class="btn" @click="$emit('close')">取消</button>
          <button class="btn btn--primary" :disabled="submitting" @click="$emit('submit')">{{ submitting ? '提交中...' : '提交' }}</button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  defineProps<{ open: boolean; submitting: boolean; form: Record<string, any> }>()
  defineEmits<{ close: []; submit: []; 'update:field':[string,string] }>()
  </script>
  
  <style scoped>
  .mask{position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;z-index:1000}
  .dialog{width:min(760px,94vw);background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:14px;display:grid;gap:12px}
  .title{font-size:16px;font-weight:700}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field{display:grid;gap:6px;font-size:12px;color:#646a73}.full{grid-column:1/-1}
  .input{border:1px solid var(--border,#dfe3ea);border-radius:8px;padding:8px 10px;font-size:13px}
  .actions{display:flex;justify-content:flex-end;gap:8px}
  .btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  .btn--primary{background:#3370ff;border-color:#3370ff;color:#fff}
  </style>