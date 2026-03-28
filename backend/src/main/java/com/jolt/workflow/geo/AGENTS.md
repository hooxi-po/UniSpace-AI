# Geo Package Agent Notes

This package serves feature CRUD, Twin drilldown/write, and telemetry-facing endpoints.

## Boundaries

- [GeoFeatureController.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java)
  Geo feature CRUD and layer normalization (`pipes` -> storage `roads`).
- [TwinController.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/geo/TwinController.java)
  Twin read APIs: drilldown, trace, audit, telemetry read aggregation.
- [TwinWriteController.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java)
  Twin write APIs for pipe geometry/properties.
- [Module2TelemetryController.java](/Users/apple/代码仓库/UniSpace-AI/backend/src/main/java/com/jolt/workflow/geo/Module2TelemetryController.java)
  Telemetry ingest, thresholds, latest/history endpoints.

## Rules

- Preserve external `pipes` semantics; any `roads` mention is storage-only.
- Do not mix Twin write concerns back into `TwinController.java`.
- If `TwinController.java` grows further, extract pure query/assembly helpers before changing endpoint semantics.
- When changing room/building impact or drilldown payloads, validate both frontend editor usage and pipeline-ops linkage assumptions.

## Validate

- `./scripts/verify-local.sh backend`
- If Twin payloads affect frontend editor or map rendering, also run `./scripts/verify-local.sh frontend`
