<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">房间管理</h2>
        <p class="subtitle">支持学生/教师宿舍腾退、床位级再分配，并向住户发送通知</p>
      </div>
    </div>

    <div class="stats">
      <div class="card"><span>总房间</span><strong>{{ stats.total }}</strong></div>
      <div class="card"><span>在住房间</span><strong>{{ stats.occupied }}</strong></div>
      <div class="card"><span>空置房间</span><strong>{{ stats.empty }}</strong></div>
    </div>

    <ApartmentsRoomsFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-type="selectedType"
      v-model:selected-status="selectedStatus"
      :count="filteredRooms.length"
      @search="applySearch"
      @reset="resetSearch"
    />

    <ApartmentsRoomsTable
      :loading="loading"
      :rooms="filteredRooms"
      @vacate="openVacate"
      @reassign="openReassign"
    />

    <ApartmentsRoomsActionDialog
      :open="vacateOpen || reassignOpen"
      :submitting="operating"
      :mode="vacateOpen ? 'vacate' : 'reassign'"
      :room="activeRoom"
      :reassign-department="reassignDepartment"
      :old-tenant-name="oldTenantName"
      :notice-remark="noticeRemark"
      :source-beds="sourceBeds"
      :source-bed-no="sourceBedNo"
      :target-building-code="targetBuildingCode"
      :target-floor="targetFloor"
      :target-room-id="targetRoomId"
      :target-bed-no="targetBedNo"
      :target-building-options="targetBuildingOptions"
      :target-floor-options="targetFloorOptions"
      :target-room-options="targetRoomOptions"
      :target-beds="targetBeds"
      :bed-transfer-preview="bedTransferPreview"
      @close="closeDialogs"
      @submit="vacateOpen ? confirmVacate() : confirmReassign()"
      @update:reassignDepartment="reassignDepartment = $event"
      @update:oldTenantName="oldTenantName = $event"
      @update:noticeRemark="noticeRemark = $event"
      @update:sourceBedNo="sourceBedNo = $event"
      @update:targetBuildingCode="targetBuildingCode = $event"
      @update:targetFloor="targetFloor = $event"
      @update:targetRoomId="targetRoomId = $event"
      @update:targetBedNo="targetBedNo = $event"
    />
  </div>
</template>

<script setup lang="ts">
import ApartmentsRoomsActionDialog from '~/components/admin/property/apartments/components/ApartmentsRoomsActionDialog.vue'
import ApartmentsRoomsFilters from '~/components/admin/property/apartments/components/ApartmentsRoomsFilters.vue'
import ApartmentsRoomsTable from '~/components/admin/property/apartments/components/ApartmentsRoomsTable.vue'
import { useApartmentsRooms } from '~/composables/property/useApartmentsRooms'

const {
  loading,
  operating,
  draftKeyword,
  selectedType,
  selectedStatus,
  filteredRooms,
  stats,
  vacateOpen,
  reassignOpen,
  activeRoom,
  reassignDepartment,
  noticeRemark,
  oldTenantName,
  sourceBeds,
  sourceBedNo,
  targetBuildingCode,
  targetFloor,
  targetRoomId,
  targetBedNo,
  targetBuildingOptions,
  targetFloorOptions,
  targetRoomOptions,
  targetBeds,
  bedTransferPreview,
  applySearch,
  resetSearch,
  openVacate,
  openReassign,
  closeDialogs,
  confirmVacate,
  confirmReassign,
} = useApartmentsRooms()
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { margin: 0; font-size: 20px; font-weight: 800; color: #1f2329; }
.subtitle { margin: 4px 0 0; color: #646a73; font-size: 13px; }
.stats { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.card { background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 12px; display: grid; gap: 6px; }
.card span { color: #646a73; font-size: 12px; }
.card strong { font-size: 22px; }
@media (max-width: 700px) { .stats { grid-template-columns: 1fr; } }
</style>
