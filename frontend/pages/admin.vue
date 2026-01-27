<template>
  <div class="min-h-screen bg-tech-bg text-white">
    <TopNav />

    <div class="pt-16 pb-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Header -->
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-2xl font-bold tracking-wide text-white">后台大厅</h2>
            <p class="text-xs text-gray-400 font-mono mt-1">数据中心（本地 GeoJSON + Mock 常量）</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="refreshData"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-white/5 hover:bg-white/10 border border-tech-cyan/30 text-tech-cyan transition-colors"
              :disabled="isRefreshing"
            >
              <RefreshCw :size="14" :class="{ 'animate-spin': isRefreshing }" />
              {{ isRefreshing ? '更新中...' : '刷新数据' }}
            </button>
            <NuxtLink
              to="/"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
            >
              <ArrowLeft :size="14" />
              返回地图
            </NuxtLink>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
          <button
            v-for="t in tabs"
            :key="t.key"
            @click="activeTab = t.key"
            class="px-3 py-2 text-xs font-mono rounded border transition-colors"
            :class="activeTab === t.key
              ? 'bg-white/10 border-tech-cyan/40 text-tech-cyan'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- TAB: 概览 -->
        <div v-if="activeTab === 'overview'" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TechPanel class="!p-4 border border-tech-cyan/20 bg-white/5">
              <div class="text-xs text-gray-400 font-mono">建筑资产</div>
              <div class="mt-1 text-2xl font-bold font-mono">{{ stats.buildings }}</div>
              <div class="mt-2 text-[10px] text-gray-500 font-mono">BUILDINGS（mock）</div>
            </TechPanel>
            <TechPanel class="!p-4 border border-tech-blue/20 bg-white/5">
              <div class="text-xs text-gray-400 font-mono">管网资产</div>
              <div class="mt-1 text-2xl font-bold font-mono">{{ stats.pipelines }}</div>
              <div class="mt-2 text-[10px] text-gray-500 font-mono">PIPELINES（mock）</div>
            </TechPanel>
            <TechPanel class="!p-4 border border-amber-500/20 bg-white/5">
              <div class="text-xs text-gray-400 font-mono">告警（Critical）</div>
              <div class="mt-1 text-2xl font-bold font-mono">{{ stats.alertsCritical }}</div>
              <div class="mt-2 text-[10px] text-gray-500 font-mono">MOCK_ALERTS（mock）</div>
            </TechPanel>
            <TechPanel class="!p-4 border border-purple-500/20 bg-white/5">
              <div class="text-xs text-gray-400 font-mono">工单（进行中）</div>
              <div class="mt-1 text-2xl font-bold font-mono">{{ stats.workOrdersProcessing }}</div>
              <div class="mt-2 text-[10px] text-gray-500 font-mono">WORK_ORDERS（mock）</div>
            </TechPanel>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 space-y-6">
              <TechPanel title="实时告警" class="h-full">
                <div class="space-y-3">
                  <div
                    v-for="alert in alerts"
                    :key="alert.id"
                    class="p-3 rounded border-l-4 flex items-start gap-3"
                    :class="{
                      'bg-amber-500/5 border-amber-500': alert.level === 'warning',
                      'bg-red-500/5 border-red-500': alert.level === 'critical',
                      'bg-white/5 border-white/10': !['warning', 'critical'].includes(alert.level)
                    }"
                  >
                    <div class="mt-0.5">
                      <div v-if="alert.level === 'critical'" class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                      <div v-else-if="alert.level === 'warning'" class="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <div v-else class="w-2.5 h-2.5 rounded-full bg-gray-500"></div>
                    </div>
                    <div class="flex-1">
                      <div class="flex justify-between items-start gap-3">
                        <h4 class="text-sm font-medium text-white">{{ alert.message }}</h4>
                        <span class="text-xs text-gray-400 font-mono whitespace-nowrap">{{ alert.timestamp }}</span>
                      </div>
                      <p class="text-xs text-gray-400 mt-1">位置: {{ alert.location }}</p>
                    </div>
                  </div>
                  <div v-if="alerts.length === 0" class="text-center py-6 text-sm text-gray-500">
                    暂无告警信息
                  </div>
                </div>
              </TechPanel>

              <TechPanel title="最近工单" class="h-full">
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="text-left text-xs text-gray-400 border-b border-white/10">
                        <th class="pb-2 font-medium">工单ID</th>
                        <th class="pb-2 font-medium">目标</th>
                        <th class="pb-2 font-medium">类型</th>
                        <th class="pb-2 font-medium text-right">状态</th>
                        <th class="pb-2 font-medium text-right">日期</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                      <tr v-for="order in workOrders" :key="order.id" class="hover:bg-white/5">
                        <td class="py-3 text-sm font-mono">{{ order.id }}</td>
                        <td class="py-3 text-sm">{{ getTargetName(order.targetId) }}</td>
                        <td class="py-3">
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            :class="{
                              'bg-red-100 text-red-800': order.type === 'repair',
                              'bg-blue-100 text-blue-800': order.type === 'inspection',
                              'bg-yellow-100 text-yellow-800': order.type === 'maintenance'
                            }"
                          >
                            {{ getOrderTypeName(order.type) }}
                          </span>
                        </td>
                        <td class="py-3 text-right">
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            :class="{
                              'bg-green-100 text-green-800': order.status === 'completed',
                              'bg-yellow-100 text-yellow-800': order.status === 'processing',
                              'bg-gray-100 text-gray-800': order.status === 'pending'
                            }"
                          >
                            {{ getOrderStatusName(order.status) }}
                          </span>
                        </td>
                        <td class="py-3 text-sm text-right text-gray-400">{{ order.date }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </TechPanel>
            </div>

            <div class="space-y-6">
              <TechPanel title="系统状态">
                <div class="space-y-4">
                  <div>
                    <div class="flex justify-between text-xs text-gray-400 mb-1">
                      <span>数据更新</span>
                      <span class="font-mono">{{ lastUpdated }}</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-1.5">
                      <div class="bg-tech-cyan h-1.5 rounded-full" style="width: 100%"></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between text-xs text-gray-400 mb-1">
                      <span>GeoJSON 载入</span>
                      <span class="font-mono">{{ geoLoadStateLabel }}</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        class="h-1.5 rounded-full"
                        :class="geoLoadState === 'loaded' ? 'bg-green-500' : geoLoadState === 'loading' ? 'bg-amber-500' : 'bg-red-500'"
                        :style="{ width: geoLoadState === 'loaded' ? '100%' : geoLoadState === 'loading' ? '60%' : '30%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </TechPanel>

              <TechPanel title="快捷入口">
                <div class="grid grid-cols-2 gap-3">
                  <a
                    v-for="f in geoFiles"
                    :key="f.key"
                    :href="f.url"
                    class="p-3 rounded border border-white/10 hover:bg-white/5 transition-colors text-center"
                    target="_blank"
                  >
                    <div class="text-xs text-gray-200 font-mono">{{ f.label }}</div>
                    <div class="mt-1 text-[10px] text-gray-500 font-mono">下载/预览</div>
                  </a>
                </div>
              </TechPanel>

              <TechPanel title="数据概览">
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-300">Buildings（mock）</span>
                    <span class="text-sm font-mono">{{ buildings.length }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-300">Pipelines（mock）</span>
                    <span class="text-sm font-mono">{{ pipelines.length }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-300">GeoJSON: Water</span>
                    <span class="text-sm font-mono">{{ geoSummary.water?.featureCount ?? '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-300">GeoJSON: Green</span>
                    <span class="text-sm font-mono">{{ geoSummary.green?.featureCount ?? '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-300">GeoJSON: Buildings</span>
                    <span class="text-sm font-mono">{{ geoSummary.buildings?.featureCount ?? '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-gray-300">GeoJSON: Roads</span>
                    <span class="text-sm font-mono">{{ geoSummary.roads?.featureCount ?? '-' }}</span>
                  </div>
                </div>
              </TechPanel>
            </div>
          </div>
        </div>

        <!-- TAB: 地图数据中心 -->
        <div v-else-if="activeTab === 'geo'" class="space-y-6">
          <TechPanel title="地图数据中心（GeoJSON）">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div class="text-xs text-gray-400 font-mono">
                数据源：
                <span v-if="geoDataSource === 'static'">/public/map/*.geojson（浏览器 fetch）</span>
                <span v-else>后端 API（/api/v1/features）</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="geoDataSource = 'static'; refreshData()"
                  class="px-3 py-1.5 text-xs font-mono rounded border transition-colors"
                  :class="geoDataSource === 'static'
                    ? 'bg-white/10 border-tech-cyan/40 text-tech-cyan'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'"
                >
                  静态文件
                </button>
                <button
                  @click="geoDataSource = 'backend'; refreshData()"
                  class="px-3 py-1.5 text-xs font-mono rounded border transition-colors"
                  :class="geoDataSource === 'backend'
                    ? 'bg-white/10 border-tech-cyan/40 text-tech-cyan'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'"
                >
                  后端 API
                </button>
                <button
                  @click="loadAllGeo()"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-white/5 hover:bg-white/10 border border-tech-cyan/30 text-tech-cyan transition-colors"
                >
                  <RefreshCw :size="14" :class="{ 'animate-spin': geoLoadState === 'loading' }" />
                  重新加载
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div
                v-for="f in geoFiles"
                :key="f.key"
                class="bg-white/5 border border-white/10 rounded p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-bold">{{ f.label }}</div>
                    <div class="text-[10px] text-gray-500 font-mono mt-1">{{ f.url }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <a
                      :href="f.url"
                      class="px-2 py-1 text-[10px] font-mono rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                      download
                    >
                      下载
                    </a>
                    <button
                      class="px-2 py-1 text-[10px] font-mono rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                      @click="selectGeoFile(f.key)"
                    >
                      查看
                    </button>
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div class="text-gray-500 font-mono">features</div>
                    <div class="font-mono text-gray-200">{{ geoSummary[f.key]?.featureCount ?? '-' }}</div>
                  </div>
                  <div>
                    <div class="text-gray-500 font-mono">geom</div>
                    <div class="font-mono text-gray-200">
                      <span v-if="geoSummary[f.key]">
                        {{ Object.entries(geoSummary[f.key]?.geomTypes ?? {}).map(([k,v]) => `${k}:${v}`).join(' / ') }}
                      </span>
                      <span v-else>-</span>
                    </div>
                  </div>
                  <div class="col-span-2">
                    <div class="text-gray-500 font-mono">bbox</div>
                    <div class="font-mono text-gray-200 break-all">{{ geoSummary[f.key]?.bboxText ?? '-' }}</div>
                  </div>
                  <div class="col-span-2">
                    <div class="text-gray-500 font-mono">property keys（top）</div>
                    <div class="font-mono text-gray-200 break-all">
                      {{ geoSummary[f.key]?.propertyKeysTop?.join(', ') ?? '-' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TechPanel>

          <TechPanel title="GeoJSON 预览">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 font-mono">当前：</span>
                <span class="text-xs text-gray-200 font-mono">{{ selectedGeoLabel }}</span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="geoSearch"
                  class="w-full md:w-80 px-3 py-2 text-xs font-mono rounded bg-black/40 border border-white/10 text-gray-200 outline-none focus:border-tech-cyan/40"
                  placeholder="按属性 key:value 模糊搜索（例如 name:湖）"
                />
                <button
                  @click="geoSearch = ''"
                  class="px-2 py-2 text-xs font-mono rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                >
                  清空
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-white/5 border border-white/10 rounded p-3">
                <div class="text-xs text-gray-400 font-mono mb-2">Features（最多展示 {{ GEO_PREVIEW_LIMIT }} 条）</div>
                <div class="max-h-[420px] overflow-auto">
                  <div
                    v-for="ft in geoPreview"
                    :key="String(ft.id)"
                    class="p-2 rounded hover:bg-white/5 cursor-pointer"
                    @click="openGeoDetail(ft)"
                  >
                    <div class="flex justify-between gap-3">
                      <div class="text-xs text-gray-200 font-mono break-all">{{ String(ft.id) }}</div>
                      <div class="text-[10px] text-gray-500 font-mono">{{ ft.geometry?.type }}</div>
                    </div>
                    <div class="mt-1 text-[10px] text-gray-400 break-all">
                      {{ previewTitle(ft) }}
                    </div>
                  </div>
                  <div v-if="geoPreview.length === 0" class="text-center text-xs text-gray-500 py-8">
                    无匹配数据
                  </div>
                </div>
              </div>

              <div class="bg-white/5 border border-white/10 rounded p-3">
                <div class="text-xs text-gray-400 font-mono mb-2">字段分布（Keys）</div>
                <div class="max-h-[420px] overflow-auto">
                  <div
                    v-for="row in geoSummary[selectedGeoKey]?.propertyKeyCountsSorted ?? []"
                    :key="row.key"
                    class="flex items-center justify-between py-1 border-b border-white/5"
                  >
                    <div class="text-xs text-gray-300 font-mono break-all">{{ row.key }}</div>
                    <div class="text-xs text-gray-400 font-mono">{{ row.count }}</div>
                  </div>
                  <div v-if="!(geoSummary[selectedGeoKey]?.propertyKeyCountsSorted?.length)" class="text-center text-xs text-gray-500 py-8">
                    请先加载 GeoJSON
                  </div>
                </div>
              </div>
            </div>
          </TechPanel>
        </div>

        <!-- TAB: 资产中心 -->
        <div v-else-if="activeTab === 'assets'" class="space-y-6">
          <TechPanel title="资产中心（Mock）">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div class="flex items-center gap-2">
                <button
                  @click="assetTab = 'buildings'"
                  class="px-3 py-2 text-xs font-mono rounded border"
                  :class="assetTab === 'buildings' ? 'bg-white/10 border-tech-cyan/40 text-tech-cyan' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'"
                >
                  Buildings
                </button>
                <button
                  @click="assetTab = 'pipelines'"
                  class="px-3 py-2 text-xs font-mono rounded border"
                  :class="assetTab === 'pipelines' ? 'bg-white/10 border-tech-cyan/40 text-tech-cyan' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'"
                >
                  Pipelines
                </button>
              </div>
              <input
                v-model="assetSearch"
                class="w-full md:w-80 px-3 py-2 text-xs font-mono rounded bg-black/40 border border-white/10 text-gray-200 outline-none focus:border-tech-cyan/40"
                placeholder="搜索 id / name"
              />
            </div>

            <div class="mt-4 overflow-x-auto">
              <table v-if="assetTab === 'buildings'" class="w-full">
                <thead>
                  <tr class="text-left text-xs text-gray-400 border-b border-white/10">
                    <th class="pb-2 font-medium">ID</th>
                    <th class="pb-2 font-medium">名称</th>
                    <th class="pb-2 font-medium">类型</th>
                    <th class="pb-2 font-medium">状态</th>
                    <th class="pb-2 font-medium text-right">房间数</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr
                    v-for="b in filteredBuildings"
                    :key="b.id"
                    class="hover:bg-white/5 cursor-pointer"
                    @click="openAssetDetail(b)"
                  >
                    <td class="py-3 text-sm font-mono">{{ b.id }}</td>
                    <td class="py-3 text-sm">{{ b.name }}</td>
                    <td class="py-3 text-sm font-mono">{{ b.type }}</td>
                    <td class="py-3">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="b.status === 'normal' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'"
                      >
                        {{ b.status }}
                      </span>
                    </td>
                    <td class="py-3 text-sm text-right font-mono">{{ b.rooms }}</td>
                  </tr>
                </tbody>
              </table>

              <table v-else class="w-full">
                <thead>
                  <tr class="text-left text-xs text-gray-400 border-b border-white/10">
                    <th class="pb-2 font-medium">ID</th>
                    <th class="pb-2 font-medium">类型</th>
                    <th class="pb-2 font-medium">状态</th>
                    <th class="pb-2 font-medium text-right">压力</th>
                    <th class="pb-2 font-medium text-right">流量</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr
                    v-for="p in filteredPipelines"
                    :key="p.id"
                    class="hover:bg-white/5 cursor-pointer"
                    @click="openAssetDetail(p)"
                  >
                    <td class="py-3 text-sm font-mono">{{ p.id }}</td>
                    <td class="py-3 text-sm font-mono">{{ p.type }}</td>
                    <td class="py-3">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="p.status === 'normal' ? 'bg-green-100 text-green-800' : p.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'"
                      >
                        {{ p.status }}
                      </span>
                    </td>
                    <td class="py-3 text-sm text-right font-mono">{{ p.pressure }}</td>
                    <td class="py-3 text-sm text-right font-mono">{{ p.flowRate }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-3 text-[10px] text-gray-500 font-mono">
              当前显示：{{ assetTab === 'buildings' ? filteredBuildings.length : filteredPipelines.length }} 条
            </div>
          </TechPanel>
        </div>

        <!-- TAB: 告警&工单 -->
        <div v-else class="space-y-6">
          <TechPanel title="告警 & 工单（Mock）">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-white/5 border border-white/10 rounded p-4">
                <div class="text-sm font-bold mb-3">告警列表</div>
                <div class="max-h-[460px] overflow-auto">
                  <div
                    v-for="a in alerts"
                    :key="a.id"
                    class="p-3 rounded border border-white/10 hover:bg-white/5 cursor-pointer"
                    @click="openAssetDetail(a)"
                  >
                    <div class="flex justify-between gap-3">
                      <div class="text-xs font-mono text-gray-200">{{ a.id }}</div>
                      <div class="text-[10px] font-mono text-gray-500">{{ a.timestamp }}</div>
                    </div>
                    <div class="mt-1 text-xs text-gray-200">{{ a.message }}</div>
                    <div class="mt-1 text-[10px] text-gray-500">{{ a.location }} · {{ a.level }}</div>
                  </div>
                </div>
              </div>

              <div class="bg-white/5 border border-white/10 rounded p-4">
                <div class="text-sm font-bold mb-3">工单列表</div>
                <div class="max-h-[460px] overflow-auto">
                  <div
                    v-for="o in workOrders"
                    :key="o.id"
                    class="p-3 rounded border border-white/10 hover:bg-white/5 cursor-pointer"
                    @click="openAssetDetail(o)"
                  >
                    <div class="flex justify-between gap-3">
                      <div class="text-xs font-mono text-gray-200">{{ o.id }}</div>
                      <div class="text-[10px] font-mono text-gray-500">{{ o.date }}</div>
                    </div>
                    <div class="mt-1 text-xs text-gray-200">{{ o.description }}</div>
                    <div class="mt-1 text-[10px] text-gray-500">{{ o.targetId }} · {{ o.type }} · {{ o.status }}</div>
                  </div>
                </div>
              </div>
            </div>
          </TechPanel>
        </div>

        <!-- Detail Drawer -->
        <div
          v-if="detailOpen"
          class="fixed inset-0 z-50 pointer-events-none"
        >
          <div class="absolute inset-0 bg-black/50 pointer-events-auto" @click="closeDetail"></div>
          <div
            class="absolute right-0 top-0 h-full w-full max-w-xl bg-[#000B1A]/95 backdrop-blur-xl border-l border-white/10 pointer-events-auto"
          >
            <div class="p-4 border-b border-white/10 flex items-center justify-between">
              <div class="text-sm font-bold font-mono">详情</div>
              <button class="text-gray-400 hover:text-white" @click="closeDetail">✕</button>
            </div>
            <div class="p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs text-gray-400 font-mono">类型</div>
                <div class="text-xs text-gray-200 font-mono">{{ detailType }}</div>
              </div>
              <div class="bg-black/40 border border-white/10 rounded p-3 max-h-[75vh] overflow-auto">
                <pre class="text-[11px] leading-5 text-gray-200 whitespace-pre-wrap">{{ detailJson }}</pre>
              </div>
              <div class="mt-3 flex justify-end">
                <button
                  class="px-3 py-2 text-xs font-mono rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200"
                  @click="copyDetail"
                >
                  复制 JSON
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, ArrowLeft } from 'lucide-vue-next'
import type { Alert, WorkOrder, Building, PipeNode } from '~/types'
import { MOCK_ALERTS, WORK_ORDERS, BUILDINGS, PIPELINES } from '~/composables/useConstants'

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

// mock data
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

// geojson
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

// detail drawer
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
    // fallback: any value match
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
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
