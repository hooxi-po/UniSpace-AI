import * as Cesium from 'cesium'
import { watch } from 'vue'

type SelectedTargets = {
  pipes?: string[]
  buildings?: string[]
  rooms?: string[]
}

type HighlightSnapshot = {
  entity: Cesium.Entity
  color: Cesium.Color
  polygonMaterial?: Cesium.MaterialProperty
  polylineMaterial?: Cesium.MaterialProperty
  polylineWidth?: number
  pointColor?: Cesium.Property
  pointPixelSize?: number
  modelColor?: Cesium.Property
  modelColorBlendMode?: Cesium.Property
  modelSilhouetteColor?: Cesium.Property
  modelSilhouetteSize?: Cesium.Property
}

type MapSelectionDataSources = Record<string, Cesium.CustomDataSource> & {
  focus: Cesium.CustomDataSource
}

type UseMapViewSelectionOptions = {
  getViewer: () => Cesium.Viewer | null
  dataSources: MapSelectionDataSources
  getSelectedId: () => string | null
  getSelectedTargets: () => SelectedTargets | undefined
}

export function useMapViewSelection(options: UseMapViewSelectionOptions) {
  const highlightedSnapshots: HighlightSnapshot[] = []

  function applySelectionHighlight() {
    const viewer = options.getViewer()
    if (!viewer) return

    while (highlightedSnapshots.length) {
      const snapshot = highlightedSnapshots.pop()
      if (!snapshot) break
      if (snapshot.entity.polygon && snapshot.polygonMaterial) {
        snapshot.entity.polygon.material = snapshot.polygonMaterial
      }
      if (snapshot.entity.polyline) {
        if (snapshot.polylineMaterial) {
          snapshot.entity.polyline.material = snapshot.polylineMaterial
        }
        if (typeof snapshot.polylineWidth === 'number') {
          snapshot.entity.polyline.width = new Cesium.ConstantProperty(snapshot.polylineWidth)
        }
      }
      if (snapshot.entity.point) {
        if (snapshot.pointColor) {
          snapshot.entity.point.color = snapshot.pointColor
        }
        if (typeof snapshot.pointPixelSize === 'number') {
          snapshot.entity.point.pixelSize = new Cesium.ConstantProperty(snapshot.pointPixelSize)
        }
      }
      if (snapshot.entity.model) {
        snapshot.entity.model.color = snapshot.modelColor
        snapshot.entity.model.colorBlendMode = snapshot.modelColorBlendMode
        snapshot.entity.model.silhouetteColor = snapshot.modelSilhouetteColor
        snapshot.entity.model.silhouetteSize = snapshot.modelSilhouetteSize
      }
    }

    options.dataSources.focus.entities.removeAll()

    const selectedId = options.getSelectedId()
    const selectedTargets = options.getSelectedTargets()
    if (!selectedId && !(selectedTargets?.pipes?.length || selectedTargets?.buildings?.length || selectedTargets?.rooms?.length)) {
      return
    }

    const applyEntityHighlight = (target: Cesium.Entity, color: Cesium.Color, lineWidth = 6) => {
      highlightedSnapshots.push({
        entity: target,
        color,
        polygonMaterial: target.polygon?.material,
        polylineMaterial: target.polyline?.material,
        polylineWidth: target.polyline?.width?.getValue(viewer.clock.currentTime),
        pointColor: target.point?.color,
        pointPixelSize: target.point?.pixelSize?.getValue(viewer.clock.currentTime),
        modelColor: target.model?.color,
        modelColorBlendMode: target.model?.colorBlendMode,
        modelSilhouetteColor: target.model?.silhouetteColor,
        modelSilhouetteSize: target.model?.silhouetteSize,
      })

      const highlightColor = new Cesium.ColorMaterialProperty(color.withAlpha(0.88))

      if (target.polygon) {
        target.polygon.material = highlightColor
        target.polygon.outline = new Cesium.ConstantProperty(true)
        target.polygon.outlineColor = new Cesium.ConstantProperty(color.withAlpha(0.95))
      }
      if (target.polyline) {
        target.polyline.material = highlightColor
        target.polyline.width = new Cesium.ConstantProperty(lineWidth)
      }
      if (target.point) {
        target.point.color = new Cesium.ConstantProperty(color.withAlpha(0.95))
        target.point.pixelSize = new Cesium.ConstantProperty(10)
      }
      if (target.model) {
        target.model.color = new Cesium.ConstantProperty(color.withAlpha(0.35))
        target.model.colorBlendMode = new Cesium.ConstantProperty(Cesium.ColorBlendMode.MIX)
        target.model.silhouetteColor = new Cesium.ConstantProperty(color.withAlpha(0.95))
        target.model.silhouetteSize = new Cesium.ConstantProperty(2.5)
      }
    }

    const allEntities: Cesium.Entity[] = []
    for (const dataSource of Object.values(options.dataSources)) {
      if (dataSource.name === options.dataSources.focus.name) continue
      allEntities.push(...dataSource.entities.values)
    }

    const matchEntity = (keyword: string) => {
      const normalized = keyword.trim().toLowerCase()
      if (!normalized) return null

      for (const entity of allEntities) {
        if (String(entity.id) === keyword) return entity
      }

      let fuzzy: Cesium.Entity | null = null
      for (const entity of allEntities) {
        const entityId = String(entity.id || '').toLowerCase()
        const props = entity.properties?.getValue(viewer.clock.currentTime) || {}
        const name = String((props as any).name || (props as any).short_name || '').toLowerCase()
        const assetId = String((props as any).assetId || (props as any).buildingId || (props as any).roomId || '').toLowerCase()
        if (entityId.startsWith(normalized) || assetId.startsWith(normalized) || name.includes(normalized)) {
          fuzzy = entity
          break
        }
      }
      return fuzzy
    }

    const highlighted = new Set<string>()
    const tryHighlight = (keyword: string, color: Cesium.Color, width = 6) => {
      const target = matchEntity(keyword)
      if (!target) return null
      const key = String(target.id)
      if (highlighted.has(key)) return target
      highlighted.add(key)
      applyEntityHighlight(target, color, width)
      return target
    }

    if (selectedId) {
      tryHighlight(selectedId, Cesium.Color.YELLOW, 7)
    }

    for (const target of selectedTargets?.pipes || []) {
      tryHighlight(target, Cesium.Color.ORANGE, 7)
    }

    const buildingCenters = new Map<string, Cesium.Cartesian3>()
    for (const target of selectedTargets?.buildings || []) {
      const entity = tryHighlight(target, Cesium.Color.CYAN, 5)
      if (!entity) continue
      const now = viewer.clock.currentTime
      const center = entity.position?.getValue(now)
        || entity.polygon?.hierarchy?.getValue(now)?.positions?.[0]
        || null
      if (center) {
        buildingCenters.set(target, center)
      }
    }

    for (const roomId of selectedTargets?.rooms || []) {
      const roomEntity = tryHighlight(roomId, Cesium.Color.MAGENTA, 5)
      if (roomEntity) continue
      const anchor = buildingCenters.values().next().value as Cesium.Cartesian3 | undefined
      if (!anchor) continue
      options.dataSources.focus.entities.add({
        id: `focus-room-${roomId}`,
        position: anchor,
        point: new Cesium.PointGraphics({
          color: Cesium.Color.MAGENTA.withAlpha(0.9),
          pixelSize: 8,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
          outlineWidth: 1,
        }),
        label: new Cesium.LabelGraphics({
          text: roomId,
          fillColor: Cesium.Color.MAGENTA.withAlpha(0.95),
          font: '12px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -14),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.55),
        }),
      })
    }
  }

  watch(
    () => [
      options.getSelectedId(),
      options.getSelectedTargets()?.pipes,
      options.getSelectedTargets()?.buildings,
      options.getSelectedTargets()?.rooms,
    ],
    () => {
      applySelectionHighlight()
    },
    { immediate: true },
  )

  return {
    applySelectionHighlight,
  }
}
