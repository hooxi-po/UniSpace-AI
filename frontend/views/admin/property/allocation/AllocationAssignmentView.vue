<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">房源分配</h2>
        <p class="subtitle">管理层主动维护房源台账，并向下分配使用部门。房源数据来源于“资产转固与管理”同步台账。</p>
      </div>
      <button class="btnGhost" @click="fetchRooms">
        <RefreshCw :size="14" :class="{ spinning: loading }" /> 刷新
      </button>
    </div>

    <div class="stats">
      <div class="statCard">
        <div class="statValue">{{ stats.total }}</div>
        <div class="statLabel">房间总数</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ stats.available }}</div>
        <div class="statLabel">可分配</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ stats.occupied }}</div>
        <div class="statLabel">已占用</div>
      </div>
      <div class="statCard">
        <div class="statValue">{{ stats.availableArea.toFixed(1) }}</div>
        <div class="statLabel">可分配面积(m²)</div>
      </div>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索楼栋/房间号/部门..." />
      </div>

      <select v-model="statusFilter" class="select">
        <option value="all">全部状态</option>
        <option value="Empty">可分配</option>
        <option value="Occupied">已占用</option>
      </select>

      <select v-model="buildingFilter" class="select">
        <option value="all">全部楼栋</option>
        <option v-for="b in buildingOptions" :key="b" :value="b">{{ b }}</option>
      </select>

      <select v-model="mainCategoryFilter" class="select">
        <option value="all">全部主类</option>
        <option v-for="m in mainCategoryOptions" :key="m" :value="m">{{ m }}</option>
      </select>

      <select v-model="subCategoryFilter" class="select" :disabled="mainCategoryFilter === 'all'">
        <option value="all">全部亚类</option>
        <option v-for="s in subCategoryOptions" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div class="tableCard">
      <div v-if="loading" class="loadingState">
        <RefreshCw :size="24" class="spinning" />
        <span>加载中...</span>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>楼栋</th>
            <th>房间号</th>
            <th>楼层</th>
            <th>面积</th>
            <th>功能主类</th>
            <th>功能亚类</th>
            <th>状态</th>
            <th>使用部门</th>
            <th class="right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filteredRooms" :key="r.id" class="row">
            <td>{{ r.buildingName }}</td>
            <td class="mono">{{ r.roomNo }}</td>
            <td>{{ r.floor }}</td>
            <td>{{ r.area }} m²</td>
            <td>{{ r.functionMain || '-' }}</td>
            <td>{{ r.functionSub || '-' }}</td>
            <td>
              <span :class="['badge', r.status === 'Empty' ? 'badgeOk' : 'badgeGray']">
                {{ r.status === 'Empty' ? '可分配' : '已占用' }}
              </span>
            </td>
            <td>{{ r.department || '-' }}</td>
            <td class="right">
              <button class="link" @click="openEdit(r)">
                <Edit :size="14" /> 编辑/分配
              </button>
            </td>
          </tr>

          <tr v-if="filteredRooms.length === 0">
            <td class="empty" colspan="8">暂无符合条件的房源</td>
          </tr>
        </tbody>
      </table>
    </div>

    <RoomEditModal
      v-if="editingRoom"
      :room="editingRoom"
      @close="editingRoom = null"
      @save="onSaveRoom"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Edit, RefreshCw, Search } from 'lucide-vue-next'
import type { Room } from '~/server/utils/fixation-stock-db'
import { useAllocationAssignment } from '~/composables/useAllocationAssignment'
import RoomEditModal from '~/components/admin/property/allocation/components/RoomEditModal.vue'

const {
  rooms,
  loading,
  stats,
  fetchRooms,
  activeAssign,
} = useAllocationAssignment()

const searchTerm = ref('')
const statusFilter = ref<'all' | Room['status']>('all')
const buildingFilter = ref<'all' | string>('all')
const mainCategoryFilter = ref<'all' | string>('all')
const subCategoryFilter = ref<'all' | string>('all')

import { watch } from 'vue'
watch(mainCategoryFilter, () => {
  subCategoryFilter.value = 'all'
})

const editingRoom = ref<Room | null>(null)

const buildingOptions = computed(() => {
  const set = new Set<string>()
  ;(rooms.value || []).forEach(r => {
    if (r.buildingName) set.add(String(r.buildingName))
  })
  return Array.from(set).sort()
})

const mainCategoryOptions = computed(() => {
  const set = new Set<string>()
  ;(rooms.value || []).forEach(r => {
    if (r.functionMain) set.add(r.functionMain)
  })
  return Array.from(set).sort()
})

const subCategoryOptions = computed(() => {
  const set = new Set<string>()
  const list = (rooms.value || []) as unknown as Room[]
  
  list.forEach(r => {
    if (mainCategoryFilter.value === 'all') {
      if (r.functionSub) set.add(r.functionSub)
    } else if (r.functionMain === mainCategoryFilter.value && r.functionSub) {
      set.add(r.functionSub)
    }
  })
  return Array.from(set).sort()
})

const filteredRooms = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  const list = (rooms.value || []) as unknown as Room[]

  let result = list
  if (statusFilter.value !== 'all') {
    result = result.filter(r => r.status === statusFilter.value)
  }

  if (buildingFilter.value !== 'all') {
    result = result.filter(r => r.buildingName === buildingFilter.value)
  }

  if (mainCategoryFilter.value !== 'all') {
    result = result.filter(r => r.functionMain === mainCategoryFilter.value)
  }

  if (subCategoryFilter.value !== 'all') {
    result = result.filter(r => r.functionSub === subCategoryFilter.value)
  }

  if (!q) return result

  return result.filter(r =>
    (r.buildingName || '').toLowerCase().includes(q) ||
    (r.roomNo || '').toLowerCase().includes(q) ||
    (r.department || '').toLowerCase().includes(q)
  )
})

function openEdit(room: Room) {
  editingRoom.value = room
}

async function onSaveRoom(payload: { id: string; updates: Partial<Room>; notification: string; assigneeType: 'college' | 'person' }) {
  try {
    await activeAssign(payload)
    alert('房源分配成功，通知已发送，操作记录已同步至“调整记录”。')
    editingRoom.value = null
  } catch (err) {
    console.error('分配失败:', err)
    alert('分配失败，请重试')
  }
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: #646a73;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.statCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
}

.statValue {
  font-size: 20px;
  font-weight: 800;
  color: #1f2329;
}

.statLabel {
  margin-top: 4px;
  font-size: 12px;
  color: #646a73;
}

.filterCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
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
  color: #8f959e;
}

.searchInput {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px 10px 10px 34px;
  font-size: 13px;
}

.select {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px 10px;
  font-size: 13px;
  background: #fff;
}

.tableCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  position: relative;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table thead {
  background: #f8fafc;
  color: #646a73;
}

.table th,
.table td {
  padding: 12px 12px;
  border-bottom: 1px solid #eef0f2;
  text-align: left;
  vertical-align: middle;
}

.right {
  text-align: right;
}

.row:hover {
  background: #f8fafc;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: #646a73;
}

.link {
  border: none;
  background: transparent;
  color: #3370ff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badgeOk {
  background: #dcfce7;
  color: #15803d;
}

.badgeGray {
  background: #e5e7eb;
  color: #374151;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.loadingState {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: 1fr 1fr;
  }
  .filterCard {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
