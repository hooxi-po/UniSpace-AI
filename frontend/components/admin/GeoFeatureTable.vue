<template>
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :class="c.class">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length" class="empty">加载中...</td>
        </tr>
        <tr v-else-if="error">
          <td :colspan="columns.length" class="empty">加载失败：{{ error }}</td>
        </tr>
        <tr v-else-if="filteredRows.length === 0">
          <td :colspan="columns.length" class="empty">暂无数据</td>
        </tr>
        <tr
          v-else
          v-for="r in filteredRows"
          :key="r.id"
          class="row-click"
          @click="$emit('select', r.raw)"
        >
          <td v-for="c in columns" :key="c.key" :class="c.class">
            <template v-if="props.cell && props.cell(r, c.key)">
              <component :is="props.cell(r, c.key)" @click.stop />
            </template>
            <template v-else>
              <span v-if="c.mono" class="mono cell-text" :title="displayText(r[c.key])">{{ displayText(r[c.key]) }}</span>
              <span v-else class="cell-text" :title="displayText(r[c.key])">{{ displayText(r[c.key]) }}</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, getCurrentInstance } from 'vue'

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

type FeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

type Row = Record<string, any> & { id: string; raw: GeoJsonFeature }

type Column<RowT> = {
  key: keyof RowT & string
  label: string
  class?: string
  mono?: boolean
}

const props = defineProps<{
  backendBaseUrl: string
  layer: string
  limit?: number
  active?: boolean
  reloadKey?: number
  search?: string
  searchKeys?: string[]
  columns: Column<Row>[]
  mapRow: (f: GeoJsonFeature) => Row
  cell?: (row: Row, colKey: string) => any
}>()

defineEmits<{
  (e: 'select', f: GeoJsonFeature): void
  (e: 'count', n: number): void
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<Row[]>([])

async function fetchFeatures() {
  loading.value = true
  error.value = null

  try {
    const url = `${props.backendBaseUrl}/api/v1/features?layers=${encodeURIComponent(props.layer)}&limit=${props.limit ?? 5000}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as FeatureCollection
    const feats = Array.isArray(json?.features) ? json.features : []

    rows.value = feats
      .filter(f => f && typeof f.id === 'string')
      .map(f => props.mapRow(f))

    const inst = getCurrentInstance()
    if (inst) {
      ;(inst.emit as any)('count', rows.value.length)
    }
  } catch (e: any) {
    error.value = e?.message ? String(e.message) : '请求失败'
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.active,
  (v) => {
    if (v) fetchFeatures()
  },
  { immediate: true }
)

watch(
  () => props.reloadKey,
  () => {
    if (props.active) fetchFeatures()
  }
)

defineExpose({
  refresh: fetchFeatures,
})

const filteredRows = computed(() => {
  const q = (props.search || '').trim().toLowerCase()
  if (!q) return rows.value
  const keys = props.searchKeys && props.searchKeys.length ? props.searchKeys : ['id']
  return rows.value.filter((r) => {
    for (const k of keys) {
      const v = r[k]
      if (v == null) continue
      if (String(v).toLowerCase().includes(q)) return true
    }
    return false
  })
})

function displayText(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'string') {
    const text = value.trim()
    return text ? text : '—'
  }
  return String(value)
}

</script>

<style scoped>
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
  vertical-align: middle;
}

.table tbody tr:hover {
  background: #fafbfc;
}

.row-click {
  cursor: pointer;
}

.empty {
  padding: 12px 10px;
  color: var(--muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.col-id {
  width: 220px;
  max-width: 260px;
}

.col-name {
  min-width: 140px;
}

.col-type {
  min-width: 120px;
}

.col-level {
  width: 72px;
}

.col-geom {
  width: 68px;
}

.col-visible {
  width: 72px;
}

.col-actions {
  width: 120px;
}

.ta-r {
  text-align: right;
}

.ta-c {
  text-align: center;
}
</style>
