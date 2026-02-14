import { computed, h, ref, type ComputedRef } from 'vue'
import AssetRowActions from '~/components/admin/AssetRowActions.vue'
import AssetVisibilitySwitch from '~/components/admin/AssetVisibilitySwitch.vue'
import { geoFeatureService, type AssetLayer, type GeoFeaturePayload } from '~/services/geo-features'

type AssetNotice = {
  type: 'success' | 'error'
  text: string
}

type UseAssetCrudOptions = {
  backendBaseUrl: string
  activeAssetLayer: ComputedRef<AssetLayer>
  onReload: () => void
}

export function useAssetCrud(options: UseAssetCrudOptions) {
  const assetNotice = ref<AssetNotice | null>(null)

  const editorOpen = ref(false)
  const editorMode = ref<'create' | 'edit'>('create')
  const editorPayload = ref<GeoFeaturePayload | null>(null)
  const editorSubmitting = ref(false)
  const editorError = ref<string | null>(null)

  const deleteOpen = ref(false)
  const deleteTargetId = ref('')
  const deleteSubmitting = ref(false)
  const deleteError = ref<string | null>(null)

  const assetBusy = computed(() => editorSubmitting.value || deleteSubmitting.value)

  const assetCreateLabel = computed(() => {
    return options.activeAssetLayer.value === 'buildings' ? '新增建筑' : '新增管道'
  })

  function setAssetNotice(type: AssetNotice['type'], text: string) {
    assetNotice.value = { type, text }
  }

  function buildCreateTemplate(layer: AssetLayer): GeoFeaturePayload {
    if (layer === 'buildings') {
      return {
        id: `building_${Date.now()}`,
        layer,
        visible: true,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [119.1889, 26.0252],
              [119.1891, 26.0252],
              [119.1891, 26.0254],
              [119.1889, 26.0254],
              [119.1889, 26.0252],
            ],
          ],
        },
        properties: {
          name: '新建筑',
          building: 'school',
          amenity: 'office',
        },
      }
    }

    return {
      id: `pipe_${Date.now()}`,
      layer,
      visible: true,
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.1888, 26.0252],
          [119.1894, 26.0255],
        ],
      },
      properties: {
        name: '新管道',
        highway: 'service',
      },
    }
  }

  function rowToPayload(row: any): GeoFeaturePayload | null {
    const raw = row?.raw
    if (!raw || typeof raw !== 'object') return null

    const id = typeof row?.id === 'string' ? row.id : ''
    if (!id) return null

    const geometry = raw.geometry && typeof raw.geometry === 'object'
      ? {
          type: String((raw.geometry as any).type || ''),
          coordinates: (raw.geometry as any).coordinates,
        }
      : null
    if (!geometry || !geometry.type) return null

    const propsRaw = raw.properties && typeof raw.properties === 'object'
      ? { ...(raw.properties as Record<string, unknown>) }
      : {}
    delete (propsRaw as any).visible

    return {
      id,
      layer: options.activeAssetLayer.value,
      geometry,
      properties: propsRaw,
      visible: Boolean(row.visible ?? (raw.properties as any)?.visible ?? true),
    }
  }

  function openCreateAsset() {
    editorMode.value = 'create'
    editorPayload.value = buildCreateTemplate(options.activeAssetLayer.value)
    editorError.value = null
    editorOpen.value = true
  }

  function openEditAsset(row: any) {
    const original = rowToPayload(row)
    if (!original) {
      setAssetNotice('error', '当前行数据不可编辑')
      return
    }

    editorMode.value = 'edit'
    editorPayload.value = original
    editorError.value = null
    editorOpen.value = true
  }

  function closeEditor() {
    if (editorSubmitting.value) return
    editorOpen.value = false
    editorError.value = null
  }

  async function submitEditor(payload: GeoFeaturePayload) {
    editorSubmitting.value = true
    editorError.value = null

    try {
      if (editorMode.value === 'create') {
        await geoFeatureService.create(options.backendBaseUrl, payload)
        setAssetNotice('success', `已新增要素：${payload.id}`)
      } else {
        await geoFeatureService.update(options.backendBaseUrl, payload)
        setAssetNotice('success', `已更新要素：${payload.id}`)
      }
      editorOpen.value = false
      options.onReload()
    } catch (err: any) {
      editorError.value = err?.message || '保存失败'
    } finally {
      editorSubmitting.value = false
    }
  }

  function openDeleteAsset(row: any) {
    const id = String(row?.id || '')
    if (!id) {
      setAssetNotice('error', '缺少要素 ID，无法删除')
      return
    }
    deleteTargetId.value = id
    deleteError.value = null
    deleteOpen.value = true
  }

  function closeDeleteDialog() {
    if (deleteSubmitting.value) return
    deleteOpen.value = false
    deleteError.value = null
  }

  async function confirmDelete() {
    if (!deleteTargetId.value) return
    deleteSubmitting.value = true
    deleteError.value = null

    try {
      await geoFeatureService.remove(options.backendBaseUrl, deleteTargetId.value)
      setAssetNotice('success', `已删除要素：${deleteTargetId.value}`)
      deleteOpen.value = false
      options.onReload()
    } catch (err: any) {
      deleteError.value = err?.message || '删除失败'
    } finally {
      deleteSubmitting.value = false
    }
  }

  async function updateVisibility(row: any, newVisible: boolean) {
    const old = !!row.visible
    row.visible = newVisible

    try {
      await geoFeatureService.setVisibility(options.backendBaseUrl, String(row.id), newVisible)
    } catch (err: any) {
      row.visible = old
      setAssetNotice('error', `可见性更新失败：${err?.message || '未知错误'}`)
    }
  }

  function assetCell(row: any, colKey: string) {
    if (colKey === 'visible') {
      return h(AssetVisibilitySwitch, {
        checked: !!row.visible,
        disabled: assetBusy.value,
        onToggle: (value: boolean) => updateVisibility(row, value),
      })
    }

    if (colKey === 'actions') {
      return h(AssetRowActions, {
        disabled: assetBusy.value,
        onEdit: () => openEditAsset(row),
        onDelete: () => openDeleteAsset(row),
      })
    }

    return null
  }

  return {
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
  }
}

