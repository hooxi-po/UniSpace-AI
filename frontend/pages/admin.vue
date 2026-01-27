<template>
  <AdminLayout
    v-model="activeTab"
    title="后台大厅"
    subtitle="数据中心（GeoJSON + Mock 常量）"
    :tabs="tabs as unknown as { key: 'overview' | 'geo' | 'assets' | 'ops'; label: string }[]"
  >
    <template #actions>
            <button
        class="admin-btn admin-btn--primary"
              :disabled="isRefreshing"
        @click="refreshData"
            >
              <RefreshCw :size="14" :class="{ 'animate-spin': isRefreshing }" />
              {{ isRefreshing ? '更新中...' : '刷新数据' }}
            </button>
      <NuxtLink class="admin-btn admin-btn--default" to="/">
              <ArrowLeft :size="14" />
              返回地图
            </NuxtLink>
    </template>

    <template #default="{ activeTab: tab }">
      <div v-if="tab === 'overview'" class="page">
        <div class="stats">
          <div class="stat">
            <div class="stat__label">建筑资产</div>
            <div class="stat__value">{{ stats.buildings }}</div>
            <div class="stat__meta">BUILDINGS（mock）</div>
          </div>
          <div class="stat">
            <div class="stat__label">管网资产</div>
            <div class="stat__value">{{ stats.pipelines }}</div>
            <div class="stat__meta">PIPELINES（mock）</div>
        </div>
          <div class="stat">
            <div class="stat__label">告警（Critical）</div>
            <div class="stat__value">{{ stats.alertsCritical }}</div>
            <div class="stat__meta">MOCK_ALERTS（mock）</div>
        </div>
          <div class="stat">
            <div class="stat__label">工单（进行中）</div>
            <div class="stat__value">{{ stats.workOrdersProcessing }}</div>
            <div class="stat__meta">WORK_ORDERS（mock）</div>
          </div>
          </div>

        <div class="grid">
          <section class="panel panel--span2">
            <div class="panel__header">
              <div class="panel__title">实时告警</div>
            </div>
            <div class="panel__body">
              <div class="alert-list">
                <div v-if="alerts.length === 0" class="empty">暂无告警信息</div>
                  <div
                    v-for="alert in alerts"
                    :key="alert.id"
                  class="alert-item"
                    :class="{
                    'alert-item--warning': alert.level === 'warning',
                    'alert-item--critical': alert.level === 'critical'
                  }"
                >
                  <div class="alert-item__dot"></div>
                  <div class="alert-item__main">
                    <div class="alert-item__top">
                      <div class="alert-item__title">{{ alert.message }}</div>
                      <div class="alert-item__time">{{ alert.timestamp }}</div>
                    </div>
                    <div class="alert-item__meta">位置: {{ alert.location }}</div>
                      </div>
                    </div>
                  </div>
                  </div>
          </section>

          <section class="panel panel--span2">
            <div class="panel__header">
              <div class="panel__title">最近工单</div>
            </div>
            <div class="panel__body">
              <div class="table-wrap">
                <table class="table">
                    <thead>
                    <tr>
                      <th>工单ID</th>
                      <th>目标</th>
                      <th>类型</th>
                      <th class="ta-r">状态</th>
                      <th class="ta-r">日期</th>
                      </tr>
                    </thead>
                  <tbody>
                    <tr v-for="order in workOrders" :key="order.id">
                      <td class="mono">{{ order.id }}</td>
                      <td>{{ getTargetName(order.targetId) }}</td>
                      <td>
                        <span class="badge" :class="badgeClassByOrderType(order.type)">
                            {{ getOrderTypeName(order.type) }}
                          </span>
                        </td>
                      <td class="ta-r">
                        <span class="badge" :class="badgeClassByOrderStatus(order.status)">
                            {{ getOrderStatusName(order.status) }}
                          </span>
                        </td>
                      <td class="ta-r muted">{{ order.date }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__header">
              <div class="panel__title">系统状态</div>
                    </div>
            <div class="panel__body">
              <div class="kv">
                <div class="kv__row">
                  <div class="kv__key">数据更新</div>
                  <div class="kv__val mono">{{ lastUpdated }}</div>
                    </div>
                <div class="kv__row">
                  <div class="kv__key">GeoJSON 载入</div>
                  <div class="kv__val mono">{{ geoLoadStateLabel }}</div>
                  </div>
                    </div>
                    </div>
          </section>

          <section class="panel">
            <div class="panel__header">
              <div class="panel__title">快捷入口</div>
            </div>
            <div class="panel__body">
              <div class="quick">
                  <a
                    v-for="f in geoFiles"
                    :key="f.key"
                    :href="f.url"
                    target="_blank"
                  class="quick__item"
                  >
                  <div class="quick__label">{{ f.label }}</div>
                  <div class="quick__meta">下载/预览</div>
                  </a>
                </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__header">
              <div class="panel__title">数据概览</div>
                  </div>
            <div class="panel__body">
              <div class="kv">
                <div class="kv__row">
                  <div class="kv__key">Buildings（mock）</div>
                  <div class="kv__val mono">{{ buildings.length }}</div>
                  </div>
                <div class="kv__row">
                  <div class="kv__key">Pipelines（mock）</div>
                  <div class="kv__val mono">{{ pipelines.length }}</div>
                  </div>
                <div class="kv__row">
                  <div class="kv__key">GeoJSON: Buildings</div>
                  <div class="kv__val mono">{{ geoSummary.buildings?.featureCount ?? '-' }}</div>
                  </div>
                <div class="kv__row">
                  <div class="kv__key">GeoJSON: Roads</div>
                  <div class="kv__val mono">{{ geoSummary.roads?.featureCount ?? '-' }}</div>
                  </div>
                  </div>
                </div>
          </section>
          </div>
        </div>

      <div v-else-if="tab === 'geo'" class="page">
        <section class="panel">
          <div class="panel__header panel__header--row">
            <div>
              <div class="panel__title">地图数据中心</div>
              <div class="panel__subtitle">
                数据源：
                <span v-if="geoDataSource === 'static'">静态文件 /public/map/*.geojson</span>
                <span v-else>后端 API /api/v1/features</span>
              </div>
            </div>
            <div class="toolbar">
              <button class="admin-btn" :class="{ 'admin-btn--primary': geoDataSource === 'static' }" @click="geoDataSource = 'static'; refreshData()">静态文件</button>
              <button class="admin-btn" :class="{ 'admin-btn--primary': geoDataSource === 'backend' }" @click="geoDataSource = 'backend'; refreshData()">后端 API</button>
              <button class="admin-btn" @click="loadAllGeo()">重新加载</button>
            </div>
          </div>
          <div class="panel__body">
            <div class="cards">
              <div v-for="f in geoFiles" :key="f.key" class="card">
                <div class="card__top">
                  <div>
                    <div class="card__title">{{ f.label }}</div>
                    <div class="card__meta">{{ f.url }}</div>
                  </div>
                  <div class="card__actions">
                    <a class="admin-btn admin-btn--link" :href="f.url" download>下载</a>
                    <button class="admin-btn" @click="selectGeoFile(f.key)">查看</button>
                  </div>
                </div>
                <div class="card__grid">
                  <div class="card__kv">
                    <div class="card__k">features</div>
                    <div class="card__v mono">{{ geoSummary[f.key]?.featureCount ?? '-' }}</div>
                  </div>
                  <div class="card__kv">
                    <div class="card__k">geom</div>
                    <div class="card__v mono">
                      <span v-if="geoSummary[f.key]">
                        {{ Object.entries(geoSummary[f.key]?.geomTypes ?? {}).map(([k,v]) => `${k}:${v}`).join(' / ') }}
                      </span>
                      <span v-else>-</span>
                    </div>
                  </div>
                  <div class="card__kv card__kv--span2">
                    <div class="card__k">bbox</div>
                    <div class="card__v mono">{{ geoSummary[f.key]?.bboxText ?? '-' }}</div>
                  </div>
                  <div class="card__kv card__kv--span2">
                    <div class="card__k">property keys（top）</div>
                    <div class="card__v mono">{{ geoSummary[f.key]?.propertyKeysTop?.join(', ') ?? '-' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </section>

        <section class="panel">
          <div class="panel__header panel__header--row">
            <div>
              <div class="panel__title">GeoJSON 预览</div>
              <div class="panel__subtitle">当前：{{ selectedGeoLabel }}</div>
              </div>
            <div class="toolbar">
              <input class="admin-input" v-model="geoSearch" placeholder="按属性 key:value 模糊搜索（例如 name:湖）" />
              <button class="admin-btn" @click="geoSearch = ''">清空</button>
              </div>
            </div>
          <div class="panel__body">
            <div class="split">
              <div class="split__col">
                <div class="subhead">Features（最多展示 {{ GEO_PREVIEW_LIMIT }} 条）</div>
                <div class="list">
                  <div v-if="geoPreview.length === 0" class="empty">无匹配数据</div>
                  <button
                    v-for="ft in geoPreview"
                    :key="String(ft.id)"
                    class="list__item"
                    @click="openGeoDetail(ft)"
                  >
                    <div class="list__top">
                      <div class="mono">{{ String(ft.id) }}</div>
                      <div class="muted">{{ ft.geometry?.type }}</div>
                    </div>
                    <div class="list__meta">{{ previewTitle(ft) }}</div>
                  </button>
                    </div>
                  </div>
              <div class="split__col">
                <div class="subhead">字段分布（Keys）</div>
                <div class="list">
                  <div v-if="!(geoSummary[selectedGeoKey]?.propertyKeyCountsSorted?.length)" class="empty">请先加载 GeoJSON</div>
                  <div
                    v-for="row in geoSummary[selectedGeoKey]?.propertyKeyCountsSorted ?? []"
                    :key="row.key"
                    class="list__row"
                  >
                    <div class="mono">{{ row.key }}</div>
                    <div class="muted">{{ row.count }}</div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
        </section>
        </div>

      <div v-else-if="tab === 'assets'" class="page">
        <section class="panel">
          <div class="panel__header panel__header--row">
            <div>
              <div class="panel__title">资产中心（Mock）</div>
              <div class="panel__subtitle">当前展示 mock 数据</div>
              </div>
            <div class="toolbar">
              <button class="admin-btn" :class="{ 'admin-btn--primary': assetTab === 'buildings' }" @click="assetTab = 'buildings'">Buildings</button>
              <button class="admin-btn" :class="{ 'admin-btn--primary': assetTab === 'pipelines' }" @click="assetTab = 'pipelines'">Pipelines</button>
              <input class="admin-input" v-model="assetSearch" placeholder="搜索 id / name" />
            </div>
          </div>
          <div class="panel__body">
            <div class="table-wrap">
              <table v-if="assetTab === 'buildings'" class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名称</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th class="ta-r">房间数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in filteredBuildings" :key="b.id" class="row-click" @click="openAssetDetail(b)">
                    <td class="mono">{{ b.id }}</td>
                    <td>{{ b.name }}</td>
                    <td class="mono">{{ b.type }}</td>
                    <td>
                      <span class="badge" :class="b.status === 'normal' ? 'badge--success' : 'badge--warning'">
                        {{ b.status }}
                      </span>
                    </td>
                    <td class="ta-r mono">{{ b.rooms }}</td>
                  </tr>
                </tbody>
              </table>

              <table v-else class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th class="ta-r">压力</th>
                    <th class="ta-r">流量</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in filteredPipelines" :key="p.id" class="row-click" @click="openAssetDetail(p)">
                    <td class="mono">{{ p.id }}</td>
                    <td class="mono">{{ p.type }}</td>
                    <td>
                      <span class="badge" :class="badgeClassByPipelineStatus(p.status)">
                        {{ p.status }}
                      </span>
                    </td>
                    <td class="ta-r mono">{{ p.pressure }}</td>
                    <td class="ta-r mono">{{ p.flowRate }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer-note">当前显示：{{ assetTab === 'buildings' ? filteredBuildings.length : filteredPipelines.length }} 条</div>
            </div>
        </section>
        </div>

      <div v-else class="page">
        <section class="panel">
          <div class="panel__header">
            <div class="panel__title">告警 & 工单（Mock）</div>
                    </div>
          <div class="panel__body">
            <div class="split">
              <div class="split__col">
                <div class="subhead">告警列表</div>
                <div class="list">
                  <button v-for="a in alerts" :key="a.id" class="list__item" @click="openAssetDetail(a)">
                    <div class="list__top">
                      <div class="mono">{{ a.id }}</div>
                      <div class="muted">{{ a.timestamp }}</div>
                  </div>
                    <div class="list__meta">{{ a.message }}</div>
                    <div class="list__meta muted">{{ a.location }} · {{ a.level }}</div>
                  </button>
                </div>
              </div>

              <div class="split__col">
                <div class="subhead">工单列表</div>
                <div class="list">
                  <button v-for="o in workOrders" :key="o.id" class="list__item" @click="openAssetDetail(o)">
                    <div class="list__top">
                      <div class="mono">{{ o.id }}</div>
                      <div class="muted">{{ o.date }}</div>
                    </div>
                    <div class="list__meta">{{ o.description }}</div>
                    <div class="list__meta muted">{{ o.targetId }} · {{ o.type }} · {{ o.status }}</div>
                  </button>
                  </div>
                </div>
              </div>
            </div>
        </section>
        </div>

      <div v-if="detailOpen" class="drawer">
        <div class="drawer__mask" @click="closeDetail"></div>
        <div class="drawer__panel">
          <div class="drawer__header">
            <div class="drawer__title">详情</div>
            <button class="admin-btn admin-btn--link" @click="closeDetail">关闭</button>
            </div>
          <div class="drawer__body">
            <div class="kv">
              <div class="kv__row">
                <div class="kv__key">类型</div>
                <div class="kv__val mono">{{ detailType }}</div>
              </div>
              </div>

            <div class="code">
              <pre>{{ detailJson }}</pre>
        </div>

            <div class="drawer__footer">
              <button class="admin-btn" @click="copyDetail">复制 JSON</button>
            </div>
      </div>
    </div>
  </div>
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, ArrowLeft } from 'lucide-vue-next'
import type { Alert, WorkOrder, Building, PipeNode } from '~/types'
import { MOCK_ALERTS, WORK_ORDERS, BUILDINGS, PIPELINES } from '~/composables/useConstants'
import AdminLayout from '~/components/admin/AdminLayout.vue'

type GeoKey = 'water' | 'green' | 'buildings' | 'roads'

type GeoFeature = {
  id?: string | number
  type?: string
  properties?: Record<string, unknown>
  geometry?: { type?: string; coordinates?: unknown }
}

type GeoCollection = {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

type GeoSummary = {
  featureCount: number
  geomTypes: Record<string, number>
  bbox: [number, number, number, number] | null
  bboxText: string
  propertyKeyCounts: Record<string, number>
  propertyKeyCountsSorted: { key: string; count: number }[]
  propertyKeysTop: string[]
}

const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'geo', label: '地图数据中心' },
  { key: 'assets', label: '资产中心' },
  { key: 'ops', label: '告警&工单' },
] as const

type TabKey = typeof tabs[number]['key']

const activeTab = ref<TabKey>('overview')

const alerts = ref<Alert[]>(MOCK_ALERTS)
const workOrders = ref<WorkOrder[]>(WORK_ORDERS)
const buildings = ref<Building[]>(BUILDINGS)
const pipelines = ref<PipeNode[]>(PIPELINES)

const stats = computed(() => ({
  buildings: buildings.value.length,
  pipelines: pipelines.value.length,
  alertsCritical: alerts.value.filter(a => a.level === 'critical').length,
  workOrdersProcessing: workOrders.value.filter(o => o.status === 'processing').length,
}))

const GEO_PREVIEW_LIMIT = 80
const geoFiles: { key: GeoKey; label: string; url: string }[] = [
  { key: 'water', label: 'Water（水体）', url: '/map/water.geojson' },
  { key: 'green', label: 'Green（绿地）', url: '/map/green.geojson' },
  { key: 'buildings', label: 'Buildings（建筑）', url: '/map/buildings.geojson' },
  { key: 'roads', label: 'Roads（道路）', url: '/map/roads.geojson' },
]

const geoDataSource = ref<'static' | 'backend'>('static')

const geoLoadState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const geoLoadStateLabel = computed(() => {
  if (geoLoadState.value === 'idle') return '未加载'
  if (geoLoadState.value === 'loading') return '加载中'
  if (geoLoadState.value === 'loaded') return '已加载'
  return '失败'
})

const geoData = ref<Partial<Record<GeoKey, GeoCollection>>>({})
const geoSummary = ref<Partial<Record<GeoKey, GeoSummary>>>({})

const selectedGeoKey = ref<GeoKey>('water')
const selectedGeoLabel = computed(() => geoFiles.find(f => f.key === selectedGeoKey.value)?.label ?? selectedGeoKey.value)
const geoSearch = ref('')

const assetTab = ref<'buildings' | 'pipelines'>('buildings')
const assetSearch = ref('')

const detailOpen = ref(false)
const detailObj = ref<unknown>(null)
const detailType = ref('')
const detailJson = computed(() => {
  try {
    return JSON.stringify(detailObj.value, null, 2)
  } catch {
    return String(detailObj.value)
  }
})

const isRefreshing = ref(false)
const lastUpdated = ref('刚刚')

function getTargetName(targetId: string) {
  const b = buildings.value.find(x => x.id === targetId)
  if (b) return b.name
  const p = pipelines.value.find(x => x.id === targetId)
  return p ? `管网 ${p.id}` : targetId
}

function getOrderTypeName(type: string) {
  const types: Record<string, string> = { repair: '维修', inspection: '巡检', maintenance: '保养' }
  return types[type] || type
}

function getOrderStatusName(status: string) {
  const statuses: Record<string, string> = { pending: '待处理', processing: '进行中', completed: '已完成' }
  return statuses[status] || status
}

function badgeClassByOrderType(type: string) {
  if (type === 'repair') return 'badge--danger'
  if (type === 'inspection') return 'badge--info'
  if (type === 'maintenance') return 'badge--warning'
  return 'badge--default'
}

function badgeClassByOrderStatus(status: string) {
  if (status === 'completed') return 'badge--success'
  if (status === 'processing') return 'badge--warning'
  if (status === 'pending') return 'badge--default'
  return 'badge--default'
}

function badgeClassByPipelineStatus(status: string) {
  if (status === 'normal') return 'badge--success'
  if (status === 'warning') return 'badge--warning'
  if (status === 'critical') return 'badge--danger'
  return 'badge--default'
}

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

function openGeoDetail(ft: GeoFeature) {
  detailObj.value = ft
  detailType.value = `geojson:${selectedGeoKey.value}`
  detailOpen.value = true
}

function detectType(obj: unknown) {
  const o = obj as any
  if (!o) return 'unknown'
  if (o.geometry && o.properties) return 'geojson-feature'
  if (typeof o.id === 'string' && typeof o.name === 'string') return 'building'
  if (typeof o.id === 'string' && typeof o.diameter === 'string') return 'pipeline'
  if (typeof o.message === 'string' && typeof o.location === 'string') return 'alert'
  if (typeof o.description === 'string' && typeof o.targetId === 'string') return 'work-order'
  return 'unknown'
}

async function copyDetail() {
  try {
    await navigator.clipboard.writeText(detailJson.value)
  } catch {
    // ignore
  }
}

function previewTitle(ft: GeoFeature) {
  const p = ft.properties || {}
  const name = typeof p.name === 'string' ? p.name : ''
  const natural = typeof p.natural === 'string' ? p.natural : ''
  const water = typeof (p as any).water === 'string' ? (p as any).water : ''
  const building = typeof (p as any).building === 'string' ? (p as any).building : ''
  const highway = typeof (p as any).highway === 'string' ? (p as any).highway : ''
  const parts = [name, natural, water, building, highway].filter(Boolean)
  return parts.join(' · ')
}

function bboxInit(): [number, number, number, number] {
  return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
}

function bboxUpdateFromCoords(coords: any, b: [number, number, number, number]) {
  if (coords == null) return
  if (typeof coords === 'number') return
  if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const lon = coords[0]
    const lat = coords[1]
    b[0] = Math.min(b[0], lon)
    b[1] = Math.min(b[1], lat)
    b[2] = Math.max(b[2], lon)
    b[3] = Math.max(b[3], lat)
    return
  }
  if (Array.isArray(coords)) {
    for (const c of coords) bboxUpdateFromCoords(c, b)
  }
}

function buildGeoSummary(col: GeoCollection): GeoSummary {
  const geomTypes: Record<string, number> = {}
  const keyCounts: Record<string, number> = {}
  const b = bboxInit()

  for (const ft of col.features || []) {
    const gt = ft.geometry?.type || 'Unknown'
    geomTypes[gt] = (geomTypes[gt] || 0) + 1

    const props = ft.properties || {}
    for (const k of Object.keys(props)) {
      keyCounts[k] = (keyCounts[k] || 0) + 1
    }

    bboxUpdateFromCoords((ft.geometry as any)?.coordinates, b)
  }

  const hasBbox = Number.isFinite(b[0]) && Number.isFinite(b[1]) && Number.isFinite(b[2]) && Number.isFinite(b[3])
  const bbox = hasBbox ? (b as [number, number, number, number]) : null
  const bboxText = bbox ? `${bbox[0].toFixed(6)}, ${bbox[1].toFixed(6)}, ${bbox[2].toFixed(6)}, ${bbox[3].toFixed(6)}` : '-'

  const propertyKeyCountsSorted = Object.entries(keyCounts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)

  const propertyKeysTop = propertyKeyCountsSorted.slice(0, 12).map(x => x.key)

  return {
    featureCount: col.features?.length || 0,
    geomTypes,
    bbox,
    bboxText,
    propertyKeyCounts: keyCounts,
    propertyKeyCountsSorted,
    propertyKeysTop,
  }
}

async function loadGeo(key: GeoKey) {
  const url = geoFiles.find(f => f.key === key)?.url
  if (!url) return
  const res = await fetch(`${url}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  const json = (await res.json()) as GeoCollection
  geoData.value[key] = json
  geoSummary.value[key] = buildGeoSummary(json)
}

async function loadGeoFromBackend(key: GeoKey) {
  if (key === 'water' || key === 'green') {
    geoData.value[key] = { type: 'FeatureCollection', features: [] }
    geoSummary.value[key] = buildGeoSummary(geoData.value[key] as GeoCollection)
    return
  }

  const backendUrl = `http://localhost:8080/api/v1/features?layers=${encodeURIComponent(key)}&limit=2000`
  const res = await fetch(backendUrl)
  if (!res.ok) throw new Error(`Failed to fetch ${backendUrl}`)
  const json = (await res.json()) as GeoCollection
  geoData.value[key] = json
  geoSummary.value[key] = buildGeoSummary(json)
}

async function loadAllGeoFromBackend() {
  await Promise.all(geoFiles.map(f => loadGeoFromBackend(f.key)))
}

async function loadAllGeo() {
  geoLoadState.value = 'loading'
  try {
    if (geoDataSource.value === 'static') {
    await Promise.all(geoFiles.map(f => loadGeo(f.key)))
    } else {
      await loadAllGeoFromBackend()
    }
    geoLoadState.value = 'loaded'
  } catch (e) {
    geoLoadState.value = 'error'
  }
}

function selectGeoFile(key: GeoKey) {
  selectedGeoKey.value = key
  if (!geoSummary.value[key]) {
    loadAllGeo()
  }
}

const geoPreview = computed(() => {
  const col = geoData.value[selectedGeoKey.value]
  const list = (col?.features || [])

  const q = geoSearch.value.trim()
  if (!q) return list.slice(0, GEO_PREVIEW_LIMIT)

  let k = ''
  let v = ''
  const idx = q.indexOf(':')
  if (idx >= 0) {
    k = q.slice(0, idx).trim()
    v = q.slice(idx + 1).trim()
  }

  const matched = list.filter(ft => {
    const props = ft.properties || {}
    if (k) {
      const val = (props as any)[k]
      if (val == null) return false
      return String(val).toLowerCase().includes(v.toLowerCase())
    }
    return Object.values(props).some(val => String(val).toLowerCase().includes(q.toLowerCase()))
  })

  return matched.slice(0, GEO_PREVIEW_LIMIT)
})

const filteredBuildings = computed(() => {
  const q = assetSearch.value.trim().toLowerCase()
  if (!q) return buildings.value
  return buildings.value.filter(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q))
})

const filteredPipelines = computed(() => {
  const q = assetSearch.value.trim().toLowerCase()
  if (!q) return pipelines.value
  return pipelines.value.filter(p => p.id.toLowerCase().includes(q) || String(p.type).toLowerCase().includes(q))
})

function refreshData() {
  isRefreshing.value = true
  setTimeout(() => {
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    isRefreshing.value = false
    loadAllGeo()
  }, 400)
}

onMounted(() => {
  refreshData()
})
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

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.stat {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 12px;
}

.stat__label {
  font-size: 12px;
  color: var(--muted);
}

.stat__value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 700;
}

.stat__meta {
  margin-top: 6px;
  font-size: 12px;
  color: #8f959e;
}

.grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

.panel--span2 {
  grid-column: 1 / 2;
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

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #fbfbfc;
}

.alert-item__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-top: 4px;
  background: #c2c5ca;
}

.alert-item--warning {
  border-color: rgba(245, 159, 0, 0.35);
  background: rgba(245, 159, 0, 0.06);
}

.alert-item--warning .alert-item__dot {
  background: #f59f00;
}

.alert-item--critical {
  border-color: rgba(245, 74, 69, 0.35);
  background: rgba(245, 74, 69, 0.06);
}

.alert-item--critical .alert-item__dot {
  background: #f54a45;
}

.alert-item__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.alert-item__title {
  font-size: 13px;
  font-weight: 600;
}

.alert-item__time {
  font-size: 12px;
  color: var(--muted);
}

.alert-item__meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
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

.badge--info {
  background: rgba(22, 100, 255, 0.08);
  border-color: rgba(22, 100, 255, 0.22);
  color: #0f55e6;
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

.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1100px) {
  .cards {
    grid-template-columns: 1fr;
  }
}

.card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  background: #ffffff;
}

.card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card__title {
  font-size: 14px;
  font-weight: 600;
}

.card__meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.card__actions {
  display: flex;
  gap: 6px;
}

.card__grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.card__kv {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card__kv--span2 {
  grid-column: 1 / -1;
}

.card__k {
  font-size: 12px;
  color: var(--muted);
}

.card__v {
  font-size: 12px;
  word-break: break-all;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 1100px) {
  .split {
    grid-template-columns: 1fr;
  }
}

.subhead {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}

.list {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  max-height: 420px;
  overflow: auto;
}

.list__item {
  width: 100%;
  border: 0;
  background: #ffffff;
  padding: 10px 10px;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid #f0f1f2;
}

.list__item:hover {
  background: #fafbfc;
}

.list__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.list__meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-bottom: 1px solid #f0f1f2;
}

.quick {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quick__item {
  display: block;
  text-decoration: none;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
}

.quick__item:hover {
  background: #fafbfc;
}

.quick__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.quick__meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.empty {
  padding: 16px;
  text-align: center;
  color: var(--muted);
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

.muted {
  color: var(--muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
