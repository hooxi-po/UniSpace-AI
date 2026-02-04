import type { Property } from '~/mock/properties'

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
  raw: GeoJsonFeature
}

export type RoadRow = {
  id: string
  highway: string
  name: string
  geomType: string
  raw: GeoJsonFeature
}

export const buildingColumns: Column<BuildingRow>[] = [
  { key: 'id', label: 'ID', mono: true },
  { key: 'name', label: '名称' },
  { key: 'buildingType', label: '建筑类型', mono: true },
  { key: 'levels', label: '楼层', mono: true, class: 'ta-r' },
  { key: 'amenity', label: '用途', mono: true },
  { key: 'geomType', label: '几何', mono: true },
]

export const roadColumns: Column<RoadRow>[] = [
  { key: 'id', label: 'ID', mono: true },
  { key: 'highway', label: '道路类型', mono: true },
  { key: 'name', label: '名称' },
  { key: 'geomType', label: '几何', mono: true },
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

export function mapBuildingRow(f: GeoJsonFeature): BuildingRow {
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

export function mapRoadRow(f: GeoJsonFeature): RoadRow {
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

