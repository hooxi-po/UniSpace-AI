<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">物业服务工单</h2>
        <p class="subtitle">负责工单产生与状态查看</p>
      </div>
      <button class="createBtn" @click="openCreate">发起报修</button>
    </div>

    <div class="stats">
      <div class="card"><span>总工单</span><strong>{{ stats.total }}</strong></div>
      <div class="card"><span>待派单</span><strong>{{ stats.pending }}</strong></div>
      <div class="card"><span>处理中</span><strong>{{ stats.processing }}</strong></div>
      <div class="card"><span>已完成</span><strong>{{ stats.done }}</strong></div>
    </div>

    <ServicesWorkOrderFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-status="selectedStatus"
      v-model:selected-priority="selectedPriority"
      :count="items.length"
      @search="applySearch"
      @reset="resetSearch"
    />

    <section class="section">
      <div class="sectionTitle">工单状态总览（只读）</div>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="items.length === 0" class="empty">暂无工单</div>

      <div v-else class="tableWrap">
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
              <td>{{ item.priority }}</td>
              <td><span class="tag">{{ item.status }}</span></td>
              <td>{{ item.teamName || '—' }}{{ item.assignee ? ` / ${item.assignee}` : '' }}</td>
              <td>
                <button class="btn" @click="openDetail(item)">查看详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ServicesWorkOrderCreateDialog
      :open="createOpen"
      :submitting="submitting"
      :form="createForm"
      @close="closeCreate"
      @submit="submitCreate"
      @update:field="(k,v)=>(createForm as any)[k]=v"
    />

    <ServicesWorkOrderDetailDrawer
      :open="detailOpen"
      :item="activeItem"
      :logs="activeLogs"
      @close="closeDetail"
    />
  </div>
</template>

<script setup lang="ts">
import ServicesWorkOrderCreateDialog from '~/components/admin/property/services/components/ServicesWorkOrderCreateDialog.vue'
import ServicesWorkOrderDetailDrawer from '~/components/admin/property/services/components/ServicesWorkOrderDetailDrawer.vue'
import ServicesWorkOrderFilters from '~/components/admin/property/services/components/ServicesWorkOrderFilters.vue'
import { useServicesWorkOrders } from '~/composables/property/useServicesWorkOrders'

const {
  loading,
  submitting,
  draftKeyword,
  selectedStatus,
  selectedPriority,
  items,
  stats,
  createOpen,
  createForm,
  detailOpen,
  activeItem,
  activeLogs,
  applySearch,
  resetSearch,
  openCreate,
  closeCreate,
  submitCreate,
  openDetail,
  closeDetail,
} = useServicesWorkOrders()
</script>

<style scoped>
.page{display:grid;gap:16px;padding:16px}
.header{display:flex;justify-content:space-between;align-items:center;gap:12px}
.title{margin:0;font-size:20px;font-weight:800}
.subtitle{margin-top:4px;font-size:13px;color:#646a73}
.createBtn{border:1px solid #3370ff;background:#3370ff;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.card{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:12px}
.card span{font-size:12px;color:#646a73;display:block}
.card strong{font-size:22px}
.section{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:14px}
.sectionTitle{font-size:14px;font-weight:700;margin-bottom:12px}
.empty{font-size:13px;color:#646a73}
.tableWrap{overflow:auto;border:1px solid var(--border-light,#edf0f5);border-radius:10px}
.table{width:100%;border-collapse:collapse}
.table th,.table td{border-bottom:1px solid var(--border-light,#edf0f5);padding:10px 8px;font-size:13px;text-align:left}
.table th{background:#f8fafc;color:#646a73}
.tag{display:inline-flex;border-radius:999px;padding:2px 8px;background:#eef2ff;color:#334155;font-size:12px}
.btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px}
</style>