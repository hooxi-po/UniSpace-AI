# Ops Board Agent Notes

Use this directory for `pipeline-ops` board UI only.

## Boundaries

- [PipelineOpsBoard.vue](/Users/apple/代码仓库/UniSpace-AI/frontend/components/admin/ops/PipelineOpsBoard.vue) is the orchestration shell.
- Section components here should stay presentational or narrowly interactive.
- Shared labels/types/constants stay beside the board in this directory.
- Business state and fetching belong in [usePipelineOpsBoard.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipelineOpsBoard.ts), not here.

## When Editing

- If you add a new board section, prefer a new `*Section.vue` or `*Card.vue`.
- If you add dialog workflow logic, first check whether it should become a composable instead of staying in the shell.
- Keep list/stats/dashboard filter semantics aligned with the composable and backend.

## Validate

- `./scripts/verify-local.sh frontend`
- If workflow semantics changed, also run `./scripts/verify-local.sh backend`
