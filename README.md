# UniSpace-AI

基于 GIS / 数字孪生的校园地下管网运维系统。

- 前端：Nuxt 3（Vue 3）+ Cesium（主三维地图）+ Mars3D（后台二维/2.5D 管道编辑）+ TailwindCSS + AI 助手（Gemini，SSE 流式输出）
- 后端：Spring Boot 4 + PostgreSQL/PostGIS + Flyway（空间要素、Twin 拓扑、`pipeline-ops` 工单）

> 当前版本说明：
>
> - 主地图中的“管道”已切换为后端动态数据：前端请求 `GET /api/v1/features?layers=pipes`，并在前端按管道分类规则（源自道路 `highway`）映射为 `water/drain/sewage` 三类（统一线宽 `5`）。
> - 后端对 `pipes` 做了别名兼容，实际仍存储在 `geo_features.layer='roads'`。
> - 后台大厅（`/admin`）已包含三条主链路：资产中心（`buildings/pipes` CRUD）、Mars3D 管道二维编辑器、`pipeline-ops` 工单联动看板。
> - 管道二维编辑器采用本地 npm 模式加载 Mars3D，支持高德底图、2D/3D 切换、节点/线段选中、插点删点、右键菜单、本地草稿自动保存、Twin 几何写回、属性重命名写回。
> - `pipeline-ops` 已打通前端看板、Nuxt server 代理、Spring Boot 仓储与 Postgres 表，列表/统计/看板使用同一套过滤条件。

---

## 目录

- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量与配置](#环境变量与配置)
- [前端说明（Nuxt + Cesium + Mars3D）](#前端说明-nuxt--cesium--mars3d)
- [后端说明（Spring Boot + PostGIS）](#后端说明-spring-boot--postgis)
- [数据准备：GeoJSON 拆分](#数据准备-geojson-拆分)
- [数据导入：GeoJSON -> PostGIS（buildings/pipes（存储层 roads）实操流程）](#数据导入-geojson---postgisbuildingspipes存储层-roads实操流程)
- [API 列表（后端）](#api-列表后端)
- [常见问题](#常见问题)
- [Git 工作流（推荐）](#git-工作流推荐)
- [下一步建议](#下一步建议)

---

## 项目结构

```text
UniSpace-AI/
├── start.sh
├── docker-compose.yml
├── agent.md
├── backend/
│   ├── build.gradle.kts
│   ├── src/main/java/com/jolt/workflow/
│   │   ├── WorkflowApplication.java
│   │   ├── config/
│   │   ├── geo/
│   │   │   ├── GeoFeatureController.java
│   │   │   ├── TwinController.java
│   │   │   ├── TwinWriteController.java
│   │   │   └── Module2TelemetryController.java
│   │   └── pipelineops/
│   │       ├── PipelineOpsController.java
│   │       └── WorkOrderRepository.java
│   └── src/main/resources/
│       ├── application.properties
│       └── db/migration/
│           ├── V1__init_postgis_and_features.sql
│           ├── V3__add_twin_topology_tables.sql
│           ├── V8__add_buildings_and_rooms_tables.sql
│           └── V10__add_pipeline_ops_tables.sql
└── frontend/
    ├── nuxt.config.ts
    ├── pages/
    │   ├── index.vue                      # 主三维地图
    │   └── admin.vue                      # 后台大厅（资产中心 + 工单联动）
    ├── components/
    │   ├── MapView.vue
    │   ├── MapControls.vue
    │   ├── ChatInterface.vue
    │   └── admin/
    │       ├── Pipe2DEditorDialog.vue
    │       ├── pipe2d-editor/
    │       │   ├── Pipe2DEditorTopbarSection.vue
    │       │   ├── Pipe2DEditorToolbarSection.vue
    │       │   ├── Pipe2DEditorStageSection.vue
    │       │   ├── Pipe2DEditorRightPanelSection.vue
    │       │   ├── Pipe2DEditorStatusbarSection.vue
    │       │   └── Pipe2DEditorShortcutHelp.vue
    │       └── ops/
    │           └── PipelineOpsBoard.vue
    ├── composables/
    │   ├── admin/
    │   │   ├── useAssetCrud.ts
    │   │   ├── usePipe2DEditorData.ts
    │   │   ├── usePipe2DEditorMap.ts
    │   │   └── usePipelineOpsBoard.ts
    │   ├── shared/
    │   │   └── usePipeLayerLoader.ts
    │   ├── useConstants.ts
    │   └── useGeminiChat.ts
    ├── services/
    │   ├── geo-features.ts
    │   ├── twin.ts
    │   └── pipeline-ops.ts
    ├── server/
    │   ├── api/
    │   │   ├── backend/
    │   │   │   ├── features*.ts
    │   │   │   └── twin/pipes/[id]/*.put.ts
    │   │   ├── pipeline-ops/
    │   │   │   ├── workorders.get.ts
    │   │   │   ├── workorders.post.ts
    │   │   │   ├── workorders.patch.ts
    │   │   │   ├── workorder.get.ts
    │   │   │   ├── stats.get.ts
    │   │   │   ├── dashboard.get.ts
    │   │   │   ├── auto-create.post.ts
    │   │   │   └── action.post.ts
    │   │   └── chat.post.ts
    │   └── utils/
    │       └── pipeline-ops-db.ts
    ├── scripts/
    │   ├── ensure-nuxt-internal.mjs
    │   └── migrate-pipeline-ops-json-to-postgres.mjs
    ├── utils/
    │   ├── mars3d-loader.ts
    │   └── pipe2d-geometry.ts
    └── public/map/
        ├── map_all.geojson
        ├── buildings.geojson
        ├── green.geojson
        ├── roads.geojson
        └── split_geojson.py
```

---

## 技术栈

### 前端

- Nuxt 3 / Vue 3
- Cesium（主地图）
- Mars3D（后台二维/2.5D 管道编辑器）
- TailwindCSS（全局样式/主地图仍使用）
- 后台大厅（`/admin`）：浅色字节后台风格（纯 CSS，组件化在 `frontend/components/admin/`）
- `pipeline-ops` 工单看板（前端服务层 + Nuxt server 代理）
- `vite-plugin-cesium`
- AI：`@google/genai`（通过 Nuxt server route 代理）

### 后端

- Spring Boot 4
- Spring Web
- Spring Data JPA（当前主要用于初始化/数据源管理；Geo 查询使用 `JdbcTemplate`）
- Flyway
- PostgreSQL + PostGIS

---

## 快速开始

### 环境要求

- Node.js >= 18
- JDK 21
- Docker（可选：用于启动 PostGIS 容器）

### 方式 A：一键启动（推荐）

```bash
cp .env.example .env
# 按需修改 .env（至少配置 POSTGRES_PASSWORD / APP_ADMIN_PASSWORD / GEMINI_API_KEY）
chmod +x start.sh
./start.sh
```

启动后：

- 前端：http://localhost:3000
- 后端：http://localhost:8080

### 方式 B：分别启动

#### 1) 启动数据库（建议）

项目提供 `docker-compose.yml` 用于启动 PostGIS：

```bash
docker compose up -d
```

默认数据库参数：

- Host：`localhost`
- Port：`5432`
- Database：`unispace`
- Username：`postgres`
- Password：读取环境变量 `POSTGRES_PASSWORD`

#### 2) 启动后端

```bash
cd backend
./gradlew bootRun
```

#### 3) 启动前端

```bash
cd frontend
npm ci || npm install
npm run dev
npm run typecheck
```

#### 3.1) 跑一遍仓库级验证（推荐）

```bash
./scripts/verify-local.sh
```

说明：

- 顺序执行 `backend` 单元测试、`frontend` 类型检查、`frontend` 生产构建
- 适合在提交前或接手新模块前先确认本地环境完整
- 若只改单侧代码，可以按需执行对应子命令；跨前后端链路改动优先跑这个脚本

#### 4) 导入旧版 `pipeline-ops.json` 到 Postgres（可选）

```bash
cd frontend
npm run migrate:pipeline-ops
```

说明：

- 默认读取 `frontend/server/data/pipeline-ops.json`
- 默认写入 `http://localhost:8080/api/v1/pipeline-ops/workorders`
- 当 `BACKEND_WRITE_AUTH_ENABLED=true` 时需要 `BACKEND_ADMIN_PASSWORD` 或 `APP_ADMIN_PASSWORD`
- 当 `BACKEND_WRITE_AUTH_ENABLED=false` 时，脚本不会强制要求密码

---

## 环境变量与配置

### 后端（backend）

`backend/src/main/resources/application.properties` 中支持如下变量：

- `DB_URL`（默认：`jdbc:postgresql://localhost:5432/unispace`）
- `DB_USER`（默认：`postgres`）
- `DB_PASSWORD`（必需，建议强口令）
- `APP_SECURITY_WRITE_AUTH_ENABLED`（默认：`true`，开启后端写接口鉴权）
- `APP_ADMIN_USER`（默认：`admin`）
- `APP_ADMIN_PASSWORD`（当写接口鉴权开启时必需）

### 前端（frontend）

`frontend/nuxt.config.ts` 中：

- `GEMINI_API_KEY`：Nuxt server 侧读取的 Gemini API Key（**必需**，否则 `/api/chat` 会 500）
- `BACKEND_BASE_URL` / `NUXT_PUBLIC_BACKEND_BASE_URL`：前端 server proxy 访问 Spring Boot 的基础地址（默认 `http://localhost:8080`）
- `BACKEND_WRITE_AUTH_ENABLED`（默认：继承 `APP_SECURITY_WRITE_AUTH_ENABLED`；为 `false` 时 Nuxt 代理后端写接口不再附加 Basic 头）
- `BACKEND_ADMIN_USER` / `BACKEND_ADMIN_PASSWORD`：当 `BACKEND_WRITE_AUTH_ENABLED=true` 时用于 Nuxt server 侧代理后端写接口（可复用 `APP_ADMIN_USER` / `APP_ADMIN_PASSWORD`）
- 当 `BACKEND_WRITE_AUTH_ENABLED=true` 时，`/api/backend/*` 与 `/api/pipeline-ops/*` 的写路由都会校验调用方请求头中的 HTTP Basic（需与 `BACKEND_ADMIN_USER` / `BACKEND_ADMIN_PASSWORD` 一致）
- 浏览器端所有代理写操作现在统一走全局认证弹层，不再使用原生 `prompt`

示例：

```bash
cp .env.example .env
vi .env

export GEMINI_API_KEY=YOUR_KEY
```

---

## 前端说明（Nuxt + Cesium + Mars3D）

### 页面入口

- `pages/index.vue`
  - 作为全局状态“源头”维护：
    - `selectedItem`：当前选中对象（建筑/管网/GeoJSON feature）
    - `viewport`：视口（经纬度 + 相机高度）
    - `layers`：图层开关（water/sewage/drain/buildings/green）
  - 将状态通过 props 传给 `MapView`、`MapControls`、`RightSidebar` 等组件。

- `pages/admin.vue`
  - 后台大厅（浅色字节后台风格）：
    - 使用左侧菜单布局（组件：`components/admin/AdminLayout.vue`、`components/admin/AdminSider.vue`），资产中心包含二级菜单：建筑 / 管道
    - 资产中心：读取走后端 GeoJSON API（`GET /api/v1/features?...`），写操作走 Nuxt server 代理（`/api/backend/*`），并支持搜索、可见性切换、要素 CRUD
    - 组件化：表格/弹窗/操作已拆分为 `components/admin/GeoFeatureTable.vue`、`components/admin/AssetFeatureDialog.vue`、`components/admin/AssetDeleteDialog.vue`、`components/admin/AssetRowActions.vue`、`components/admin/AssetVisibilitySwitch.vue`
    - 资产 CRUD 逻辑收敛到 `composables/admin/useAssetCrud.ts`，请求封装在 `services/geo-features.ts`
    - 管道二维编辑：由 `components/admin/Pipe2DEditorDialog.vue` 打开，实际界面拆分在 `components/admin/pipe2d-editor/`
    - 工单联动看板：由 `components/admin/ops/PipelineOpsBoard.vue` 承载巡检/维修/改造/报废/联动五种模式
    - 编辑体验：资产表单支持「表单模式（默认）」+「高级 JSON」双模式
    - `useConstants.ts` 中仍保留主地图右侧详情、部分 mock 统计和演示数据

### 地图核心（`components/MapView.vue`）

- 使用 `Cesium.Viewer` 初始化场景，采用深色底图（Carto dark）
- 地图图层职责拆分：
  - `MapView.vue`：地图容器、相机同步、拾取、高亮、通用图层装载
  - `composables/shared/usePipeLayerLoader.ts`：管道图层加载/分类/样式（可复用）
- 图层数据来源：
  - 管道三分类（`water/drain/sewage`）：从后端 `GET /api/v1/features?layers=pipes&visible=true` 拉取后分类
  - 建筑：从后端 `GET /api/v1/features?layers=buildings&visible=true` 拉取
  - 绿地：仍使用静态文件 `public/map/green.geojson`
- 管道样式：三类统一线宽 `5`，并使用发光材质（`PolylineGlowMaterialProperty`）
- 图层显隐：通过 `dataSource.show = props.layers.xxx` 控制
- 拾取：`ScreenSpaceEventHandler` + `viewer.scene.pick`，拾取 entity 后 emit `select` 给父组件

### 管道二维编辑器（Mars3D）

- 顶层容器：`components/admin/Pipe2DEditorDialog.vue`
  - 只保留状态编排、草稿状态、顶部/工具栏/右侧面板的事件分发
  - 当前 UI 已拆分为 6 个区块组件：
    - `Pipe2DEditorTopbarSection.vue`
    - `Pipe2DEditorToolbarSection.vue`
    - `Pipe2DEditorStageSection.vue`
    - `Pipe2DEditorRightPanelSection.vue`
    - `Pipe2DEditorStatusbarSection.vue`
    - `Pipe2DEditorShortcutHelp.vue`
- 地图交互：`composables/admin/usePipe2DEditorMap.ts`
  - 通过 `utils/mars3d-loader.ts` 懒加载 Mars3D；首次加载失败时允许重试
  - 默认高德矢量底图，支持 2D/3D 切换、地下切片、缩放、聚焦当前管道
  - 装配地图实例、相机同步、底图切换和视图控制
- 地图交互：`composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`
  - 负责线段/节点选中、点击插点、中心加点、删除节点、右键菜单、吸附提示、长度 hover、撤销/重做、键盘快捷键
  - 使用 Cesium 拾取 + 邻近命中兜底，保持 Mars3D 编辑态下的点线可选中
- 地图共享辅助：`composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts`
  - 负责地图层共享类型、缩放/测长辅助、命中辅助函数
- 地图图元渲染：`composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`
  - 负责草稿线/点渲染、Mars3D 图层同步、编辑态图元回写、拖拽释放兜底
  - 多级视觉反馈：光晕 + 轮廓 + 标签 + 徽章
  - 连接点渲染：四方向（上/右/下/左），仅在选中或悬停时显示
  - 悬停效果：节点 13px + 3px 边框，边 4px 宽度
- 思维导图交互：`composables/admin/useMindmapEditor.ts`
  - 节点创建：createNodeAt、createChildNode、createSiblingNode
  - 节点删除：deleteSelected
  - 边操作：createEdge、toggleEdgeCurve
  - 选中和悬停状态管理
- 事件处理：`composables/admin/useMindmapEditorEvents.ts`
  - 键盘快捷键：Tab、Enter、Delete、Ctrl+Z/Y、Ctrl+A、ESC
  - 鼠标交互：双击、单击、多选、拖拽
  - 悬停检测：50ms 防抖优化
- 工作区壳层状态：`composables/admin/usePipe2DEditorWorkspace.ts`
  - 负责工具栏拖拽放置、视图切换、项目标题、快捷键、画布皮肤与壳层 UI 状态
- 数据编排：`composables/admin/usePipe2DEditorData.ts`
  - `loadPipes()`
  - `loadInsights()`：并行拉 `drilldown / trace / telemetry / audit`
  - `saveGeometry()`：优先 Twin 写，失败回退 `geo-features.update()`
- 草稿管理：`composables/admin/usePipe2DEditorDrafts.ts`
  - 负责本地草稿恢复、`800ms` 防抖暂存、`8s` 周期暂存、服务端草稿状态文案
- 服务层：`services/twin.ts`
  - 读：`drilldown` / `trace` / `telemetryLatest` / `listAuditLogs`
  - 写：`updatePipeGeometry` / `updatePipeProperties`
- 当前已落地的编辑器持久化：
  - 几何保存
  - 名称重命名保存
  - 草稿本地恢复
  - 保存成功 toast
  - 审计日志回读
- 性能指标：
  - 100 节点场景：55-60 FPS
  - 防抖优化：50ms 悬停检测
  - 渲染优化：requestAnimationFrame 节流

### 工单运维联动（`pipeline-ops`）

- 页面组件：`components/admin/ops/PipelineOpsBoard.vue`
  - 支持 `inspection` / `maintenance` / `retrofit` / `retire` / `linkage` 五种模式
  - 包含筛选区、统计卡、Dashboard、建单表单、详情抽屉、执行日志、热水泵控制、异常巡检转维修
- 状态编排：`composables/admin/usePipelineOpsBoard.ts`
  - 列表、统计、Dashboard 共享同一套过滤条件
  - 使用 `refreshRequestId` 防止快速切换筛选时旧响应覆盖新状态
- 客户端服务：`services/pipeline-ops.ts`
  - 所有写操作都通过同源 Nuxt API `/api/pipeline-ops/*`
- Nuxt server 代理：
  - 路由：`frontend/server/api/pipeline-ops/*`
  - 代理封装：`frontend/server/utils/pipeline-ops-db.ts`
  - 作用：统一转发到 Spring Boot `/api/v1/pipeline-ops/*`，并按配置附加写鉴权

### 资产台账（Mock）

- `composables/useConstants.ts` 提供 mock：
  - `BUILDINGS` / `PIPELINES` / `WORK_ORDERS` / `MOCK_ALERTS` / `PRESSURE_DATA`
- `index.vue` 的 `handleSelection(...)` 会尝试将选中的 GeoJSON feature 匹配到 mock 资产（或兜底生成 Building）。

### AI 聊天（Gemini）

- UI：`components/ChatInterface.vue`
- 客户端：`composables/useGeminiChat.ts`
  - 请求 `POST /api/chat`
  - 读取 `ReadableStream`，解析 `data: {"text":"..."}` 的 SSE 分片
- 服务端：`server/api/chat.post.ts`
  - 使用 `@google/genai`
  - 需要 `GEMINI_API_KEY`

---

## 后端说明（Spring Boot + PostGIS）

### 数据库迁移（Flyway）

当前迁移清单（`backend/src/main/resources/db/migration`）：

- `V1__init_postgis_and_features.sql`：初始化 `geo_features` + PostGIS 扩展
- `V2__add_visibility_to_geo_features.sql`：新增 `visible` 字段与索引
- `V3__add_twin_topology_tables.sql`：`pipe_nodes / pipe_segments / asset_relations / telemetry_latest / edit_audit_log`
- `V4__seed_twin_topology_and_telemetry.sql`：基于 `roads` 回填初始拓扑关系与遥测样例
- `V5__add_twin_entity_tables.sql`：新增 `pipe_manholes / pipe_valves / pump_stations / building_floors / building_rooms`
- `V6__add_module2_telemetry_tables.sql`：新增模块2测点/阈值/实时/历史/告警表
- `V7__seed_extended_twin_topology_entities.sql`：补充扩展拓扑实体样例与全链路关系种子
- `V8__add_buildings_and_rooms_tables.sql`：补充楼栋/房间实体表
- `V9__seed_buildings_and_rooms_from_json.sql`：由种子数据初始化楼栋/房间
- `V10__add_pipeline_ops_tables.sql`：新增 `work_order / order_building_link / work_order_log / pump_control_log`

`backend/src/main/resources/db/migration/V1__init_postgis_and_features.sql`：

- 启用扩展：`postgis`
- 创建表：`geo_features`

字段：

- `id TEXT PRIMARY KEY`
- `layer TEXT NOT NULL`
- `geom geometry(GEOMETRY, 4326) NOT NULL`
- `properties JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

并包含索引与 `updated_at` 触发器。

### 后端 GeoJSON API 的实现方式

`GeoFeatureController` 使用 `JdbcTemplate` + Postgres JSONB 函数构造 GeoJSON：

- `jsonb_build_object` / `jsonb_agg`
- `ST_AsGeoJSON(geom)::jsonb` 将 geometry 输出为 GeoJSON

这样可以避免在 Java 侧大量拼装 GeoJSON，提高查询与序列化效率。

### `pipeline-ops` 后端

- 控制器：`backend/src/main/java/com/jolt/workflow/pipelineops/PipelineOpsController.java`
  - 提供 `workorders / workorder / stats / dashboard / auto-create / action`
- 仓储：`backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`
  - 使用 `JdbcTemplate` 直连 SQL
  - 同时负责筛选构造、工单写入、执行日志、影响范围链路、泵控日志、Dashboard 聚合
  - 当前已补齐多项鲁棒性校验：
    - 日期/时间字段写入前先校验，避免数据库 cast 直接抛 500
    - `assign` 必须带 `assignee`
    - `convert_to_maintenance` 必须来源于异常巡检记录
    - `set_duration` 必须为正整数分钟
    - 无拓扑/无楼宇草稿不会自动绑定第一栋楼
    - 影响楼宇写入前会去重，避免唯一键冲突

---

## 数据准备：GeoJSON 拆分

`frontend/public/map/split_geojson.py` 用于将 `map_all.geojson` 按规则拆分为：

- `water.geojson`
- `green.geojson`
- `buildings.geojson`
- `roads.geojson`

分类规则（核心逻辑）：

- Point 类型直接跳过
- 水体：`properties.natural == 'water'` 或存在 `properties.water`
- 绿地：`natural == 'wood' | 'wetland'` 或 `landuse == 'cemetery'`
- 建筑：存在 `properties.building`
- 管道（源自道路）：存在 `properties.highway`

---

## 数据导入：GeoJSON -> PostGIS（buildings/pipes（存储层 roads）实操流程）

目标：将前端静态文件中的 **建筑/管道（API 语义 pipes，存储层 roads）** 导入到后端 PostGIS 表 `geo_features`，并通过后端 GeoJSON API 验证。

### 0) 启动数据库容器

```bash
docker compose up -d
```

默认数据库：`postgres/postgres@localhost:5432/unispace`

### 1) 初始化数据库表（Flyway 迁移）

推荐方式：启动后端一次，让 Flyway 自动执行全部迁移（V1~V7）。

如果你只想快速初始化基础表，也可以手动执行 V1：

```bash
docker exec -i unispace-postgis psql -U postgres -d unispace < backend/src/main/resources/db/migration/V1__init_postgis_and_features.sql
```

验证表存在：

```bash
docker exec -it unispace-postgis psql -U postgres -d unispace -c "\d geo_features"
```

### 2) 将 GeoJSON 拷贝进容器

```bash
docker cp frontend/public/map/roads.geojson unispace-postgis:/tmp/roads.geojson
docker cp frontend/public/map/buildings.geojson unispace-postgis:/tmp/buildings.geojson
```

### 3) 导入 pipes（存储层 roads）

```bash
docker exec -i unispace-postgis psql -U postgres -d unispace -c "
WITH gj AS (
  SELECT pg_read_file('/tmp/roads.geojson')::jsonb AS fc
),
feat AS (
  SELECT jsonb_array_elements(fc->'features') AS f
  FROM gj
)
INSERT INTO geo_features (id, layer, geom, properties)
SELECT
  COALESCE(NULLIF(f->>'id',''), md5((f->'geometry')::text || (f->'properties')::text)) AS id,
  'roads' AS layer,
  ST_SetSRID(ST_GeomFromGeoJSON((f->'geometry')::text), 4326) AS geom,
  COALESCE(f->'properties', '{}'::jsonb) AS properties
FROM feat
WHERE f ? 'geometry'
ON CONFLICT (id) DO UPDATE
SET layer = EXCLUDED.layer,
    geom = EXCLUDED.geom,
    properties = EXCLUDED.properties,
    updated_at = now();
"
```

### 4) 导入 buildings

```bash
docker exec -i unispace-postgis psql -U postgres -d unispace -c "
WITH gj AS (
  SELECT pg_read_file('/tmp/buildings.geojson')::jsonb AS fc
),
feat AS (
  SELECT jsonb_array_elements(fc->'features') AS f
  FROM gj
)
INSERT INTO geo_features (id, layer, geom, properties)
SELECT
  COALESCE(NULLIF(f->>'id',''), md5((f->'geometry')::text || (f->'properties')::text)) AS id,
  'buildings' AS layer,
  ST_SetSRID(ST_GeomFromGeoJSON((f->'geometry')::text), 4326) AS geom,
  COALESCE(f->'properties', '{}'::jsonb) AS properties
FROM feat
WHERE f ? 'geometry'
ON CONFLICT (id) DO UPDATE
SET layer = EXCLUDED.layer,
    geom = EXCLUDED.geom,
    properties = EXCLUDED.properties,
    updated_at = now();
"
```

### 5) 验证导入结果

```bash
docker exec -i unispace-postgis psql -U postgres -d unispace -c "select layer, count(*) from geo_features where layer in ('buildings','roads') group by layer order by layer;"
```

### 6) 验证后端 API

后端启动后：

```bash
curl "http://localhost:8080/api/v1/features?layers=buildings,pipes&limit=5" | head -c 400
```

---

## API 列表（后端）

> 路径前缀：`/api/v1`
>
> 安全策略：`GET /api/**` 公开；`POST/PUT/PATCH/DELETE /api/**` 需要 HTTP Basic（`APP_ADMIN_USER` / `APP_ADMIN_PASSWORD`）。前端写操作默认通过 Nuxt server 路由代理，并复用 `BACKEND_*` 写鉴权配置。

### `GET /api/v1/features`

Query 参数：

- `bbox`（可选）：`minLon,minLat,maxLon,maxLat`（EPSG:4326）
- `layers`（可选）：逗号分隔图层名（`pipes` 会在后端自动映射到 `roads` 存储层）
- `limit`（可选，默认 `2000`）
- `page`（可选）：分页页码（从 `1` 开始）
- `offset`（可选）：偏移量；若同时传 `page` 与 `offset`，优先 `offset`
- `visible`（可选）：`true | false`（后端会按 `geo_features.visible` 过滤；返回的 `properties` 也会附加 `visible` 字段）

返回：GeoJSON `FeatureCollection`。

示例：

```bash
curl -s "http://localhost:8080/api/v1/features?layers=pipes&limit=10" | cat
```

### `GET /api/v1/features/{id}`

返回：单个 GeoJSON `Feature`。

### `POST /api/v1/features`

用途：新增建筑/管道要素。

鉴权：需要 HTTP Basic（示例：`-u "$APP_ADMIN_USER:$APP_ADMIN_PASSWORD"`）。

Body（示例）：

```json
{
  "id": "pipe_001",
  "layer": "pipes",
  "visible": true,
  "geometry": { "type": "LineString", "coordinates": [[119.1, 26.0], [119.2, 26.1]] },
  "properties": { "name": "新管道", "highway": "service" }
}
```

返回：`{"ok":true,"id":"..."}`（201，或 400/409）。

### `PUT /api/v1/features`

用途：更新要素（按 `id` 全量更新 `layer/geometry/properties/visible`）。

鉴权：需要 HTTP Basic。

返回：`{"ok":true,"id":"..."}`（或 400/404）。

### `DELETE /api/v1/features?id=...`

用途：按 `id` 删除要素。

鉴权：需要 HTTP Basic。

返回：`{"ok":true,"id":"..."}`（或 400/404）。

### `PUT /api/v1/features/visibility`

用途：按请求体中的 `id` 更新要素可见性（后台大厅的开关会调用该接口）。

鉴权：需要 HTTP Basic。

Body：

```json
{"id":"...","visible":true}
```

返回：`{"ok":true}`（或 400/404）。

### `PUT /api/v1/features/{id}/visibility`（兼容接口）

用途：按路径 `id` 更新可见性。

鉴权：需要 HTTP Basic。

Body：

```json
{"visible":true}
```

返回：`{"ok":true}`（或 400/404）。

### `GET /api/v1/twin/drilldown/{id}`

返回字段除 `feature/segment/nodes/relations/linkedBuildings` 外，新增：

- `impactedRooms`
- `valves`
- `equipments`

用于主地图点击管段后的真实穿透展示。

### `GET /api/v1/twin/trace?startId=...&direction=up|down`

用途：按上下游方向追踪拓扑路径，返回 `pathSegmentIds / pathFeatureIds / nodeIds / linkedBuildings`。

### `GET /api/v1/twin/telemetry/latest?featureIds=...`

用途：按管段或 featureId 查询最新测点数据。

### `GET /api/v1/twin/audit/{featureId}?limit=...`

用途：读取该管段最近编辑审计记录。

### `PUT /api/v1/twin/pipes/{id}/geometry`

用途：写回管道几何，并同步 Twin 拓扑审计链路。

### `PUT /api/v1/twin/pipes/{id}/properties`

用途：写回管道属性，例如名称、显示状态等。

### `GET /api/v1/pipeline-ops/workorders`

用途：列表查询工单。支持参数：

- `type`
- `status`
- `area`
- `pipelineMedium`
- `nodeId`
- `segmentId`
- `buildingId`
- `assignee`
- `createdFrom`
- `createdTo`
- `q`
- `page`
- `limit`

### `GET /api/v1/pipeline-ops/workorder?id=...`

用途：查询单个工单详情。

### `GET /api/v1/pipeline-ops/stats`

用途：按当前过滤条件返回各状态计数。

### `GET /api/v1/pipeline-ops/dashboard`

用途：按当前过滤条件返回效率、楼宇影响 Top10、趋势等看板数据。

### `POST /api/v1/pipeline-ops/workorders`

用途：创建或更新工单草稿。

### `PATCH /api/v1/pipeline-ops/workorders`

用途：流转工单状态，如 `submit / assign / start / pause / to_review / approve / close / reject / reopen`。

### `POST /api/v1/pipeline-ops/auto-create`

用途：由 `telemetry_alert / anomaly_alert / kg_inference` 自动建单。

### `POST /api/v1/pipeline-ops/action`

用途：执行扩展动作：

- `add_log`
- `adjust_impact`
- `pump_control`
- `add_inspection_record`
- `convert_to_maintenance`

### `POST /api/v1/module2/telemetry/ingest`

用途：写入模块2测点数据（实时+历史），并按阈值自动产生告警。

示例：

```json
{
  "pointId": "pt_pipe_001_pressure",
  "featureId": "way/25598484",
  "metric": "pressure",
  "value": 2.45,
  "unit": "bar",
  "sampledAt": "2026-02-21T06:20:00Z"
}
```

### `PUT /api/v1/module2/telemetry/thresholds`

用途：设置或更新测点阈值规则（`warn/alarm` 上下限）。

### `GET /api/v1/module2/telemetry/latest`

用途：查询模块2实时测点数据（支持 `pointIds`、`metric`、`limit`）。

### `GET /api/v1/module2/telemetry/history`

用途：查询模块2历史测点数据（支持 `pointId`、`metric`、`from`、`to`、`limit`）。

## 性能基线脚本

```bash
./scripts/perf-baseline.sh
```

可选环境变量：

- `BACKEND_URL`（默认 `http://localhost:8080`）
- `FRONTEND_URL`（默认 `http://localhost:3000`）
- `BBOX`（默认 `119.1500,26.0000,119.2500,26.0800`）
- `PAGE_SIZE`（默认 `800`）
- `MAX_PAGES`（默认 `5`）
- `FPS_CURRENT`（可选，手工填入真实 FPS；不填则脚本给出估算值）

脚本会在 `reports/` 下生成可复现的基线报告（首屏加载、实体数量、FPS Current/Target）。

---

## 常见问题

### 1) 后端启动提示 8080 端口占用

临时换端口：

```bash
cd backend
./gradlew bootRun --args='--server.port=8081'
```

### 2) AI 聊天接口报错（未设置 `GEMINI_API_KEY`）

```bash
export GEMINI_API_KEY=YOUR_KEY
```

### 3) 地图数据量大导致前端卡顿

当前实现已支持按视口 `bbox` + `page/offset` 增量加载。若仍卡顿，建议：

- 缩小单次分页大小（`limit`）
- 降低前端分页拉取页数上限
- 使用 `scripts/perf-baseline.sh` 定期生成性能基线报告

### 4) 前端报错 `#internal/nuxt/paths` 未定义

已在 `frontend/scripts/ensure-nuxt-internal.mjs` 做兼容修复，并接入 `dev/build/postinstall` 生命周期。
如果仍报错，先清理并重建 Nuxt 产物：

```bash
cd frontend
rm -rf .nuxt
npm run dev
```

### 5) `pipeline-ops` 写请求返回 401/403

检查以下配置是否一致：

- 后端：`APP_SECURITY_WRITE_AUTH_ENABLED`
- 前端：`BACKEND_WRITE_AUTH_ENABLED`
- 写鉴权账号：`BACKEND_ADMIN_USER` / `BACKEND_ADMIN_PASSWORD`

如果是本地无鉴权环境，可以显式设置：

```bash
export BACKEND_WRITE_AUTH_ENABLED=false
export APP_SECURITY_WRITE_AUTH_ENABLED=false
```

---

## Git 工作流（推荐）

本仓库推荐使用以 `develop` 为主干的 **GitHub Flow**（功能分支 + PR + Squash 合并），原则是：**不要在 `develop`/`main` 上直接改代码**。

### 1) 开发前同步（确保本地最新）

```bash
git checkout develop
git pull origin develop
```

### 2) 为每个任务创建分支（任务隔离）

```bash
git checkout -b feature/your-feature-name
```

分支命名建议：

- **feature**：`feature/...`
- **bugfix**：`fix/...`
- **文档**：`docs/...`

### 3) 迭代开发与提交（小步提交）

```bash
git status
git add .
git commit -m "feat: your message"
```

提交信息建议前缀：`feat`、`fix`、`docs`、`style`。

### 4) 推送前先同步 develop（减少冲突）

```bash
git pull origin develop
# 有冲突则解决后再 commit
git push -u origin feature/your-feature-name
```

### 5) 发起 PR 并合并

- **发起 PR**：在 GitHub 上对你的分支点击 *Compare & pull request*
- **评审**：多人协作时走 Code Review
- **合并策略**：建议使用 **Squash and merge** 保持提交历史整洁

### 6) 合并后清理分支

```bash
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
git fetch -p
```

### 7) 常用命令速查

- **查看状态**：`git status`
- **查看提交图**：`git log --oneline --graph`
- **查看分支**：`git branch -a`
- **查看 diff**：`git diff`

## 下一步建议

- **主地图详情面板去 mock**：继续替换 `useConstants.ts` 中仍保留的演示数据，统一走后端真实查询。
- **房产绑定闭环**：把二维编辑器中的“绑定房产/批注/图层过滤”从占位提示接成真实业务写入。
- **实时协同**：为 `pipeline-ops` 与二维编辑器补 WebSocket 推送，解决多人同时编辑时的状态同步。
- **权限与审计**：把当前 Basic 写鉴权升级为角色化权限，并接统一审计视图。
