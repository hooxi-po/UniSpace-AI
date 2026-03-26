<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">维修工单</h2>
        <p class="subtitle">负责派工与生命周期流转管理</p>
      </div>
    </div>

    <div class="stats">
      <div class="card"><span>待派单</span><strong>{{ stats.pending }}</strong></div>
      <div class="card"><span>处理中</span><strong>{{ stats.processing }}</strong></div>
      <div class="card"><span>待验收</span><strong>{{ items.filter(i => i.status === '待验收').length }}</strong></div>
      <div class="card"><span>已关闭</span><strong>{{ items.filter(i => i.status === '已关闭').length }}</strong></div>
    </div>

    <ServicesWorkOrderFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-status="selectedStatus"
      v-model:selected-priority="selectedPriority"
      :count="items.length"
      @search="applySearch"
      @reset="resetSearch"
    />

    <ServicesWorkOrderTable
      :loading="loading"
      :items="items"
      @detail="openDetail"
      @assign="openAssign"
      @status="quickStatusUpdate"
    />

    <ServicesAssignTeamDialog
      :open="assignOpen"
      :submitting="submitting"
      :item="activeItem"
      :form="assignForm"
      @close="closeAssign"
      @submit="submitAssign"
      @update:field="(k,v)=>(assignForm as any)[k]=v"
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
import ServicesAssignTeamDialog from '~/components/admin/property/services/components/ServicesAssignTeamDialog.vue'
import ServicesWorkOrderDetailDrawer from '~/components/admin/property/services/components/ServicesWorkOrderDetailDrawer.vue'
import ServicesWorkOrderFilters from '~/components/admin/property/services/components/ServicesWorkOrderFilters.vue'
import ServicesWorkOrderTable from '~/components/admin/property/services/components/ServicesWorkOrderTable.vue'
import { useServicesWorkOrders } from '~/composables/property/useServicesWorkOrders'

const {
  loading,
  submitting,
  draftKeyword,
  selectedStatus,
  selectedPriority,
  items,
  stats,
  assignOpen,
  assignForm,
  detailOpen,
  activeItem,
  activeLogs,
  applySearch,
  resetSearch,
  openAssign,
  closeAssign,
  submitAssign,
  quickStatusUpdate,
  openDetail,
  closeDetail,
} = useServicesWorkOrders()
</script>

<style scoped>
.page{display:grid;gap:16px;padding:16px}
.header{display:flex;justify-content:space-between;align-items:center;gap:12px}
.title{margin:0;font-size:20px;font-weight:800}
.subtitle{margin-top:4px;font-size:13px;color:#646a73}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.card{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:12px}
.card span{font-size:12px;color:#646a73;display:block}
.card strong{font-size:22px}
</style>