import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { GeoJsonFeature } from '~/services/geo-features'
import { cloneLines, geometryToLines, type Lines } from '~/utils/pipe2d-geometry'
import { cloneGraph, linesToGraph, type PipeGraph } from '~/utils/pipe2d-graph'

type UsePipe2DEditorDraftsOptions = {
  open: Ref<boolean>
  selectedFeature: ComputedRef<GeoJsonFeature | null>
  draftLines: Ref<Lines>
  originalLines: Ref<Lines>
  isDirty: ComputedRef<boolean>
  hasDraftChanges?: ComputedRef<boolean>
  saving: Ref<boolean>
  fitCurrentPipeView: () => void
  /** 可选：图结构 ref，有值时持久化到 v4 草稿 */
  graph?: Ref<PipeGraph>
  /** 可选：从图结构 JSON 恢复状态 */
  restoreGraph?: (g: PipeGraph) => void
}

const DRAFT_STORAGE_PREFIX_V4 = 'pipe2d-editor-draft:v4:'
const DRAFT_STORAGE_PREFIX_V3 = 'pipe2d-editor-draft:v3:'

export function usePipe2DEditorDrafts(options: UsePipe2DEditorDraftsOptions) {
  const draftStatusText = ref('等待加载')
  const draftRestoredToastVisible = ref(false)
  const hasDraftChanges = computed(() => options.hasDraftChanges?.value ?? options.isDirty.value)

  let draftAutosaveTimer: ReturnType<typeof setTimeout> | null = null
  let draftIntervalTimer: ReturnType<typeof setInterval> | null = null
  let draftToastTimer: ReturnType<typeof setTimeout> | null = null

  function isValidDraftLines(value: unknown): value is Lines {
    if (!Array.isArray(value) || !value.length) return false
    return value.every((line) => {
      if (!Array.isArray(line) || line.length < 2) return false
      return line.every((point) => {
        if (!Array.isArray(point) || point.length < 2) return false
        return Number.isFinite(point[0]) && Number.isFinite(point[1])
      })
    })
  }

  function draftStorageKey(featureId: string, version: 'v4' | 'v3' = 'v4') {
    return version === 'v4'
      ? `${DRAFT_STORAGE_PREFIX_V4}${featureId}`
      : `${DRAFT_STORAGE_PREFIX_V3}${featureId}`
  }

  function setDraftStatus(next: string) {
    draftStatusText.value = next
  }

  function isDraftFeature(feature: GeoJsonFeature | null) {
    return Boolean(feature?.properties && (feature.properties as Record<string, unknown>).__draft)
  }

  function writeLocalDraft(featureId: string) {
    if (typeof window === 'undefined') return
    const payload: Record<string, unknown> = {
      featureId,
      savedAt: Date.now(),
      lines: cloneLines(options.draftLines.value),
    }
    // v4: 同时持久化图结构
    if (options.graph?.value) {
      payload.graph = cloneGraph(options.graph.value)
    }
    window.localStorage.setItem(draftStorageKey(featureId, 'v4'), JSON.stringify(payload))
    draftStatusText.value = '草稿已暂存'
  }

  type DraftPayload = { lines: Lines; graph?: PipeGraph }

  function readLocalDraft(featureId: string): DraftPayload | null {
    if (typeof window === 'undefined') return null
    // 优先读 v4
    const rawV4 = window.localStorage.getItem(draftStorageKey(featureId, 'v4'))
    if (rawV4) {
      try {
        const payload = JSON.parse(rawV4) as { lines?: unknown; graph?: unknown }
        if (!isValidDraftLines(payload.lines)) return null
        return {
          lines: cloneLines(payload.lines),
          graph: payload.graph as PipeGraph | undefined,
        }
      } catch {
        // fall through to v3
      }
    }
    // 降级读 v3（lines only）
    const rawV3 = window.localStorage.getItem(draftStorageKey(featureId, 'v3'))
    if (!rawV3) return null
    try {
      const payload = JSON.parse(rawV3) as { lines?: unknown }
      if (!isValidDraftLines(payload.lines)) return null
      return { lines: cloneLines(payload.lines) }
    } catch {
      return null
    }
  }

  function clearLocalDraft(featureId: string) {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(draftStorageKey(featureId, 'v4'))
    window.localStorage.removeItem(draftStorageKey(featureId, 'v3'))
  }

  function saveDraftToLocal(force = false) {
    if (!options.open.value || options.saving.value || !options.selectedFeature.value) return
    if (!force && !hasDraftChanges.value) return
    writeLocalDraft(String(options.selectedFeature.value.id))
  }

  function scheduleDraftAutosave() {
    if (draftAutosaveTimer) clearTimeout(draftAutosaveTimer)
    draftAutosaveTimer = setTimeout(() => {
      draftAutosaveTimer = null
      saveDraftToLocal()
    }, 800)
  }

  function stopTimers() {
    if (draftAutosaveTimer) {
      clearTimeout(draftAutosaveTimer)
      draftAutosaveTimer = null
    }
    if (draftIntervalTimer) {
      clearInterval(draftIntervalTimer)
      draftIntervalTimer = null
    }
    if (draftToastTimer) {
      clearTimeout(draftToastTimer)
      draftToastTimer = null
    }
    draftRestoredToastVisible.value = false
  }

  function ensureDraftInterval() {
    if (draftIntervalTimer || typeof window === 'undefined') return
    draftIntervalTimer = setInterval(() => {
      saveDraftToLocal()
    }, 8_000)
  }

  function restoreDraftIfExists(featureId: string) {
    const localDraft = readLocalDraft(featureId)
    if (!localDraft) {
      draftStatusText.value = '与服务端一致'
      return
    }
    options.draftLines.value = localDraft.lines
    if (options.restoreGraph) {
      // v4 直接恢复持久化图结构；v3 仅有 lines 时重建 graph，避免 draftLines/graph 脱节。
      options.restoreGraph(localDraft.graph || linesToGraph(localDraft.lines, 'n'))
    }
    draftRestoredToastVisible.value = true
    if (draftToastTimer) clearTimeout(draftToastTimer)
    draftToastTimer = setTimeout(() => {
      draftRestoredToastVisible.value = false
    }, 3000)
    draftStatusText.value = '已恢复本地草稿'
  }

  watch(
    options.open,
    (opened) => {
      if (opened) {
        ensureDraftInterval()
        return
      }
      if (options.selectedFeature.value && hasDraftChanges.value && !options.saving.value) {
        writeLocalDraft(String(options.selectedFeature.value.id))
      }
      stopTimers()
    },
    { immediate: true },
  )

  watch(options.selectedFeature, (feature) => {
    if (!feature) {
      options.draftLines.value = []
      options.originalLines.value = []
      draftStatusText.value = '未选择管道'
      return
    }

    const lines = geometryToLines(feature.geometry)
    if (!lines.length) {
      if (isDraftFeature(feature)) {
        const localDraft = readLocalDraft(String(feature.id))
        if (localDraft) {
          options.originalLines.value = []
          options.draftLines.value = localDraft.lines
          if (options.restoreGraph) {
            options.restoreGraph(localDraft.graph || linesToGraph(localDraft.lines, 'n'))
          }
          draftStatusText.value = '已恢复新管道草稿'
        } else {
          options.originalLines.value = []
          options.draftLines.value = []
          draftStatusText.value = '未保存的新管道'
        }
        return
      }
      const fallback: Lines = [[[119.1888, 26.0252], [119.1894, 26.0255]]]
      options.originalLines.value = cloneLines(fallback)
      options.draftLines.value = cloneLines(fallback)
    } else {
      options.originalLines.value = cloneLines(lines)
      options.draftLines.value = cloneLines(lines)
    }

    restoreDraftIfExists(String(feature.id))
    options.fitCurrentPipeView()
  })

  watch(
    options.draftLines,
    () => {
      if (!options.open.value || !options.selectedFeature.value || options.saving.value) return
      if (!hasDraftChanges.value) {
        draftStatusText.value = '与服务端一致'
        return
      }
      scheduleDraftAutosave()
    },
    { deep: true },
  )

  watch(
    () => options.graph?.value,
    () => {
      if (!options.graph || !options.open.value || !options.selectedFeature.value || options.saving.value) return
      if (!hasDraftChanges.value) {
        draftStatusText.value = '与服务端一致'
        return
      }
      scheduleDraftAutosave()
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    stopTimers()
  })

  return {
    draftStatusText,
    draftRestoredToastVisible,
    clearLocalDraft,
    persistLocalDraft: saveDraftToLocal,
    setDraftStatus,
    stopDraftTimers: stopTimers,
  }
}
