# PipelineOps Backend Agent Notes

This package is split into workflow orchestration and support helpers.

## Files

- [WorkOrderRepository.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java)
  Main workflow entrypoints and core action flows.
- [WorkOrderRepositorySupport.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java)
  Cache, normalization, parsing, impact inference, log helpers, shared query helpers.

## Rules

- New SQL-heavy workflow entrypoints belong in `WorkOrderRepository.java`.
- Shared parsing/validation/cache/JSON helpers belong in `WorkOrderRepositorySupport.java`.
- Keep review-fixed invariants intact:
  - assign requires assignee
  - inspection conversion requires abnormal record
  - timed pump control requires positive duration
  - malformed date/time input must fail as 400, not 500
  - topology-less drafts must not bind an arbitrary building

## Validate

- `./scripts/verify-local.sh backend`
- If frontend query/filter semantics were touched too, run `./scripts/verify-local.sh`
