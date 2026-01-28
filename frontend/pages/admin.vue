<template>
  <AdminLayout
    v-model="activeTab"
    v-model:subValue="activeSubTab"
    title="后台大厅"
    subtitle="资产中心"
    :tabs="tabs as unknown as { key: 'assets'; label: string }[]"
    :sub-tabs="assetSubTabs as unknown as { key: 'assets_buildings' | 'assets_pipelines'; label: string }[]"
  >
    <template #actions>
      <NuxtLink class="admin-btn admin-btn--default" to="/">
        <ArrowLeft :size="14" />
        返回地图
      </NuxtLink>
    </template>

    <template #default>
      <div class="page">
        <section class="panel">
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
              :columns="buildingColumns"
              :map-row="mapBuildingRow"
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
              :columns="roadColumns"
              :map-row="mapRoadRow"
              @select="openAssetDetail"
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
import { ref, computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import AdminLayout from '~/components/admin/AdminLayout.vue'
import GeoFeatureTable from '~/components/admin/GeoFeatureTable.vue'
import JsonDrawer from '~/components/admin/JsonDrawer.vue'

const searchPlaceholder = computed(() => {
  return activeSubTab.value === 'assets_buildings' ? '搜索 id / name' : '搜索 id / name'
})

const tabs = [{ key: 'assets', label: '资产中心' }] as const

const assetSubTabs = [
  { key: 'assets_buildings', label: '建筑数据' },
  { key: 'assets_pipelines', label: '管道数据' },
] as const

type TabKey = typeof tabs[number]['key']
type AssetSubKey = typeof assetSubTabs[number]['key']

const activeTab = ref<TabKey>('assets')
const activeSubTab = ref<AssetSubKey>('assets_buildings')

const assetSearch = ref('')

const backendBaseUrl = 'http://localhost:8080'

const currentCount = ref(0)

type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

type GeoJsonFeature = {
  type: 'Feature'
  id: string
  properties: Record<string, unknown>
  geometry: GeoJsonGeometry
}

type BuildingRow = {
  id: string
  name: string
  buildingType: string
  levels: number | null
  amenity: string
  geomType: string
  raw: GeoJsonFeature
}

type RoadRow = {
  id: string
  highway: string
  name: string
  geomType: string
  raw: GeoJsonFeature
}

const buildingColumns = [
  { key: 'id', label: 'ID', mono: true },
  { key: 'name', label: '名称' },
  { key: 'buildingType', label: '建筑类型', mono: true },
  { key: 'levels', label: '楼层', mono: true, class: 'ta-r' },
  { key: 'amenity', label: '用途', mono: true },
  { key: 'geomType', label: '几何', mono: true },
]

const roadColumns = [
  { key: 'id', label: 'ID', mono: true },
  { key: 'highway', label: '道路类型', mono: true },
  { key: 'name', label: '名称' },
  { key: 'geomType', label: '几何', mono: true },
]

function mapBuildingRow(f: GeoJsonFeature): BuildingRow {
  const p = (f.properties || {}) as Record<string, unknown>
  const name = String(p.name ?? p.short_name ?? '')
  const buildingType = String(p.building ?? p.type ?? '')
  const levelsRaw = p['building:levels']
  const levelsNum = levelsRaw == null || levelsRaw === '' ? null : Number(levelsRaw)
  const levels = Number.isFinite(levelsNum) ? (levelsNum as number) : null
  const amenity = String(p.amenity ?? p.office ?? p.shop ?? '')

  return {
    id: f.id,
    name: name || '—',
    buildingType: buildingType || '—',
    levels,
    amenity: amenity || '—',
    geomType: String(f.geometry?.type ?? '—'),
    raw: f,
  }
}

function mapRoadRow(f: GeoJsonFeature): RoadRow {
  const p = (f.properties || {}) as Record<string, unknown>
  const highway = String(p.highway ?? p.road ?? p.type ?? '')
  const name = String(p.name ?? p.ref ?? '')

  return {
    id: f.id,
    highway: highway || '—',
    name: name || '—',
    geomType: String(f.geometry?.type ?? '—'),
    raw: f,
  }
}

const detailOpen = ref(false)
const detailObj = ref<unknown>(null)
const detailType = ref('')

function closeDetail() {
  detailOpen.value = false
  detailObj.value = null
  detailType.value = ''
}

function openAssetDetail(obj: unknown) {
  detailObj.value = obj
  detailType.value = detectType(obj)
  detailOpen.value = true
}

function detectType(obj: unknown) {
  const o = obj as any
  if (!o) return 'unknown'
  if (typeof o.id === 'string' && typeof o.name === 'string') return 'building'
  if (typeof o.id === 'string' && typeof o.diameter === 'string') return 'pipeline'
  return 'unknown'
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
