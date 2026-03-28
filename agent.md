# agent.md — UniSpace-AI 编码助手黄金手册（v3）

> 作用：给任何接手本仓库的编码助手一套可执行、可验证、可交付的统一规则。  
> 适用范围：`UniSpace-AI/` 全仓库（前端 + 后端 + 文档）。  
> 最后对齐时间：2026-03-27（基于当前代码状态，含 Mars3D 管道二维编辑器地图层继续拆分与 `pipeline-ops` 全链路）。

---

## 0) 先读 60 秒

- 仓库根目录新增了 `AGENTS.md`，它是给 agent 框架的最短入口；详细规则仍以本文 `agent.md` 为准。
- `frontend/components/admin/ops/`、`frontend/composables/admin/`、`frontend/composables/admin/pipe2d-editor/`、`frontend/composables/shared/`、`backend/src/main/java/com/jolt/workflow/geo/`、`backend/src/main/java/com/jolt/workflow/pipelineops/` 已补局部 `AGENTS.md`；进入这些目录改文件前，先读局部规则。
- 本仓库关键语义：业务层叫 `pipes`，存储层仍是 `roads`。
- 主地图仍是 Cesium，管道加载逻辑集中在 `frontend/composables/shared/usePipeLayerLoader.ts`。
- 主地图选中高亮已从 `MapView.vue` 拆到 `frontend/composables/shared/useMapViewSelection.ts`，工单热力图叠加在 `frontend/composables/shared/useMapViewWorkorderHeat.ts`，BBox/分页抓取/建筑替换模型计算在 `frontend/utils/map-view-helpers.ts`。
- 后台二维编辑器已经切到 Mars3D 本地 npm 模式，入口是 `frontend/components/admin/Pipe2DEditorDialog.vue`。
- `Pipe2DEditorDialog.vue` 现在是编排壳，界面区块已经拆到 `frontend/components/admin/pipe2d-editor/`。
- 二维编辑器壳层状态已继续下沉：工作区交互在 `frontend/composables/admin/usePipe2DEditorWorkspace.ts`，本地草稿与自动保存在 `frontend/composables/admin/usePipe2DEditorDrafts.ts`。
- 二维编辑器地图层已继续分层：共享类型/几何辅助在 `frontend/composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts`，交互/命中/快捷键在 `frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`，图层渲染与 Mars3D 图元同步在 `frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`，`usePipe2DEditorMap.ts` 只保留装配、初始化和视图控制。
- Mars3D 懒加载在 `frontend/utils/mars3d-loader.ts`，首轮加载失败后允许重试，不能再假设失败后永久缓存。
- 二维编辑器几何保存优先走 Twin 写接口，失败时回退到 `geo-features` 更新；管道重命名也已经真实写回后端。
- 本地草稿机制已上线：`localStorage` 按 featureId 缓存，`800ms` 防抖 + `8s` 定时暂存。
- `pipeline-ops` 已打通：`PipelineOpsBoard.vue` -> `usePipelineOpsBoardUi.ts` -> `usePipelineOpsBoard.ts` -> `services/pipeline-ops.ts` -> `frontend/server/api/pipeline-ops/*` -> `frontend/server/utils/pipeline-ops-db.ts` -> `backend/.../pipelineops/*`。
- `pipeline-ops` 后端已从单巨型仓储拆成“主仓储 + support 基类”：主流程在 `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`，通用归一化/缓存/影响范围/日志辅助在 `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java`。
- 写接口前端鉴权已切到全局弹层：`frontend/services/proxy-write-auth.ts` + `frontend/components/common/ProxyWriteAuthDialog.vue`，禁止再回退到浏览器原生 `prompt`。
- `pipeline-ops` 当前重要约束已经落地：
  - 列表、统计、Dashboard 共用同一套过滤条件。
  - 快速切换筛选时，旧请求不会覆盖新结果。
  - `assign` 必须带 `assignee`。
  - 巡检转维修必须基于异常巡检记录。
  - `set_duration` 必须是正整数分钟。
  - 无拓扑/无楼宇草稿不会自动绑定第一栋楼。
  - 日期/时间字段会在入库前校验，避免数据库 cast 直接抛 500。
- 改语义、接口、地图行为后，必须同步：
  - `README.md`
  - `开发日志.md`
  - 本文 `agent.md`

---

## 1) 不可违背规则（MUST）

1. 对外语义优先用 `pipes`，提到 `roads` 必须注明“存储层 roads”。
2. 复杂地图逻辑不要继续堆进 `MapView.vue` 或 `Pipe2DEditorDialog.vue`，优先下沉到 composable。
3. 新增前端文件必须遵守 `frontend/STRUCTURE.md`。
4. 文档必须对应仓库现状，禁止把设计稿、规划项、占位功能写成“已实现”。
5. 涉及接口、状态流、地图行为的修改，必须给出最小验证结果。
6. 只改当前任务必需文件，不顺手做无关重构。
7. 保持兼容：`pipes -> roads`、Twin 写接口 fallback、Nuxt server proxy 写鉴权不要被误删。
8. 文档、脚本、实现三者必须对齐，不能出现“README 可运行但脚本已失效”。
9. 新增后台业务交互禁止继续使用原生 `window.alert` / `window.prompt` / `window.confirm`，统一改为组件内弹层、表单或消息提示。
10. 不得提交构建产物或本地运行目录：`.nuxt/`、`.output/`、`build/`、`.gradle/`、`.gradle-home/`、测试报告目录都不应入库。
11. 若单文件已超过以下体量，默认视为重构警戒线，新增需求优先拆分而不是继续堆：
    - 前端 `.vue` / `.ts`：`800` 行
    - 后端 `.java`：`1200` 行
12. 修改 `pipeline-ops`、Twin、二维编辑器或写接口时，不允许只做静态改动说明，必须跑对应验证命令。
13. 跨前后端链路改动，默认优先执行仓库根目录 `./scripts/verify-local.sh`，除非能明确说明为什么只跑子集验证。
14. 评估是否继续拆大文件时，优先运行 `./scripts/check-size-guardrails.sh`，不要靠肉眼猜。
15. `./scripts/check-size-guardrails.sh` 只看仓库已跟踪或未忽略文件；若脚本输出了 `node_modules/.nuxt/.output`，说明脚本本身又退化了，先修脚本再继续用它做准绳。

### 1.1 新接手最短路径

如果你第一次接手这个仓库，默认按下面顺序：

1. 先跑 `./scripts/verify-local.sh`，确认本地环境和依赖完整。
   - 只改前端可先用 `./scripts/verify-local.sh frontend`
   - 只改后端可先用 `./scripts/verify-local.sh backend`
   - 只看体量守卫可先用 `./scripts/verify-local.sh guardrails`
2. 再读本文 `0) 先读 60 秒`、`4) 当前真实实现快照`、`8) 改动-验证矩阵`。
3. 改主地图，看 `frontend/pages/index.vue` + `frontend/components/MapView.vue` + `frontend/composables/shared/usePipeLayerLoader.ts`。
4. 改主地图选中、高亮、房间锚点，看 `frontend/composables/shared/useMapViewSelection.ts`。
5. 改主地图工单热力图、轮询、泵控刷新联动，看 `frontend/composables/shared/useMapViewWorkorderHeat.ts`。
6. 改主地图 BBox、动态 GeoJSON 抓取、建筑替换模型缩放，看 `frontend/utils/map-view-helpers.ts`。
7. 改二维编辑器，先看 `frontend/components/admin/Pipe2DEditorDialog.vue`，再按职责下钻到 `frontend/composables/admin/usePipe2DEditorWorkspace.ts`、`frontend/composables/admin/usePipe2DEditorDrafts.ts`、`frontend/composables/admin/usePipe2DEditorMap.ts`、`frontend/composables/admin/pipe2d-editor/*`、`frontend/composables/admin/usePipe2DEditorData.ts`。
8. 改工单联动，看 `frontend/components/admin/ops/PipelineOpsBoard.vue` + `frontend/composables/admin/usePipelineOpsBoardUi.ts` + `frontend/composables/admin/usePipelineOpsBoard.ts` + `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`。
9. 改写接口鉴权，看 `frontend/services/proxy-write-auth.ts`、`frontend/components/common/ProxyWriteAuthDialog.vue` 和 `frontend/server/api/*`。

### 1.2 指令冲突裁决顺序

1. 当前对话中的用户明确要求
2. 本文件 `agent.md`
3. `README.md` / `frontend/STRUCTURE.md` / 其它仓库说明文档
4. 历史习惯

如果用户要求与本文件冲突：

- 先执行用户要求
- 在交付说明中写清冲突点和影响范围

---

## 2) 仓库总览

- 前端：`frontend/`（Nuxt 3 + Cesium + Mars3D）
- 后端：`backend/`（Spring Boot 4 + JdbcTemplate + PostGIS）
- 启动脚本：`start.sh`
- 默认端口：前端 `3000`，后端 `8080`
- 后端 API 前缀：`/api/v1`
- 前端写代理前缀：
  - `frontend/server/api/backend/*`
  - `frontend/server/api/pipeline-ops/*`

---

## 3) 领域词典（统一术语）

- `pipes`：前端地图、后台资产中心、Twin 编辑器对外使用的管道层名。
- `roads`：`geo_features.layer` 中的实际存储层名。
- `pipeType`：前端注入的三类介质值，当前使用 `water | drain | sewage`。
- `visible`：`geo_features.visible`，后台资产中心和属性写回会用到。
- `Twin drilldown`：按 featureId 返回段、节点、关系、关联楼宇、受影响房间、阀门、设备。
- `Twin trace`：按上下游方向返回拓扑链路。
- `Twin telemetry_latest`：返回当前最新测点数据。
- `pipeline-ops`：巡检 / 维修 / 改造 / 报废 / 联动工单域。
- `impactScope`：工单影响范围，包含楼宇、楼层、房间和避让要求。
- `executionLogs`：工单执行日志，不等于状态时间轴；状态流转也会形成独立 timeline 记录。

---

## 4) 当前真实实现快照

### 4.1 主地图数据流

1. `frontend/pages/index.vue` 维护图层状态、选中项、视口。
2. `frontend/components/MapView.vue` 负责 Cesium 容器、相机同步、拾取、高亮、看板联动。
3. `frontend/composables/shared/usePipeLayerLoader.ts` 负责：
   - 请求 `GET /api/v1/features?layers=pipes&visible=true&bbox=...&page=...`
   - 按 `highway` 分类为 `water/drain/sewage`
   - 注入 `properties.pipeType`
   - 统一三类线宽 `5`
4. `frontend/composables/shared/useMapViewSelection.ts` 负责：
   - 选中实体高亮
   - 楼宇/房间 fallback 锚点
   - focus 图层标注
5. `frontend/composables/shared/useMapViewWorkorderHeat.ts` 负责：
   - 工单热力点拉取与轮询
   - cluster 样式
   - 泵控刷新后的热力图重载
6. `frontend/utils/map-view-helpers.ts` 负责：
   - 当前视口 BBox 计算
   - 分页抓取动态图层
   - 建筑替换模型 footprint/scale 计算
7. 建筑层来自 `layers=buildings`，绿地仍来自静态 `public/map/green.geojson`。

### 4.2 后台资产中心

- 页面：`frontend/pages/admin.vue`
- CRUD 组件：
  - `frontend/components/admin/GeoFeatureTable.vue`
  - `frontend/components/admin/AssetFeatureDialog.vue`
  - `frontend/components/admin/AssetDeleteDialog.vue`
  - `frontend/components/admin/AssetRowActions.vue`
  - `frontend/components/admin/AssetVisibilitySwitch.vue`
- 状态编排：`frontend/composables/admin/useAssetCrud.ts`
- 服务层：`frontend/services/geo-features.ts`
- 写代理：`frontend/server/api/backend/features*.ts`

### 4.3 管道二维编辑器（Mars3D）

- 顶层壳：`frontend/components/admin/Pipe2DEditorDialog.vue`
  - 负责弹窗开关、草稿状态、消息提示、面板联动、事件编排
- 区块组件：
  - `frontend/components/admin/pipe2d-editor/Pipe2DEditorTopbarSection.vue`
  - `frontend/components/admin/pipe2d-editor/Pipe2DEditorToolbarSection.vue`
  - `frontend/components/admin/pipe2d-editor/Pipe2DEditorStageSection.vue`
  - `frontend/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue`
  - `frontend/components/admin/pipe2d-editor/Pipe2DEditorStatusbarSection.vue`
  - `frontend/components/admin/pipe2d-editor/Pipe2DEditorShortcutHelp.vue`
- 地图交互：`frontend/composables/admin/usePipe2DEditorMap.ts`
  - 懒加载 Mars3D：`frontend/utils/mars3d-loader.ts`
  - 默认高德底图
  - 支持 2D/3D 切换、地下切片、聚焦当前管道、缩放控件
  - 装配地图实例、相机同步、底图切换和视图控制
- 地图交互：`frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`
  - 负责线段/节点选中、点击插点、中心加点、删除节点、右键菜单、吸附提示、长度 hover、撤销/重做、键盘快捷键
  - 使用 Cesium 拾取 + 邻近命中兜底，保持 Mars3D 编辑态下的点线可选中
- 地图共享辅助：`frontend/composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts`
  - 负责地图层共享类型、缩放/测长辅助、命中辅助函数
- 地图图元渲染：`frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`
  - 负责草稿线/点渲染、Mars3D 图层同步、编辑态图元回写、拖拽释放兜底
- 工作区壳层状态：`frontend/composables/admin/usePipe2DEditorWorkspace.ts`
  - 负责工具栏拖拽放置、视图切换、项目标题、快捷键、画布皮肤与壳层 UI 状态
- 数据编排：`frontend/composables/admin/usePipe2DEditorData.ts`
  - `loadPipes()`
  - `loadInsights()`：并行拉 `drilldown / trace / telemetry / audit`
  - `saveGeometry()`：优先 Twin 写，失败回退 `geo-features.update()`
- 草稿管理：`frontend/composables/admin/usePipe2DEditorDrafts.ts`
  - 负责本地草稿恢复、`800ms` 防抖暂存、`8s` 周期暂存、服务端草稿状态文案
- 服务层：`frontend/services/twin.ts`
  - 读：`drilldown` / `trace` / `telemetryLatest` / `listAuditLogs`
  - 写：`updatePipeGeometry` / `updatePipeProperties`
- 当前已落地的编辑器持久化：
  - 几何保存
  - 名称重命名保存
  - 草稿本地恢复
  - 保存成功 toast
  - 审计日志回读

### 4.4 工单联动（`pipeline-ops`）

- 前端看板编排壳：`frontend/components/admin/ops/PipelineOpsBoard.vue`
  - 只负责拼装区块组件与透传状态/事件
- UI 子组件：
  - `frontend/components/admin/ops/PipelineOpsOverviewSection.vue`
  - `frontend/components/admin/ops/PipelineOpsCreateSection.vue`
  - `frontend/components/admin/ops/PipelineOpsListSection.vue`
  - `frontend/components/admin/ops/PipelineOpsActionDialog.vue`
  - `frontend/components/admin/ops/PipelineOpsDetailPanel.vue`
  - `frontend/components/admin/ops/PipelineOpsImpactCard.vue`
  - `frontend/components/admin/ops/PipelineOpsLogsCard.vue`
  - `frontend/components/admin/ops/PipelineOpsPumpCard.vue`
  - `frontend/components/admin/ops/PipelineOpsInspectionCard.vue`
  - `frontend/components/admin/ops/pipeline-ops-detail-types.ts`
  - `frontend/components/admin/ops/pipeline-ops-view-constants.ts`
  - 模式：`inspection` / `maintenance` / `retrofit` / `retire` / `linkage`
  - 能力：筛选、统计卡、Dashboard、建单、详情、执行日志、泵控、异常巡检转维修
- 状态编排：`frontend/composables/admin/usePipelineOpsBoard.ts`
  - 列表请求使用完整过滤条件
  - 统计和 Dashboard 与列表共享过滤条件
  - `refreshRequestId` 防止旧响应覆盖新状态
- 壳层 UI 流程：`frontend/composables/admin/usePipelineOpsBoardUi.ts`
  - 负责弹层开关、表单草稿、通知提示、泵控倒计时、路由打开详情、地图定位跳转
- 客户端服务：`frontend/services/pipeline-ops.ts`
  - 所有写操作通过同源 `/api/pipeline-ops/*`
  - 已接入 proxy 写鉴权头
- 全局写鉴权 UI：
  - 服务：`frontend/services/proxy-write-auth.ts`
  - 弹层：`frontend/components/common/ProxyWriteAuthDialog.vue`
  - 行为：命中 401/403 写鉴权时弹层收集凭证，并自动重试当前请求
- Nuxt server 代理：
  - 路由：`frontend/server/api/pipeline-ops/*`
  - 代理工具：`frontend/server/utils/pipeline-ops-db.ts`
  - 统一转发到 Spring Boot `/api/v1/pipeline-ops/*`
- 迁移脚本：`frontend/scripts/migrate-pipeline-ops-json-to-postgres.mjs`
  - 源文件：`frontend/server/data/pipeline-ops.json`
  - 当 `BACKEND_WRITE_AUTH_ENABLED=false` 时不再强制要求密码

### 4.5 后端 Geo / Twin / PipelineOps

- Geo 接口：`backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`
- Twin 只读接口：`backend/src/main/java/com/jolt/workflow/geo/TwinController.java`
- Twin 写接口：`backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java`
- 模块 2 遥测：`backend/src/main/java/com/jolt/workflow/geo/Module2TelemetryController.java`
- 工单接口：`backend/src/main/java/com/jolt/workflow/pipelineops/PipelineOpsController.java`
- 工单主流程仓储：`backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`
- 工单 support 基类：`backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java`

### 4.6 当前数据库迁移重点

- `V1__init_postgis_and_features.sql`
- `V3__add_twin_topology_tables.sql`
- `V5__add_twin_entity_tables.sql`
- `V6__add_module2_telemetry_tables.sql`
- `V8__add_buildings_and_rooms_tables.sql`
- `V9__seed_buildings_and_rooms_from_json.sql`
- `V10__add_pipeline_ops_tables.sql`

---

## 5) 目录职责与代码落位

### 5.1 前端

- `pages/`：路由入口，只做页面拼装
- `components/`：可复用组件
- `components/admin/pipe2d-editor/`：二维编辑器 UI 分区组件
- `components/admin/ops/`：工单看板 UI
- `composables/admin/`：后台业务状态与交互逻辑
- `composables/shared/`：主地图共享逻辑
- `services/`：请求封装，不放 Vue 状态
- `server/api/`：Nuxt server 路由，负责 proxy 和写鉴权
- `utils/`：纯函数和第三方库加载器

### 5.2 地图模块红线

- 不在 `MapView.vue` 新增复杂分类规则。
- 不在 `MapView.vue` 新增选中高亮、BBox 抓取、建筑替换模型计算等纯逻辑；这些逻辑优先下沉到 `useMapViewSelection.ts` 或 `map-view-helpers.ts`。
- 不在多个组件重复写同一套管道分类逻辑。
- 不要把 Mars3D 编辑逻辑再塞回 `Pipe2DEditorDialog.vue`。
- 修改 `PIPE_LAYER_NAMES` 或主地图图层行为时，必须同步 `MapControls.vue`、`index.vue` 和文档。

### 5.3 二维编辑器红线

- `Pipe2DEditorDialog.vue` 只做编排，不承载复杂几何算法。
- 工具栏拖拽、画布视图、快捷键、项目标题等壳层状态优先改 `usePipe2DEditorWorkspace.ts`。
- 本地草稿、恢复、自动保存优先改 `usePipe2DEditorDrafts.ts`。
- 图元渲染、Mars3D 图层同步、编辑态可视化优先改 `composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`。
- 选中、插点、删点、hover、右键菜单、快捷键优先改 `composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`。
- 共享地图类型/命中/缩放辅助优先改 `composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts`。
- `usePipe2DEditorMap.ts` 只承载状态装配、Mars3D 初始化、相机/底图/场景模式控制，禁止再把交互细节塞回去。
- Twin 读写逻辑优先改 `usePipe2DEditorData.ts` 或 `services/twin.ts`。
- 改名称持久化时，不要只改本地 `pipes` 数组，必须同步后端。

### 5.4 `pipeline-ops` 红线

- 看板筛选、统计、Dashboard 必须保持同一套过滤语义。
- `PipelineOpsBoard.vue` 只做编排；新 UI 区块优先落到 `ops/` 子组件，不要再把大块模板塞回主文件。
- `PipelineOpsBoard.vue` 若因表单/弹层/通知/timer 继续膨胀，优先补 `usePipelineOpsBoardUi.ts`，不要把这些状态重新塞回组件脚本。
- 写接口一律经 `services/pipeline-ops.ts` -> Nuxt server proxy，不能前端直接打后端写接口。
- `WorkOrderRepository.java` 改 SQL 时必须同步检查：
  - 参数顺序
  - 日期/时间校验
  - building 过滤语义
  - 影响范围去重
  - 状态流转前置校验
- 非业务主流程的归一化、JSON 解析、缓存、日志落库、影响范围推断，优先放 `WorkOrderRepositorySupport.java`，不要重新堆回主仓储。

### 5.5 工程护栏

- 新增脚本时，优先补到已有启动/验证链路，并同步 `README.md`。
- 改前端管理台交互时，优先做组件化弹层，不接受再引入浏览器原生阻塞式交互。
- 触达超大文件时，若这次不拆，交付说明里必须明确“不拆的原因”和下一步拆分点。
- 只要发现本地构建产物、缓存目录或测试报告出现在 git 变更里，先处理掉再继续提交。
- 新接手 agent 默认先看 `AGENTS.md`，再下钻本文；不要跳过仓库入口说明直接盲改。

### 5.6 当前主要技术债

- `pipeline-ops` 主壳和详情壳已经拆开，但其它历史业务模块仍未统一到这种结构，后续接手新模块时按这个模式继续拆。
- 历史物业模块仍有部分原生 `alert/confirm/prompt`，接手这些模块时优先替换，不要延续旧写法。
- 前端构建仍存在大 chunk 警告和 `mars3d-cesium` 的 `eval` 警告，当前不阻塞功能，但属于持续优化项。

---

## 6) 任务决策树

### 6.1 如果需求是“改主地图表现”

1. 先判断是样式、加载范围还是分类问题。
2. 样式和分类优先改 `usePipeLayerLoader.ts`。
3. 选中高亮或房间锚点优先改 `useMapViewSelection.ts`。
4. BBox、分页抓取、建筑替换模型优先改 `map-view-helpers.ts`。
5. 只涉及编排或拾取再改 `MapView.vue`。
6. 回归 `layers=pipes`、图层开关、实体点击。

### 6.2 如果需求是“改后台二维编辑器 UI”

1. 先找对应区块组件：
   - 顶部栏：`Pipe2DEditorTopbarSection.vue`
   - 工具栏：`Pipe2DEditorToolbarSection.vue`
   - 画布区：`Pipe2DEditorStageSection.vue`
   - 右侧面板：`Pipe2DEditorRightPanelSection.vue`
   - 底部状态栏：`Pipe2DEditorStatusbarSection.vue`
2. 壳层 UI 状态优先改 `usePipe2DEditorWorkspace.ts`，不要把拖拽、快捷键、视图切换回塞主组件。
3. 只在壳组件做事件连接，不把细节逻辑拉回去。

### 6.3 如果需求是“改二维编辑交互/保存”

1. 先判断属于哪一层：
   - 地图初始化、相机、底图、场景切换：`usePipe2DEditorMap.ts`
   - 选点、插点、删点、撤销、右键、快捷键：`usePipe2DEditorMapInteractions.ts`
   - 渲染同步、编辑态图元回写：`usePipe2DEditorMapGraphics.ts`
2. 草稿恢复/自动保存优先改 `usePipe2DEditorDrafts.ts`
3. Twin 拉取/保存优先改 `usePipe2DEditorData.ts`
4. 网络接口优先改 `services/twin.ts` 或 Nuxt backend proxy
5. 至少回归：选中节点、选中线段、插点、删点、撤销、保存、重新打开

### 6.4 如果需求是“改工单联动看板”

1. UI 壳层优先改 `PipelineOpsBoard.vue`
2. 壳层交互、弹层、表单、通知优先改 `usePipelineOpsBoardUi.ts`
3. 状态、过滤、刷新语义优先改 `usePipelineOpsBoard.ts`
4. API 封装优先改 `services/pipeline-ops.ts`
5. server proxy 改 `frontend/server/api/pipeline-ops/*` 或 `pipeline-ops-db.ts`
5. 后端行为改 `PipelineOpsController.java` / `WorkOrderRepository.java`
6. 如果只是改缓存、归一化、impact scope、日志装配，优先改 `WorkOrderRepositorySupport.java`

### 6.5 如果需求是“改写接口鉴权 / 代理”

1. Geo/Twin 写代理看 `frontend/server/api/backend/*`
2. 工单写代理看 `frontend/server/api/pipeline-ops/*`
3. 鉴权头逻辑看 `frontend/server/utils/backend-proxy.ts` 和相关 proxy util
4. 同步验证 `BACKEND_WRITE_AUTH_ENABLED=true/false`

### 6.6 如果需求描述不完整

1. 先按最小可行改动处理
2. 不确定项默认保持向后兼容
3. 若会引入破坏性语义变更，先停下确认

---

## 7) 常见任务改动地图

### 7.1 管道分类规则

- `frontend/composables/shared/usePipeLayerLoader.ts`
- 可能联动：`frontend/pages/index.vue`

### 7.2 主地图管道样式

- `frontend/composables/shared/usePipeLayerLoader.ts`

### 7.3 二维编辑器视觉样式

- `frontend/components/admin/Pipe2DEditorDialog.vue`
- `frontend/components/admin/pipe2d-editor/*.vue`

### 7.4 二维编辑器节点/线段选中、插点、删点

- `frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`
- `frontend/composables/admin/usePipe2DEditorMap.ts`

### 7.5 二维编辑器 Twin 穿透/追踪/遥测/审计

- `frontend/composables/admin/usePipe2DEditorData.ts`
- `frontend/services/twin.ts`
- `backend/src/main/java/com/jolt/workflow/geo/TwinController.java`

### 7.6 二维编辑器几何/属性写回

- `frontend/services/twin.ts`
- `frontend/server/api/backend/twin/pipes/[id]/geometry.put.ts`
- `frontend/server/api/backend/twin/pipes/[id]/properties.put.ts`
- `backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java`

### 7.7 工单筛选、统计、看板不一致

- `frontend/composables/admin/usePipelineOpsBoard.ts`
- `frontend/services/pipeline-ops.ts`
- `frontend/server/utils/pipeline-ops-db.ts`
- `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`
- `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java`

### 7.8 工单流程校验、日志、泵控

- `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`
- `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java`

### 7.9 迁移脚本

- `frontend/scripts/migrate-pipeline-ops-json-to-postgres.mjs`

---

## 8) 改动-验证矩阵（DoD）

### 8.1 改主地图

至少执行：

```bash
curl -s "http://localhost:8080/api/v1/features?layers=pipes&limit=1"
curl -s "http://localhost:8080/api/v1/features?layers=buildings&limit=1"
cd frontend && npm run typecheck
```

浏览器确认：

- 首页可打开
- 三类管道可切换
- 点击实体后右侧详情不报错

### 8.2 改后台资产中心

至少回归：

- `/admin` 可进入资产中心
- 建筑/管道列表都能加载
- `visible` 开关可写回
- 新增/编辑/删除可刷新
- `cd frontend && npm run typecheck`

### 8.3 改二维编辑器

至少执行：

```bash
cd frontend && npm run typecheck
cd frontend && npm run build
curl -s "http://localhost:8080/api/v1/twin/drilldown/way/25598484" | head -c 400
curl -s "http://localhost:8080/api/v1/twin/trace?startId=way/25598484&direction=down" | head -c 400
curl -s "http://localhost:8080/api/v1/twin/telemetry/latest?featureIds=way/25598484" | head -c 400
curl -s "http://localhost:8080/api/v1/twin/audit/way/25598484?limit=5" | head -c 400
```

页面回归：

- 打开 `/admin` -> 管道二维编辑
- 选中线段成功
- 选中节点成功
- 插点/删点可用
- 保存后重新打开仍为新几何
- 重命名后刷新仍保留

### 8.4 改 `pipeline-ops`

至少执行：

```bash
./scripts/verify-local.sh
```

或最小子集：

```bash
cd backend && ./gradlew test
cd frontend && npm run typecheck
curl -s "http://localhost:8080/api/v1/pipeline-ops/workorders?limit=2" | head -c 400
curl -s "http://localhost:8080/api/v1/pipeline-ops/stats?type=inspection" | head -c 400
curl -s "http://localhost:8080/api/v1/pipeline-ops/dashboard?type=inspection" | head -c 400
```

页面回归：

- `/admin` 看板可加载列表、统计、Dashboard
- 任意筛选后，列表、统计、Dashboard 口径一致
- 快速切换筛选不会出现旧数据回写
- 建单、流转、写日志、泵控动作可走通

### 8.5 改构建/脚本

至少执行：

```bash
./scripts/verify-local.sh
```

只改前端构建链路时可退化为：

```bash
./scripts/verify-local.sh frontend
./scripts/verify-local.sh guardrails
```

如涉及迁移脚本，再执行：

```bash
cd frontend && npm run migrate:pipeline-ops
```

### 8.6 验证失败时的闭环要求

- 交付说明中必须写清失败命令
- 写清报错摘要
- 写清已尝试修复动作
- 不要把“未验证”描述成“已完成”

---

## 9) 高价值文件索引

### 前端主地图

- `frontend/pages/index.vue`
- `frontend/components/MapView.vue`
- `frontend/composables/shared/usePipeLayerLoader.ts`
- `frontend/composables/shared/useMapViewSelection.ts`
- `frontend/utils/map-view-helpers.ts`

### 前端后台资产中心

- `frontend/pages/admin.vue`
- `frontend/composables/admin/useAssetCrud.ts`
- `frontend/services/geo-features.ts`

### 前端二维编辑器

- `frontend/components/admin/Pipe2DEditorDialog.vue`
- `frontend/components/admin/pipe2d-editor/Pipe2DEditorTopbarSection.vue`
- `frontend/components/admin/pipe2d-editor/Pipe2DEditorToolbarSection.vue`
- `frontend/components/admin/pipe2d-editor/Pipe2DEditorStageSection.vue`
- `frontend/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue`
- `frontend/components/admin/pipe2d-editor/Pipe2DEditorStatusbarSection.vue`
- `frontend/components/admin/pipe2d-editor/Pipe2DEditorShortcutHelp.vue`
- `frontend/components/admin/pipe2d-editor/pipe2d-editor-config.ts`
- `frontend/composables/admin/usePipe2DEditorWorkspace.ts`
- `frontend/composables/admin/usePipe2DEditorDrafts.ts`
- `frontend/composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts`
- `frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`
- `frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`
- `frontend/composables/admin/usePipe2DEditorMap.ts`
- `frontend/composables/admin/usePipe2DEditorData.ts`
- `frontend/services/twin.ts`
- `frontend/utils/mars3d-loader.ts`
- `frontend/utils/pipe2d-geometry.ts`

### 前端工单联动

- `frontend/components/admin/ops/PipelineOpsBoard.vue`
- `frontend/components/admin/ops/PipelineOpsOverviewSection.vue`
- `frontend/components/admin/ops/PipelineOpsCreateSection.vue`
- `frontend/components/admin/ops/PipelineOpsListSection.vue`
- `frontend/components/admin/ops/PipelineOpsActionDialog.vue`
- `frontend/components/admin/ops/PipelineOpsDetailPanel.vue`
- `frontend/components/admin/ops/PipelineOpsImpactCard.vue`
- `frontend/components/admin/ops/PipelineOpsLogsCard.vue`
- `frontend/components/admin/ops/PipelineOpsPumpCard.vue`
- `frontend/components/admin/ops/PipelineOpsInspectionCard.vue`
- `frontend/components/admin/ops/pipeline-ops-detail-types.ts`
- `frontend/components/admin/ops/pipeline-ops-view-constants.ts`
- `frontend/components/common/ProxyWriteAuthDialog.vue`
- `frontend/composables/admin/usePipelineOpsBoardUi.ts`
- `frontend/composables/admin/usePipelineOpsBoard.ts`
- `frontend/services/pipeline-ops.ts`
- `frontend/services/proxy-write-auth.ts`
- `frontend/server/api/pipeline-ops/*.ts`
- `frontend/server/utils/pipeline-ops-db.ts`
- `frontend/scripts/migrate-pipeline-ops-json-to-postgres.mjs`

### 仓库脚本

- `scripts/verify-local.sh`
- `scripts/check-size-guardrails.sh`
- `scripts/perf-baseline.sh`

### 后端

- `backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`
- `backend/src/main/java/com/jolt/workflow/geo/TwinController.java`
- `backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java`
- `backend/src/main/java/com/jolt/workflow/geo/Module2TelemetryController.java`
- `backend/src/main/java/com/jolt/workflow/pipelineops/PipelineOpsController.java`
- `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`
- `backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java`
- `backend/src/main/resources/db/migration/`

---

## 10) 文档同步要求

以下变更做完后，默认要同步文档：

- 语义变化：`pipes` / `roads` / 介质分类 / 图层名称
- 接口变化：新增参数、返回字段、鉴权方式、错误码
- 二维编辑器交互变化：选中、插点、删点、保存链路、草稿逻辑
- `pipeline-ops` 过滤、流转、日志、泵控、迁移脚本行为变化

最低同步集：

- `README.md`
- `开发日志.md`
- `agent.md`
