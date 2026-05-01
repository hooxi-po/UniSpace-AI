<template>
  <div class="page">
    <div class="pageHeader">
      <div>
        <h2 class="title">入住申请</h2>
        <p class="subtitle">管理入住申请，支持发起、编辑、删除与房间分配</p>
      </div>
      <button class="createBtn" @click="openCreate">发起申请</button>
    </div>

    <div class="stats">
      <div class="statCard">
        <span>待处理</span>
        <strong>{{ pendingCount }}</strong>
      </div>
      <div class="statCard">
        <span>已分配</span>
        <strong>{{ assignedCount }}</strong>
      </div>
      <div class="statCard">
        <span>总申请</span>
        <strong>{{ filteredApplications.length }}</strong>
      </div>
    </div>

    <ApartmentsApplicationFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-status="selectedStatus"
      :count="filteredApplications.length"
      @search="applySearch"
      @reset="resetSearch"
    />

    <ApartmentsApplicationTable
      :loading="loading"
      :items="filteredApplications"
      @edit="openEdit"
      @assign="openAssign"
      @delete="removeItem"
    />

    <ApartmentsApplicationFormDialog
      :open="formOpen"
      :mode="formMode"
      :submitting="saving"
      :form="form"
      @close="closeForm"
      @submit="submitForm"
      @update:field="handleFormFieldUpdate"
    />

    <ApartmentsApplicationAssignDialog
      :open="assignOpen"
      :submitting="assigning"
      :target="assignTarget"
      :selected-room-id="selectedRoomId"
      :room-options="roomOptions"
      @close="closeAssign"
      @submit="submitAssign"
      @update:selected-room-id="selectedRoomId = $event"
    />
  </div>
</template>

<script setup lang="ts">
import ApartmentsApplicationAssignDialog from '~/components/admin/property/apartments/components/ApartmentsApplicationAssignDialog.vue'
import ApartmentsApplicationFilters from '~/components/admin/property/apartments/components/ApartmentsApplicationFilters.vue'
import ApartmentsApplicationFormDialog from '~/components/admin/property/apartments/components/ApartmentsApplicationFormDialog.vue'
import ApartmentsApplicationTable from '~/components/admin/property/apartments/components/ApartmentsApplicationTable.vue'
import { useApartmentsApplications } from '~/composables/property/useApartmentsApplications'

const {
  loading,
  saving,
  assigning,
  draftKeyword,
  selectedStatus,
  filteredApplications,
  pendingCount,
  assignedCount,
  formOpen,
  formMode,
  form,
  assignOpen,
  assignTarget,
  selectedRoomId,
  roomOptions,
  applySearch,
  resetSearch,
  openCreate,
  openEdit,
  closeForm,
  submitForm,
  removeItem,
  openAssign,
  closeAssign,
  submitAssign,
} = useApartmentsApplications()

function handleFormFieldUpdate(field: string, value: string) {
  ;(form as any)[field] = value
}
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.pageHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { margin: 0; font-size: 20px; font-weight: 800; color: #1f2329; }
.subtitle { margin: 4px 0 0; color: #646a73; font-size: 13px; }
.createBtn { border: 1px solid #3370ff; background: #3370ff; color: #fff; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 13px; font-weight: 600; }
.stats { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.statCard { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 6px; }
.statCard span { color: #646a73; font-size: 12px; }
.statCard strong { font-size: 22px; }

@media (max-width: 700px) {
  .pageHeader { flex-direction: column; align-items: flex-start; }
  .stats { grid-template-columns: 1fr; }
}
</style>