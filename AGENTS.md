# UniSpace-AI Agent Entry

Canonical long-form rules live in [agent.md](/Users/apple/代码仓库/UniSpace-AI/agent.md). Read this file first only for the shortest safe path.

If you enter a subdirectory that also contains an `AGENTS.md`, read that one too before editing files there.

## First 3 Minutes

1. Run `./scripts/verify-local.sh guardrails`
2. If you will touch backend, run `./scripts/verify-local.sh backend`
3. If you will touch frontend, run `./scripts/verify-local.sh frontend`
4. If the task crosses frontend/backend, run `./scripts/verify-local.sh`

## Core Rules

- External semantics use `pipes`; storage still uses `roads`.
- Do not put complex logic back into large shell files.
- Do not use `window.alert` / `prompt` / `confirm` for new admin interactions.
- Do not commit build outputs: `.nuxt/`, `.output/`, `build/`, `.gradle/`.
- If a file is already large, prefer extraction over inline expansion.

## Where To Change

### Main map

- Container/orchestration: [frontend/components/MapView.vue](/Users/apple/代码仓库/UniSpace-AI/frontend/components/MapView.vue)
- Pipe loading/classification: [frontend/composables/shared/usePipeLayerLoader.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/shared/usePipeLayerLoader.ts)
- Selection/highlight: [frontend/composables/shared/useMapViewSelection.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/shared/useMapViewSelection.ts)
- Workorder heat overlay: [frontend/composables/shared/useMapViewWorkorderHeat.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/shared/useMapViewWorkorderHeat.ts)
- BBox/helpers: [frontend/utils/map-view-helpers.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/utils/map-view-helpers.ts)

### Pipe 2D editor

- Dialog shell: [frontend/components/admin/Pipe2DEditorDialog.vue](/Users/apple/代码仓库/UniSpace-AI/frontend/components/admin/Pipe2DEditorDialog.vue)
- Workspace shell state: [frontend/composables/admin/usePipe2DEditorWorkspace.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorWorkspace.ts)
- Draft persistence: [frontend/composables/admin/usePipe2DEditorDrafts.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorDrafts.ts)
- Map assembly/view control: [frontend/composables/admin/usePipe2DEditorMap.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorMap.ts)
- Map interactions: [frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts)
- Graphic sync/rendering: [frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts)
- Shared helpers: [frontend/composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts)
- Data read/write: [frontend/composables/admin/usePipe2DEditorData.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorData.ts)

### Pipeline ops

- Board shell: [frontend/components/admin/ops/PipelineOpsBoard.vue](/Users/apple/代码仓库/UniSpace-AI/frontend/components/admin/ops/PipelineOpsBoard.vue)
- Board state/filtering: [frontend/composables/admin/usePipelineOpsBoard.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipelineOpsBoard.ts)
- Board shell UI flow: [frontend/composables/admin/usePipelineOpsBoardUi.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipelineOpsBoardUi.ts)
- Frontend service: [frontend/services/pipeline-ops.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/services/pipeline-ops.ts)
- Nuxt proxy: [frontend/server/utils/pipeline-ops-db.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/server/utils/pipeline-ops-db.ts)
- Backend workflow: [backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java)
- Backend support helpers: [backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java)

## Validation Profiles

- `./scripts/verify-local.sh`
  Runs backend tests, frontend typecheck, frontend build, size guardrails.
- `./scripts/verify-local.sh frontend`
  Runs frontend typecheck and build.
- `./scripts/verify-local.sh backend`
  Runs backend tests.
- `./scripts/verify-local.sh guardrails`
  Runs file-size guardrails only.

## Stop Conditions

- If you find unrelated unexpected file changes while editing, stop and ask.
- If you change semantics, API payloads, or map behavior, update [agent.md](/Users/apple/代码仓库/UniSpace-AI/agent.md).
