<template>
    <div v-if="open" class="mask" @click.self="$emit('close')">
      <div class="drawer">
        <div class="title">工单详情</div>
        <div v-if="!item" class="empty">无数据</div>
        <template v-else>
          <div class="meta">
            <div><strong>工单号：</strong>{{ item.workorderNo }}</div>
            <div><strong>房间：</strong>{{ item.roomLabel }}</div>
            <div><strong>资产：</strong>{{ item.assetName }}</div>
            <div><strong>状态：</strong>{{ item.status }}</div>
            <div><strong>优先级：</strong>{{ item.priority }}</div>
            <div><strong>报修描述：</strong>{{ item.faultDesc }}</div>
          </div>
          <div class="logTitle">生命周期记录</div>
          <ul class="logs">
            <li v-for="log in logs" :key="log.id">
              <span>{{ log.createdAt }}</span> · <strong>{{ log.action }}</strong> · {{ log.detail || '—' }}
            </li>
          </ul>
        </template>
        <div class="actions"><button class="btn" @click="$emit('close')">关闭</button></div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { ServiceWorkOrder, WorkOrderLog } from '~/services/services-workorders'
  defineProps<{ open: boolean; item: ServiceWorkOrder | null; logs: WorkOrderLog[] }>()
  defineEmits<{ close: [] }>()
  </script>
  
  <style scoped>
  .mask{position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;justify-content:flex-end;z-index:1000}
  .drawer{width:min(720px,96vw);height:100%;background:#fff;padding:14px;display:grid;gap:12px;overflow:auto}
  .title{font-size:16px;font-weight:700}
  .meta{display:grid;gap:6px;font-size:13px}
  .logTitle{font-weight:700}
  .logs{display:grid;gap:8px;padding-left:16px}
  .actions{display:flex;justify-content:flex-end}
  .btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
  </style>