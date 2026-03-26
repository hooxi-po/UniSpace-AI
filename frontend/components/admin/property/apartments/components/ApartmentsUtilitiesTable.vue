<template>
    <section class="section">
      <div class="title">在住房间水电账单列表</div>
  
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="bills.length === 0" class="empty">当前月份暂无账单</div>
  
      <div v-else class="wrap">
        <table class="table">
          <thead>
            <tr>
              <th>账单号</th>
              <th>住户</th>
              <th>房间</th>
              <th>电量(度)</th>
              <th>水量(吨)</th>
              <th>应缴(元)</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bill in bills" :key="bill.id">
              <td>{{ bill.id }}</td>
              <td>{{ bill.resident }}</td>
              <td>{{ bill.roomLabel }}</td>
              <td>{{ bill.electricUsed }} / 免{{ bill.electricFree }}</td>
              <td>{{ bill.waterUsed }} / 免{{ bill.waterFree }}</td>
              <td>¥{{ bill.amount.toFixed(2) }}</td>
              <td>
                <span class="tag" :class="bill.status === '已发送' ? 'sent' : 'unsent'">{{ bill.status }}</span>
              </td>
              <td>
                <div class="actions">
                  <button class="btn" @click="$emit('view', bill)">查看</button>
                  <button class="btn btn--primary" :disabled="sending" @click="$emit('send', bill)">发送账单</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  import type { UtilityBill } from '~/composables/property/useApartmentsUtilities'
  
  defineProps<{
    loading: boolean
    sending: boolean
    bills: UtilityBill[]
  }>()
  
  defineEmits<{
    view: [UtilityBill]
    send: [UtilityBill]
  }>()
  </script>
  
  <style scoped>
  .section { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; }
  .title { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
  .empty { color: #646a73; font-size: 13px; }
  .wrap { overflow: auto; border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; max-height: 620px; }
  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { border-bottom: 1px solid var(--border-light, #edf0f5); padding: 10px 8px; font-size: 13px; text-align: left; }
  .table th { background: #f8fafc; color: #646a73; }
  .tag { border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
  .tag.sent { background: #e8f5e9; color: #207245; }
  .tag.unsent { background: #fff7e6; color: #b76e00; }
  .actions { display: flex; gap: 6px; }
  .btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  .btn--primary { border-color: #3370ff; color: #3370ff; }
  </style>