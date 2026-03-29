import * as Cesium from 'cesium'

interface WorkorderHeatItem {
  id: string
  title: string
  buildingId?: string
  buildingName?: string
  lng: number
  lat: number
  count?: number
}

export function useMapViewWorkorderHeat(options: {
  getViewer: () => Cesium.Viewer | null
  dataSource: Cesium.CustomDataSource
  dashboardUrl?: string
  onPumpControlRefreshed?: () => void
  refreshIntervalMs?: number
}) {
  const dashboardUrl = options.dashboardUrl || '/api/pipeline-ops/dashboard'
  const refreshIntervalMs = options.refreshIntervalMs || 30000
  let workorderHeatTimer: ReturnType<typeof setInterval> | null = null

  const onHeatCluster = (clusteredEntities: Cesium.Entity[], cluster: {
    billboard: Cesium.Billboard
    label: Cesium.Label
    point: Cesium.PointPrimitive
  }) => {
    cluster.billboard.show = false
    cluster.point.show = true
    cluster.point.color = Cesium.Color.RED.withAlpha(0.85)
    cluster.point.pixelSize = 18
    cluster.label.show = true
    cluster.label.text = String(clusteredEntities.length)
    cluster.label.fillColor = Cesium.Color.WHITE
    cluster.label.outlineWidth = 0
  }

  const onPumpControlRefreshed = () => {
    options.onPumpControlRefreshed?.()
    void loadWorkorderHeatmap()
  }

  async function loadWorkorderHeatmap() {
    const viewer = options.getViewer()
    if (!viewer) return
    try {
      const res = await fetch(dashboardUrl)
      if (!res.ok) return
      const payload = await res.json() as {
        dashboard?: {
          inProgressHeatmap?: WorkorderHeatItem[]
        }
      }
      const list = Array.isArray(payload?.dashboard?.inProgressHeatmap)
        ? payload.dashboard.inProgressHeatmap
        : []

      options.dataSource.entities.removeAll()
      for (const item of list) {
        if (!Number.isFinite(item.lng) || !Number.isFinite(item.lat)) continue
        options.dataSource.entities.add({
          id: `wo-heat-${item.id}`,
          position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat),
          point: new Cesium.PointGraphics({
            pixelSize: 12,
            color: Cesium.Color.RED.withAlpha(0.75),
            outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
            outlineWidth: 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }),
          label: new Cesium.LabelGraphics({
            text: String(item.count || 1),
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.55),
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }),
          properties: new Cesium.PropertyBag({
            __workorderHeat: true,
            __workorderId: item.id,
            __workorderTitle: item.title || item.id,
            __buildingId: item.buildingId || '',
            __buildingName: item.buildingName || '',
          }),
        })
      }
    } catch {
      // ignore heatmap load failures
    }
  }

  function mountWorkorderHeatmap() {
    options.dataSource.clustering.enabled = true
    options.dataSource.clustering.pixelRange = 45
    options.dataSource.clustering.minimumClusterSize = 2
    options.dataSource.clustering.clusterEvent.addEventListener(onHeatCluster)
    if (typeof window !== 'undefined') {
      window.addEventListener('pipeline:pump-control-refreshed', onPumpControlRefreshed)
    }
    void loadWorkorderHeatmap()
    workorderHeatTimer = setInterval(() => {
      void loadWorkorderHeatmap()
    }, refreshIntervalMs)
  }

  function cleanupWorkorderHeat() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pipeline:pump-control-refreshed', onPumpControlRefreshed)
    }
    if (workorderHeatTimer) {
      clearInterval(workorderHeatTimer)
      workorderHeatTimer = null
    }
    options.dataSource.clustering.clusterEvent.removeEventListener(onHeatCluster)
  }

  return {
    loadWorkorderHeatmap,
    mountWorkorderHeatmap,
    cleanupWorkorderHeat,
  }
}
