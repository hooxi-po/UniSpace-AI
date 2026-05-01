<template>
    <section class="section">
      <div class="title">工单列表</div>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="items.length===0" class="empty">暂无工单</div>
      <div v-else class="wrap">
        <table class="table">
          <thead>
            <tr>
              <th>工单号</th>
              <th>房间</th>
              <th>资产</th>
              <th>报修人</th>
              <th>优先级</th>
              <th>状态</th>
              <th>维修队伍</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.workorderNo }}</td>
              <td>{{ item.roomLabel }}</td>
              <td>{{ item.assetName }}</td>
              <td>{{ item.reporter }}</td>
              <td><span class="tag pri">{{ item.priority }}</span></td>
              <td><span class="tag st">{{ item.status }}</span></td>
              <td>{{ item.teamName || '—' }} {{ item.assignee ? `/${item.assignee}` : '' }}</td>
              <td>
                <div class="ops">
                  <button class="btn" @click="$emit('detail', item)">详情</button>
                  <button class="btn" v-if="item.status==='待派单'" @click="$emit('assign', item)">派工</button>
                  <button class="btn" v-if="item.status==='已派单'" @click="$emit('status', item, '处理中')">开始处理</button>
                  <button class="btn" v-if="item.status==='处理中'" @click="$emit('status', item, '待验收')">提交验收</button>
                  <button class="btn" v-if="item.status==='待验收'" @click="$emit('status', item, '已完成')">完成</button>
                  <button class="btn btn--danger" v-if="item.status!=='已完成' && item.status!=='已关闭'" @click="$emit('status', item, '已关闭')">关闭</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  import type { ServiceWorkOrder, WorkOrderStatus } from '~/services/services-workorders'
  defineProps<{ loading: boolean; items: ServiceWorkOrder[] }>()
  defineEmits<{
    detail: [ServiceWorkOrder]
    assign: [ServiceWorkOrder]
    status: [ServiceWorkOrder, WorkOrderStatus]
  }>()
  </script>
  
  <style scoped>
  .section{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:14px}
  .title{font-size:14px;font-weight:700;margin-bottom:12px}
  .empty{font-size:13px;color:#646a73}
  .wrap{overflow:auto;border:1px solid var(--border-light,#edf0f5);border-radius:10px}
  .table{width:100%;border-collapse:collapse}
  .table th,.table td{border-bottom:1px solid var(--border-light,#edf0f5);padding:10px 8px;font-size:13px;text-align:left}
  .table th{background:#f8fafc;color:#646a73}
  .tag{border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700}
  .ops{display:flex;gap:6px;flex-wrap:wrap}
  .btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:5px 9px;cursor:pointer;font-size:12px}
  .btn--danger{color:#c52828;border-color:#efc3c3}
  </style>