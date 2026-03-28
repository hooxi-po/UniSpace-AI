# Admin Composables Agent Notes

This directory holds admin-domain orchestration only.

## Boundaries

- Keep data fetching, filtering, persistence, and domain state in admin composables.
- Keep view-only layout and markup in `frontend/components/admin/**`.
- If an admin shell component grows because of dialog/form/timer/notice wiring, extract a dedicated `use*.ts` composable here.

## Current Split

- [usePipe2DEditorData.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorData.ts)
  Server read/write orchestration for the pipe 2D editor.
- [usePipe2DEditorDrafts.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorDrafts.ts)
  Local draft restore and autosave.
- [usePipe2DEditorWorkspace.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorWorkspace.ts)
  Editor shell UI state.
- [usePipelineOpsBoard.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipelineOpsBoard.ts)
  Pipeline-ops fetch, filters, paging, and mutations.
- [usePipelineOpsBoardUi.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipelineOpsBoardUi.ts)
  Pipeline-ops shell UI workflow: dialogs, forms, notices, timers, route-open behavior.

## Rules

- Do not call `$fetch` directly here; go through `services/`.
- Do not move Mars3D/Cesium rendering details into this directory unless they are admin-shell orchestration.
- When a composable owns timers or window events, it must also own cleanup.
- When adding a new board/editor workflow, prefer composing existing state composables instead of duplicating API calls.

## Validate

- `./scripts/verify-local.sh frontend`
- If workflow semantics changed, also run `./scripts/verify-local.sh backend`
