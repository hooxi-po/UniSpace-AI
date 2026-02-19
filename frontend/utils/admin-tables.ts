import type { Property } from '~/mock/properties'
import { classifyRoadToPipeCategory } from '~/utils/pipe-classifier'

export type PropertyRow = Property

export type Column<RowT> = {
  key: keyof RowT & string
  label: string
  class?: string
  mono?: boolean
}

// === Assets ===
export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

export type GeoJsonFeature = {
  type: 'Feature'
  id: string
  properties: Record<string, unknown>
  geometry: GeoJsonGeometry
}

export type BuildingRow = {
  id: string
  name: string
  buildingType: string
  levels: number | null
  amenity: string
  geomType: string
  visible: boolean
  actions: string
  raw: GeoJsonFeature
}

export type RoadRow = {
  id: string
  pipeCategory: string
  highway: string
  name: string
  geomType: string
  visible: boolean
  actions: string
  raw: GeoJsonFeature
}

export const buildingColumns: Column<BuildingRow>[] = [
  { key: 'id', label: 'ID', mono: true, class: 'col-id' },
  { key: 'name', label: '名称', class: 'col-name' },
  { key: 'buildingType', label: '建筑类型', class: 'col-type' },
  { key: 'levels', label: '楼层', mono: true, class: 'ta-r col-level' },
  { key: 'amenity', label: '用途', class: 'col-type' },
  { key: 'geomType', label: '几何', class: 'ta-c col-geom' },
  { key: 'visible', label: '显示', class: 'ta-c col-visible' },
  { key: 'actions', label: '操作', class: 'ta-c col-actions' },
]

export const roadColumns: Column<RoadRow>[] = [
  { key: 'id', label: 'ID', mono: true, class: 'col-id' },
  { key: 'pipeCategory', label: '管道类别', class: 'col-type' },
  { key: 'highway', label: '道路类型', class: 'col-type' },
  { key: 'name', label: '名称', class: 'col-name' },
  { key: 'geomType', label: '几何', class: 'ta-c col-geom' },
  { key: 'visible', label: '显示', class: 'ta-c col-visible' },
  { key: 'actions', label: '操作', class: 'ta-c col-actions' },
]

export const propertyColumns: Column<PropertyRow>[] = [
  { key: 'id', label: 'ID', mono: true },
  { key: 'name', label: '名称' },
  { key: 'type', label: '类型', mono: true },
  { key: 'status', label: '状态', mono: true },
  { key: 'area', label: '面积(㎡)', mono: true, class: 'ta-r' },
  { key: 'price', label: '总价(元)', mono: true, class: 'ta-r' },
  { key: 'location', label: '位置' },
]

function normalizeGeometryType(type: unknown) {
  const t = String(type || '').trim()
  if (t === 'Polygon' || t === 'MultiPolygon') return '面'
  if (t === 'LineString' || t === 'MultiLineString') return '线'
  if (t === 'Point' || t === 'MultiPoint') return '点'
  return t || '—'
}

function normalizeBuildingType(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  const mapping: Record<string, string> = {
    school: '教学',
    university: '教学',
    dormitory: '宿舍',
    residential: '住宅',
    office: '办公',
    commercial: '商业',
    retail: '商业',
    service: '服务',
    public: '公共',
    yes: '建筑',
  }
  if (!raw) return '—'
  return mapping[raw] || raw
}

function normalizeAmenity(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  const mapping: Record<string, string> = {
    office: '办公',
    library: '图书馆',
    classroom: '教室',
    school: '教学',
    dormitory: '宿舍',
    canteen: '食堂',
    hospital: '医疗',
    parking: '停车',
  }
  if (!raw) return '—'
  return mapping[raw] || raw
}

function normalizeHighway(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  const mapping: Record<string, string> = {
    motorway: '高速主干',
    trunk: '主干道',
    primary: '一级道路',
    secondary: '二级道路',
    tertiary: '三级道路',
    service: '服务道路',
    residential: '生活道路',
    living_street: '生活街区',
    unclassified: '未分类道路',
    footway: '人行道',
    path: '步道',
    pedestrian: '步行街',
    cycleway: '自行车道',
    track: '支路',
    steps: '台阶',
  }
  if (!raw) return '—'
  const label = mapping[raw] || '其他道路'
  return `${label}（${raw}）`
}

export function mapBuildingRow(f: GeoJsonFeature): BuildingRow {
  const p = (f.properties || {}) as Record<string, unknown>
  const name = String(p.name ?? p.short_name ?? '')
  const levelsRaw = p['building:levels']
  const levelsNum = levelsRaw == null || levelsRaw === '' ? null : Number(levelsRaw)
  const levels = Number.isFinite(levelsNum) ? (levelsNum as number) : null

  return {
    id: f.id,
    name: name || '—',
    buildingType: normalizeBuildingType(p.building ?? p.type),
    levels,
    amenity: normalizeAmenity(p.amenity ?? p.office ?? p.shop),
    geomType: normalizeGeometryType(f.geometry?.type),
    visible: Boolean((p as any).visible ?? true),
    actions: '',
    raw: f,
  }
}

export function mapRoadRow(f: GeoJsonFeature): RoadRow {
  const p = (f.properties || {}) as Record<string, unknown>
  const highwayRaw = p.highway ?? p.road ?? p.type
  const name = String(p.name ?? p.ref ?? '')

  return {
    id: f.id,
    pipeCategory: classifyRoadToPipeCategory(highwayRaw),
    highway: normalizeHighway(highwayRaw),
    name: name || '—',
    geomType: normalizeGeometryType(f.geometry?.type),
    visible: Boolean((p as any).visible ?? true),
    actions: '',
    raw: f,
  }
}
