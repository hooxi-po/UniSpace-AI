<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">房源管理</h2>
        <p class="page__subtitle">发布、编辑和管理经营性房源，查看竞标情况</p>
      </div>
      <button v-if="isAssetAdmin" class="btn btn--primary" @click="handleOpenAddModal">
        <Plus :size="16" /> 发布房源
      </button>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input 
          v-model="searchTerm" 
          class="searchInput" 
          placeholder="搜索房源名称..." 
        />
      </div>
      
      <select v-model="statusFilter" class="select">
        <option value="all">全部状态</option>
        <option value="公开招租">公开招租</option>
        <option value="已出租">已出租</option>
        <option value="维修中">维修中</option>
      </select>

      <div class="countHint">共 {{ filteredSpaces.length }} 处房源</div>
    </div>

    <div v-if="loading" class="loading">
      <RefreshCw :size="24" class="spinning" />
      <span>加载中...</span>
    </div>

    <div v-else class="propertyGrid">
      <OperatingPropertyCard
        v-for="space in filteredSpaces"
        :key="space.id"
        :property="space"
        @edit="handleEdit"
        @view-bids="handleViewBids"
      />
      
      <div v-if="filteredSpaces.length === 0" class="empty">
        暂无符合条件的房源
      </div>
    </div>

    <!-- 发布/编辑弹窗 -->
    <OperatingPropertyModal
      :is-open="isModalOpen"
      :initial="editingProperty"
      @close="isModalOpen = false"
      @submit="handleModalSubmit"
    />

    <!-- 竞标列表弹窗 (简化实现) -->
    <div v-if="viewingBidsProperty" class="modalMask" @click="viewingBidsProperty = null">
      <div class="modal modal--wide" @click.stop>
        <div class="modal__header">
          <h3 class="modal__title">竞标列表 - {{ viewingBidsProperty.name }}</h3>
          <button class="modal__close" @click="viewingBidsProperty = null">
            <X :size="20" />
          </button>
        </div>
        <div class="modal__body">
          <div v-if="(viewingBidsProperty.bids || []).length === 0" class="empty">
            暂无竞标数据
          </div>
          <table v-else class="bidTable">
            <thead>
              <tr>
                <th>竞标单位</th>
                <th>联系人</th>
                <th>金额 (元)</th>
                <th>日期</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bid in viewingBidsProperty.bids" :key="bid.id">
                <td>{{ bid.company }}</td>
                <td>{{ bid.contactPerson }}</td>
                <td class="font-bold">¥{{ bid.amount.toLocaleString() }}</td>
                <td>{{ bid.bidDate }}</td>
                <td>
                  <span :class="['badge', bid.status === 'Winner' ? 'badge--success' : 'badge--gray']">
                    {{ bid.status === 'Winner' ? '中标' : '有效' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Search, RefreshCw, X } from 'lucide-vue-next'
import { useOperatingProperties } from '~/composables/property/useOperatingProperties'
import OperatingPropertyCard from '~/components/admin/property/operating/components/OperatingPropertyCard.vue'
import OperatingPropertyModal from '~/components/admin/property/operating/components/OperatingPropertyModal.vue'
import type { OperatingSpaceItem } from '~/services/operating'

const {
  spaces,
  loading,
  addProperty,
  updateProperty
} = useOperatingProperties()

// 模拟权限，实际应从 store 获取
const isAssetAdmin = ref(true)

const searchTerm = ref('')
const statusFilter = ref('all')
const isModalOpen = ref(false)
const editingProperty = ref<OperatingSpaceItem | null>(null)
const viewingBidsProperty = ref<OperatingSpaceItem | null>(null)

const filteredSpaces = computed(() => {
  let result = spaces.value
  
  if (statusFilter.value !== 'all') {
    result = result.filter(s => s.status === statusFilter.value)
  }
  
  if (searchTerm.value.trim()) {
    const q = searchTerm.value.toLowerCase()
    result = result.filter(s => s.name.toLowerCase().includes(q))
  }
  
  return result
})

function handleOpenAddModal() {
  editingProperty.value = null
  isModalOpen.value = true
}

function handleEdit(property: OperatingSpaceItem) {
  editingProperty.value = property
  isModalOpen.value = true
}

function handleViewBids(property: OperatingSpaceItem) {
  viewingBidsProperty.value = property
}

async function handleModalSubmit(data: {
  name: string
  buildingName: string
  floor: string
  roomNumber: string
  purpose: OperatingSpaceItem['purpose']
  area: number
  monthlyRent: number
  description: string
}) {
  if (editingProperty.value) {
    updateProperty(editingProperty.value.id, data)
  } else {
    addProperty({
      ...data,
      status: '公开招租'
    })
  }
  isModalOpen.value = false
  editingProperty.value = null
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}

.page__subtitle {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}

.filterCard {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.searchBox {
  position: relative;
  flex: 1;
}

.searchIcon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
}

.searchInput {
  width: 100%;
  padding: 8px 12px 8px 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.countHint {
  font-size: 13px;
  color: var(--muted);
}

.propertyGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.loading, .empty {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--primary {
  background: var(--primary);
  color: #fff;
  border: none;
}

.btn--primary:hover {
  background: var(--primary-hover);
}

/* 竞标列表相关样式 */
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal--wide {
  max-width: 720px;
}

.modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.modal__close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: 4px;
}

.modal__body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.bidTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.bidTable th, .bidTable td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.bidTable th {
  color: var(--muted);
  font-weight: 500;
  background: #f8fafc;
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge--success {
  background: #eefdf3;
  color: #16a34a;
}

.badge--gray {
  background: #f1f2f3;
  color: var(--muted);
}
</style>
