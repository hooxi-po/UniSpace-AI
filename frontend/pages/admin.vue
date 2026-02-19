<template>
  <AdminLayout
    v-model="activeTab"
    v-model:subValue="activeSubTab"
    v-model:thirdValue="activeThirdTab"
    title="后台大厅"
    :subtitle="activeTab === 'assets' ? '资产中心' : activeTab === 'property' ? '房产管理' : activeTab === 'persons' ? '人员管理' : ''"
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
              <div class="panel__title">资产中心</div>
              <div class="panel__subtitle">支持建筑/管道数据 CRUD</div>
            </div>
            <div class="toolbar">
              <input class="admin-input" v-model="assetSearch" :placeholder="searchPlaceholder" />
              <button
                v-if="activeSubTab === 'assets_pipelines'"
                class="admin-btn"
                type="button"
                @click="openPipeEditor"
              >
                二维地图编辑
              </button>
              <button class="admin-btn admin-btn--primary" type="button" @click="openCreateAsset">
                {{ assetCreateLabel }}
              </button>
            </div>
          </div>
          <div class="panel__body">
            <div v-if="assetNotice" :class="['asset-notice', `asset-notice--${assetNotice.type}`]">
              {{ assetNotice.text }}
            </div>

            <GeoFeatureTable
              v-if="activeSubTab === 'assets_buildings'"
              :active="activeSubTab === 'assets_buildings'"
              :reload-key="assetReloadKey"
              :backend-base-url="backendBaseUrl"
              layer="buildings"
              :search="assetSearch"
              :search-keys="['id', 'name', 'buildingType', 'amenity', 'geomType']"
              :columns="buildingColumns as any"
              :map-row="mapBuildingRow as any"
              :cell="assetCell"
              @select="handleAssetSelect"
              @count="currentCount = $event"
            />

            <GeoFeatureTable
              v-else
              :active="activeSubTab === 'assets_pipelines'"
              :reload-key="assetReloadKey"
              :backend-base-url="backendBaseUrl"
              layer="pipes"
              :search="assetSearch"
              :search-keys="['id', 'name', 'pipeCategory', 'highway', 'geomType']"
              :columns="roadColumns as any"
              :map-row="mapRoadRow as any"
              :cell="assetCell"
              @select="handleAssetSelect"
              @count="currentCount = $event"
            />

            <div class="footer-note">当前显示：{{ currentCount }} 条（{{ assetLayerLabel }}）</div>
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

      <AssetFeatureDialog
        :open="editorOpen"
        :mode="editorMode"
        :layer="activeAssetLayer"
        :payload="editorPayload"
        :submitting="editorSubmitting"
        :api-error="editorError"
        @close="closeEditor"
        @submit="submitEditor"
      />

      <AssetDeleteDialog
        :open="deleteOpen"
        :id="deleteTargetId"
        :submitting="deleteSubmitting"
        :error="deleteError"
        @close="closeDeleteDialog"
        @confirm="confirmDelete"
      />

      <Pipe2DEditorDialog
        :open="pipeEditorOpen"
        :backend-base-url="backendBaseUrl"
        :initial-feature-id="pipeEditorFeatureId"
        @close="pipeEditorOpen = false"
        @saved="handlePipeEditorSaved"
      />
    </template>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import type { SubKey, ThirdKey } from '~/types/admin'
import type { AssetLayer } from '~/services/geo-features'

import AdminLayout from '~/components/admin/AdminLayout.vue'
import GeoFeatureTable from '~/components/admin/GeoFeatureTable.vue'
import PropertyTable from '~/components/admin/PropertyTable.vue'
import JsonDrawer from '~/components/admin/JsonDrawer.vue'
import AssetFeatureDialog from '~/components/admin/AssetFeatureDialog.vue'
import AssetDeleteDialog from '~/components/admin/AssetDeleteDialog.vue'
import Pipe2DEditorDialog from '~/components/admin/Pipe2DEditorDialog.vue'

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
import { useAssetCrud } from '~/composables/admin/useAssetCrud'
import { normalizeBackendBaseUrl } from '~/utils/backend-url'

const compMap = adminCompMap

const searchPlaceholder = computed(() => {
  if (activeTab.value === 'property') return '搜索 id / 名称 / 类型'
  return activeSubTab.value === 'assets_buildings'
    ? '搜索 ID / 名称 / 建筑类型 / 用途'
    : '搜索 ID / 名称 / 管道类别 / 道路类型'
})

const tabs = computed(() => getTabs())

type TabKey = typeof tabs.value[number]['key']

const activeTab = ref<TabKey>('assets')
const activeSubTab = ref<SubKey>('assets_buildings')
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

type AssetFeatureLike = Record<string, unknown> & { id?: string | number | null }

const assetSearch = ref('')
const runtimeConfig = useRuntimeConfig()
const backendBaseUrl = normalizeBackendBaseUrl(runtimeConfig.public.backendBaseUrl as string | undefined)
const currentCount = ref(0)
const assetReloadKey = ref(0)
const pipeEditorOpen = ref(false)
const pipeEditorFeatureId = ref<string | null>(null)

const { detailOpen, detailObj, detailType, closeDetail, openAssetDetail, openPropertyDetail } = useAdminDetail()

const activeAssetLayer = computed<AssetLayer>(() => {
  return activeSubTab.value === 'assets_buildings' ? 'buildings' : 'pipes'
})

const assetLayerLabel = computed(() => {
  return activeAssetLayer.value === 'buildings' ? '建筑' : '管道'
})

const {
  assetNotice,
  assetCreateLabel,
  editorOpen,
  editorMode,
  editorPayload,
  editorSubmitting,
  editorError,
  deleteOpen,
  deleteTargetId,
  deleteSubmitting,
  deleteError,
  openCreateAsset,
  closeEditor,
  submitEditor,
  closeDeleteDialog,
  confirmDelete,
  assetCell,
} = useAssetCrud({
  backendBaseUrl,
  activeAssetLayer,
  onReload: () => {
    assetReloadKey.value += 1
  },
})

function handleAssetSelect(feature: AssetFeatureLike) {
  if (activeAssetLayer.value === 'pipes') {
    pipeEditorFeatureId.value = feature?.id ? String(feature.id) : null
  }
  openAssetDetail(feature)
}

function openPipeEditor() {
  pipeEditorOpen.value = true
}

function handlePipeEditorSaved(id: string) {
  pipeEditorFeatureId.value = id
  assetReloadKey.value += 1
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

.asset-notice {
  margin-bottom: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  padding: 8px 10px;
  font-size: 12px;
}

.asset-notice--success {
  border-color: rgba(18, 166, 90, 0.26);
  background: rgba(18, 166, 90, 0.08);
  color: #0f7a41;
}

.asset-notice--error {
  border-color: rgba(245, 74, 69, 0.26);
  background: rgba(245, 74, 69, 0.08);
  color: #c03631;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.footer-note {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
}
</style>
