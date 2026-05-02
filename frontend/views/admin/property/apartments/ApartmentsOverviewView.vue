<template>
  <div class="page">
    <div class="pageHeader">
      <div>
        <h2 class="title">居住概览</h2>
        <p class="subtitle">统一查看学生宿舍与教师宿舍房源状态，支持卡片/列表一键切换</p>
      </div>
      <div class="viewSwitch" role="tablist" aria-label="切换视图">
        <button type="button" class="switchBtn" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">卡片</button>
        <button type="button" class="switchBtn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">列表</button>
      </div>
    </div>

    <ApartmentsOverviewStats
      :student-count="studentRooms.length"
      :teacher-count="teacherRooms.length"
      :total-beds="totalBeds"
      :occupied-beds="occupiedBeds"
    />

    <ApartmentsOverviewFilters
      v-model:draft-keyword="draftKeyword"
      v-model:selected-type="selectedType"
      v-model:selected-building="selectedBuilding"
      :building-options="buildingOptions"
      :count="filteredRooms.length"
      @search="applySearch"
      @reset="resetSearch"
    />

    <ApartmentsOverviewRoomList
      :loading="loading"
      :view-mode="viewMode"
      :rooms="filteredRooms"
      :get-status-meta="getStatusMeta"
    />

    <ApartmentsOverviewCharts
      :statuses="statuses"
      :type-occupancy="typeOccupancy"
      :get-status-meta="getStatusMeta"
      :get-type-percent="getTypePercent"
    />
  </div>
</template>

<script setup lang="ts">
import ApartmentsOverviewCharts from '~/components/admin/property/apartments/components/ApartmentsOverviewCharts.vue'
import ApartmentsOverviewFilters from '~/components/admin/property/apartments/components/ApartmentsOverviewFilters.vue'
import ApartmentsOverviewRoomList from '~/components/admin/property/apartments/components/ApartmentsOverviewRoomList.vue'
import ApartmentsOverviewStats from '~/components/admin/property/apartments/components/ApartmentsOverviewStats.vue'
import { useApartmentsOverview } from '~/composables/property/useApartmentsOverview'

const {
  viewMode,
  loading,
  filteredRooms,
  studentRooms,
  teacherRooms,
  totalBeds,
  occupiedBeds,
  statuses,
  typeOccupancy,
  draftKeyword,
  selectedType,
  selectedBuilding,
  buildingOptions,
  applySearch,
  resetSearch,
  getStatusMeta,
  getTypePercent,
} = useApartmentsOverview()
</script>

<style scoped>
.page { display: grid; gap: 16px; padding: 16px; }
.pageHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { margin: 0; font-size: 20px; font-weight: 800; color: #1f2329; }
.subtitle { margin: 4px 0 0; color: #646a73; font-size: 13px; }
.viewSwitch { display: inline-flex; border: 1px solid var(--border, #dfe3ea); border-radius: 10px; overflow: hidden; background: #fff; }
.switchBtn { border: none; background: transparent; padding: 8px 14px; cursor: pointer; color: #646a73; font-size: 13px; }
.switchBtn.active { background: #3370ff; color: #fff; font-weight: 700; }

@media (max-width: 700px) {
  .pageHeader { flex-direction: column; align-items: flex-start; }
}
</style>