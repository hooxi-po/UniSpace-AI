# Pipe2D Map Agent Notes

This directory contains the internal map layers for the Mars3D pipe editor.

## Layer Split

- [usePipe2DEditorMapInteractions.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts)
  Selection, insert/delete point, hover, context menu, keyboard.
- [usePipe2DEditorMapGraphics.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts)
  Rendering, GraphicLayer sync, edit callbacks.
- [pipe2d-editor-map-shared.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts)
  Pure helpers, types, hit-testing utilities.

## Rules

- Do not move interaction detail back into [usePipe2DEditorMap.ts](/Users/apple/代码仓库/UniSpace-AI/frontend/composables/admin/usePipe2DEditorMap.ts).
- Prefer pure helpers here over inline math in Vue components.
- Mars3D edit behavior must still support Cesium hit-area fallback for point/line selection.

## Validate

- `./scripts/verify-local.sh frontend`
- Manual regression: select line, select point, insert point, delete point, save, reopen
