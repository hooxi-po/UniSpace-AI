# Shared Map Composables Agent Notes

Use this directory for cross-page frontend behavior, especially map orchestration that should not stay inside a page or shell component.

## Boundaries

- Cesium/Mars3D page-agnostic logic belongs here.
- Feature loading, selection, heatmap overlays, and map helper hooks belong here when reused or when they significantly shrink a shell component.
- Business-domain write flows still belong in `frontend/composables/admin/` or domain composables, not here.

## Current Map Split

- [usePipeLayerLoader.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/shared/usePipeLayerLoader.ts)
  Pipe feature loading, paging, and `water/drain/sewage` classification.
- [useMapViewSelection.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/shared/useMapViewSelection.ts)
  Main map selection/highlight and focus fallback behavior.
- [useMapViewWorkorderHeat.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/shared/useMapViewWorkorderHeat.ts)
  Main map workorder heat overlay, clustering, polling, and pump-control refresh hook.

## Rules

- Prefer passing `getViewer()` or explicit data sources instead of importing component-local state.
- If a composable installs timers, window listeners, or Cesium events, it must also expose cleanup or own cleanup.
- Keep shell components focused on setup and orchestration; move isolated map features here before they exceed local readability.

## Validate

- `./scripts/verify-local.sh frontend`
