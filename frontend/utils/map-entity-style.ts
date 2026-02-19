import * as Cesium from 'cesium'

const GREEN_FILL = new Cesium.ColorMaterialProperty(
  Cesium.Color.fromCssColorString('rgb(10, 43, 49)').withAlpha(0.7),
)

const BUILDING_STYLE = {
  fill: new Cesium.ColorMaterialProperty(
    Cesium.Color.fromCssColorString('rgb(100, 180, 255)').withAlpha(0.6),
  ),
  outline: Cesium.Color.fromCssColorString('rgb(100, 180, 255)').withAlpha(0.6),
  outlineWidth: 2,
  extrudedHeight: 20,
}

export function styleGreenEntity(entity: Cesium.Entity) {
  if (!entity.polygon) return
  entity.polygon.material = GREEN_FILL
  entity.polygon.outline = new Cesium.ConstantProperty(false)
}

export function styleBuildingEntity(entity: Cesium.Entity) {
  if (!entity.polygon) return
  entity.polygon.material = BUILDING_STYLE.fill
  entity.polygon.extrudedHeight = new Cesium.ConstantProperty(BUILDING_STYLE.extrudedHeight)
  entity.polygon.heightReference = new Cesium.ConstantProperty(
    Cesium.HeightReference.CLAMP_TO_GROUND,
  )
  entity.polygon.extrudedHeightReference = new Cesium.ConstantProperty(
    Cesium.HeightReference.RELATIVE_TO_GROUND,
  )
  entity.polygon.outline = new Cesium.ConstantProperty(true)
  entity.polygon.outlineColor = new Cesium.ConstantProperty(BUILDING_STYLE.outline)
  entity.polygon.outlineWidth = new Cesium.ConstantProperty(BUILDING_STYLE.outlineWidth)
}
