<template>
    <div v-if="open && bill" class="mask" @click.self="$emit('close')">
      <div class="dialog">
        <div class="header">
          <div class="title">水电账单详情</div>
          <div class="sub">{{ bill.month }} · {{ bill.roomLabel }}</div>
        </div>
  
        <div class="grid">
          <div class="item"><span>账单号</span><strong>{{ bill.id }}</strong></div>
          <div class="item"><span>住户</span><strong>{{ bill.resident }}</strong></div>
          <div class="item"><span>电量(度)</span><strong>{{ bill.electricUsed }}（免{{ bill.electricFree }}）</strong></div>
          <div class="item"><span>水量(吨)</span><strong>{{ bill.waterUsed }}（免{{ bill.waterFree }}）</strong></div>
          <div class="item"><span>超额电量</span><strong>{{ bill.electricOver }}</strong></div>
          <div class="item"><span>超额水量</span><strong>{{ bill.waterOver }}</strong></div>
          <div class="item"><span>应缴金额</span><strong>¥{{ bill.amount.toFixed(2) }}</strong></div>
          <div class="item"><span>状态</span><strong>{{ bill.status }}</strong></div>
        </div>
  
        <div class="tips">
          计费规则：每住户每月免 5 度电、5 吨水；超额部分按电 ¥1.2/度、水 ¥2.0/吨计费。
        </div>
  
        <div class="actions">
          <button class="btn" @click="$emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { UtilityBill } from '~/composables/property/useApartmentsUtilities'
  
  defineProps<{
    open: boolean
    bill: UtilityBill | null
  }>()
  
  defineEmits<{ close: [] }>()
  </script>
  
  <style scoped>
  .mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .dialog { width: min(680px, 94vw); background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; display: grid; gap: 12px; }
  .header { border-bottom: 1px solid var(--border-light, #edf0f5); padding-bottom: 8px; }
  .title { font-size: 16px; font-weight: 700; }
  .sub { margin-top: 4px; color: #646a73; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .item { background: #f8fafc; border-radius: 8px; padding: 10px; display: grid; gap: 4px; }
  .item span { color: #646a73; font-size: 12px; }
  .item strong { font-size: 14px; color: #1f2329; }
  .tips { color: #646a73; font-size: 12px; }
  .actions { display: flex; justify-content: flex-end; }
  .btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  
  @media (max-width: 760px) {
    .grid { grid-template-columns: 1fr; }
  }
  </style>