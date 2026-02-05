<template>
  <AdminLayout
    v-model="activeTab"
    v-model:subValue="activeSubTab"
    v-model:thirdValue="activeThirdTab"
    title="后台大厅"
    :subtitle="activeTab === 'assets' ? '资产中心' : activeTab === 'property' ? '房产管理' : ''"
    :tabs="tabs"
    :sub-tabs="currentSubTabs"
    :third-tabs="currentThirdTabs"
  >
    <template #actions>
      <NuxtLink class="admin-btn admin-btn--default" to="/">
        <ArrowLeft :size="14" />
        返回地图
      </NuxtLink>
    </template>

    <template #default>
      <div class="page">
        <component v-if="activeThirdTab && compMap[activeThirdTab]" :is="compMap[activeThirdTab]" />

        <section v-else-if="activeTab === 'assets'" class="panel">
          <div class="panel__header panel__header--row">
            <div>
              <div class="panel__title">资产中心（Mock）</div>
              <div class="panel__subtitle">当前展示 mock 数据</div>
            </div>
            <div class="toolbar">
              <input class="admin-input" v-model="assetSearch" :placeholder="searchPlaceholder" />
            </div>
          </div>
          <div class="panel__body">
            <GeoFeatureTable
              v-if="activeSubTab === 'assets_buildings'"
              :active="activeSubTab === 'assets_buildings'"
              :backend-base-url="backendBaseUrl"
              layer="buildings"
              :search="assetSearch"
              :search-keys="['id', 'name', 'buildingType', 'amenity', 'geomType']"
              :columns="buildingColumns as any"
              :map-row="mapBuildingRow as any"
              :cell="assetBuildingCell"
              @select="openAssetDetail"
              @count="currentCount = $event"
            />

            <GeoFeatureTable
              v-else
              :active="activeSubTab === 'assets_pipelines'"
              :backend-base-url="backendBaseUrl"
              layer="roads"
              :search="assetSearch"
              :search-keys="['id', 'name', 'highway', 'geomType']"
              :columns="roadColumns as any"
              :map-row="mapRoadRow as any"
              @select="openAssetDetail"
              @count="currentCount = $event"
            />

            <div class="footer-note">当前显示：{{ currentCount }} 条</div>
          </div>
        </section>

        <section v-else class="panel" v-show="!activeThirdTab">
          <div class="panel__header panel__header--row">
            <div>
              <div class="panel__title">房产管理（Mock）</div>
              <div class="panel__subtitle">当前展示 mock 数据</div>
            </div>
            <div class="toolbar">
              <input class="admin-input" v-model="assetSearch" :placeholder="searchPlaceholder" />
            </div>
          </div>

          <div class="panel__body">
            <PropertyTable
              :active="activeTab === 'property'"
              :search="assetSearch"
              :search-keys="['id', 'name', 'type', 'status', 'location']"
              :columns="propertyColumns"
              @select="openPropertyDetail"
              @count="currentCount = $event"
            />

            <div class="footer-note">当前显示：{{ currentCount }} 条</div>
          </div>
        </section>
      </div>

      <JsonDrawer
        :open="detailOpen"
        title="详情"
        :meta-label="detailType"
        :obj="detailObj"
        @close="closeDetail"
      />
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import type { ThirdKey } from '~/types/admin'

import AdminLayout from '~/components/admin/AdminLayout.vue'
import GeoFeatureTable from '~/components/admin/GeoFeatureTable.vue'
import PropertyTable from '~/components/admin/PropertyTable.vue'
import JsonDrawer from '~/components/admin/JsonDrawer.vue'

import { adminCompMap } from '~/config/admin-comp-map'
import { getTabs, getSubTabs, getThirdTabs } from '~/config/admin-menu'
import {
  buildingColumns,
  roadColumns,
  propertyColumns,
  mapBuildingRow,
  mapRoadRow,
} from '~/utils/admin-tables'
import { useAdminDetail } from '~/composables/useAdminDetail'

const compMap = adminCompMap

const searchPlaceholder = computed(() => {
  if (activeTab.value === 'property') return '搜索 id / 名称 / 类型'
  return activeSubTab.value === 'assets_buildings' ? '搜索 id / name' : '搜索 id / name'
})

const tabs = computed(() => getTabs())

type TabKey = typeof tabs.value[number]['key']

const activeTab = ref<TabKey>('assets')
const activeSubTab = ref<any>('assets_buildings')
const activeThirdTab = ref<ThirdKey | undefined>(undefined)

const currentSubTabs = computed(() => getSubTabs(activeTab.value))
const currentThirdTabs = computed(() => getThirdTabs(activeTab.value, activeSubTab.value))

watch(activeTab, () => {
  const subs = currentSubTabs.value
  if (subs.length && !subs.some(s => s.key === activeSubTab.value)) {
    activeSubTab.value = subs[0].key
  }
})

watch([activeTab, activeSubTab], () => {
  activeThirdTab.value = undefined
})

watch(currentThirdTabs, (tabs) => {
  if (!tabs.length) {
    activeThirdTab.value = undefined
    return
  }
  if (!activeThirdTab.value || !tabs.some(t => t.key === activeThirdTab.value)) {
    activeThirdTab.value = tabs[0].key
  }
}, { immediate: true })

const assetSearch = ref('')
const backendBaseUrl = 'http://localhost:8080'
const currentCount = ref(0)

const { detailOpen, detailObj, detailType, closeDetail, openAssetDetail, openPropertyDetail } = useAdminDetail()

function assetBuildingCell(row: any, colKey: string) {
  if (colKey === 'visible') {
    return h('label', { class: 'switch' }, [
      h('input', {
        type: 'checkbox',
        checked: !!row.visible,
        onChange: async (e: Event) => {
          const target = e.target as HTMLInputElement
          const newVisible = target.checked

          // optimistic UI
          const old = !!row.visible
          row.visible = newVisible

          try {
            const res = await fetch(
              `${backendBaseUrl}/api/v1/features/visibility`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row.id, visible: newVisible }),
              }
            )
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
          } catch (err) {
            console.error('Failed to update visibility:', err)
            row.visible = old
            target.checked = old
          }
        },
      }),
      h('span'),
    ])
  }
  return null
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;

  border-radius: 8px;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text);

  font-size: 13px;
  line-height: 30px;
  cursor: pointer;
  user-select: none;
}

.admin-btn:hover {
  background: #f8f9fa;
}

.admin-btn:disabled {
  cursor: not-allowed;
  color: #a6a9ad;
  background: #f3f4f5;
}

.admin-btn--primary {
  border-color: rgba(22, 100, 255, 0.35);
  background: var(--primary);
  color: #ffffff;
}

.admin-btn--primary:hover {
  background: #0f55e6;
}

.admin-btn--default {
  text-decoration: none;
}

.admin-btn--link {
  border-color: transparent;
  background: transparent;
  color: var(--primary);
  padding: 0 6px;
}

.admin-btn--link:hover {
  background: rgba(22, 100, 255, 0.08);
}

.admin-input {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  min-width: 240px;
  outline: none;
  font-size: 13px;
  background: #ffffff;
  color: var(--text);
}

.admin-input:focus {
  border-color: rgba(22, 100, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(22, 100, 255, 0.12);
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

.panel__header {
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border);
}

.panel__header--row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel__title {
  font-size: 14px;
  font-weight: 600;
}

.panel__subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.panel__body {
  padding: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.table-wrap {
  width: 100%;
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.table thead th {
  position: sticky;
  top: 0;
  background: #ffffff;
  text-align: left;
  font-weight: 600;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  padding: 10px 10px;
}

.table tbody td {
  padding: 10px 10px;
  border-bottom: 1px solid #f0f1f2;
}

.table tbody tr:hover {
  background: #fafbfc;
}

.row-click {
  cursor: pointer;
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: #f6f7f8;
  color: var(--muted);
}

.badge--success {
  background: rgba(18, 166, 90, 0.08);
  border-color: rgba(18, 166, 90, 0.22);
  color: #0f7a41;
}

.badge--warning {
  background: rgba(245, 159, 0, 0.08);
  border-color: rgba(245, 159, 0, 0.22);
  color: #b26a00;
}

.badge--danger {
  background: rgba(245, 74, 69, 0.08);
  border-color: rgba(245, 74, 69, 0.22);
  color: #c03631;
}

.badge--default {
  background: #f6f7f8;
  border-color: var(--border);
  color: var(--muted);
}

.kv {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kv__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.kv__key {
  font-size: 12px;
  color: var(--muted);
}

.kv__val {
  font-size: 12px;
}

.code {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #0b1220;
  color: #e6edf3;
  padding: 10px;
  max-height: 70vh;
  overflow: auto;
}

.code pre {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.drawer {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.drawer__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.drawer__panel {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 560px;
  max-width: 100%;
  background: #ffffff;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.drawer__header {
  padding: 12px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer__title {
  font-weight: 600;
}

.drawer__body {
  padding: 12px;
  overflow: auto;
}

.drawer__footer {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.footer-note {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
}

.ta-r {
  text-align: right;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
