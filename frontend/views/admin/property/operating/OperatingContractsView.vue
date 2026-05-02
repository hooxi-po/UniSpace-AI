<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">合同管理</h2>
        <p class="page__subtitle">管理经营性用房合同台账，支持检索、筛选与导出</p>
      </div>

      <div class="page__headerActions">
        <button class="btn" @click="exportCsv">导出 CSV</button>
        <button class="btn btn--primary" @click="openCreate">新增合同</button>
      </div>
    </div>

    <div v-if="expiringItems.length" class="warning">
      <div class="warning__title">合同到期提醒</div>
      <div class="warning__list">
        <div v-for="it in expiringItems" :key="it.id" class="warning__item">
          <div class="warning__left">
            <span class="warning__tenant">{{ it.tenant }}</span>
            <span class="warning__space">({{ it.spaceName }})</span>
          </div>
          <span class="warning__tag">{{ it.days }} 天后到期 · {{ it.endDate }}</span>
        </div>
      </div>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索承租方..." />
      </div>

      <select v-model="statusFilter" class="select">
        <option value="all">全部状态</option>
        <option value="Active">履约中</option>
        <option value="Expiring">即将到期</option>
      </select>

      <div class="countHint">共 {{ filteredContracts.length }} 份合同</div>
    </div>

    <div v-if="pending" class="loading">
      <RefreshCw :size="24" class="spinning" />
      <span>加载中...</span>
    </div>

    <div v-else class="card">
      <OperatingContractTable
        :items="filteredContracts"
        :editable="true"
        @detail="openDetail"
        @edit="openEdit"
        @delete="handleDelete"
      />
    </div>

    <OperatingContractDetailDialog
      v-if="detailItem"
      :is-open="true"
      :contract="detailItem"
      @close="detailItem = null"
    />

    <OperatingContractUpsertModal
      v-if="upsertOpen"
      :is-open="true"
      :spaces="spaces"
      :initial="editingItem"
      @close="closeUpsert"
      @submit="handleUpsertSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RefreshCw, Search } from 'lucide-vue-next'
import { useOperatingOverview } from '~/composables/property/useOperatingOverview'
import { deleteOperatingContract, upsertOperatingContract } from '~/services/operating'
import type { OperatingContractItem, OperatingContractStatus } from '~/services/operating'
import OperatingContractTable from '~/components/admin/property/operating/components/OperatingContractTable.vue'
import OperatingContractDetailDialog from '~/components/admin/property/operating/components/OperatingContractDetailDialog.vue'
import OperatingContractUpsertModal from '~/components/admin/property/operating/components/OperatingContractUpsertModal.vue'

const { spaces, contracts, pending, expiringItems, refresh } = useOperatingOverview()


const searchTerm = ref('')
const statusFilter = ref<'all' | OperatingContractStatus>('all')

const filteredContracts = computed(() => {
  let result = contracts.value

  if (statusFilter.value !== 'all') {
    result = result.filter((c) => c.status === statusFilter.value)
  }

  if (searchTerm.value.trim()) {
    const q = searchTerm.value.toLowerCase()
    result = result.filter((c) => String(c.tenant || '').toLowerCase().includes(q))
  }

  return result
})

const detailItem = ref<OperatingContractItem | null>(null)
const upsertOpen = ref(false)
const editingItem = ref<OperatingContractItem | null>(null)

function openDetail(item: OperatingContractItem) {
  detailItem.value = item
}

function openCreate() {
  editingItem.value = null
  upsertOpen.value = true
}

function closeUpsert() {
  upsertOpen.value = false
  editingItem.value = null
}

function exportCsv() {
  const items = filteredContracts.value

  const headers = ['合同编号', '房源', '承租方', '月租金(元)', '开始日期', '结束日期', '状态']

  const escape = (val: any) => {
    const s = String(val ?? '')
    return `"${s.replace(/"/g, '""')}"`
  }

  const rows = items.map((c) => [
    escape(c.contractNo),
    escape(c.spaceName),
    escape(c.tenant),
    escape(c.rentPerMonth),
    escape(c.startDate),
    escape(c.endDate),
    escape(c.status === 'Active' ? '履约中' : '即将到期'),
  ])

  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `合同管理_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function openEdit(item: OperatingContractItem) {
  editingItem.value = item
  upsertOpen.value = true
}

async function handleDelete(item: OperatingContractItem) {
  if (!confirm(`确定要删除合同 ${item.contractNo} 吗？`)) return

  try {
    await deleteOperatingContract(item.id)
    await refresh()
  } catch (e: any) {
    alert(e?.statusMessage || e?.message || '删除失败')
  }
}

async function handleUpsertSubmit(payload: {
  id?: string
  contractNo: string
  spaceId: string
  tenant: string
  rentPerMonth: number
  startDate: string
  endDate: string
  status: OperatingContractStatus
}) {
  try {
    await upsertOperatingContract(payload)
    await refresh()
    closeUpsert()
  } catch (e: any) {
    alert(e?.statusMessage || e?.message || '保存失败')
  }
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
  gap: 12px;
}

.page__headerActions {
  display: flex;
  gap: 10px;
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

.warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 12px;
}

.warning__title {
  font-size: 13px;
  font-weight: 800;
  color: #92400e;
}

.warning__list {
  margin-top: 8px;
  display: grid;
  gap: 6px;
}

.warning__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.warning__left {
  display: flex;
  gap: 6px;
  align-items: center;
}

.warning__tenant {
  font-weight: 700;
  color: #1f2937;
}

.warning__space {
  color: #6b7280;
}

.warning__tag {
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 2px 8px;
  border-radius: 999px;
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

.loading {
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
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border);
  background: #fff;
}

.btn:hover {
  background: #f8fafc;
  border-color: var(--primary);
  color: var(--primary);
}

.btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.btn--primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: #fff;
}
</style>
