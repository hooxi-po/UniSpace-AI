# UniSpace-AI

基于 GIS / 数字孪生的校园地下管网运维系统。

- 前端：Nuxt 3（Vue 3）+ Cesium（3D 地图）+ TailwindCSS + AI 助手（Gemini，SSE 流式输出）
- 后端：Spring Boot 4 + PostgreSQL/PostGIS + Flyway（空间要素表 `geo_features`）

> 当前版本说明：主地图中的“管道”已切换为后端动态数据：前端请求 `GET /api/v1/features?layers=pipes`，并在前端按管道分类规则（源自道路 `highway`）映射为 `water/drain/sewage` 三类（统一线宽 `5`）。后端对 `pipes` 做了别名兼容（映射到数据库 `geo_features.layer='roads'`）。后台大厅（`/admin`）资产中心同步使用 `buildings/pipes`，支持 `visible` 开关与要素 CRUD（新增/编辑/删除）。

---

## 目录

- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量与配置](#环境变量与配置)
- [前端说明（Nuxt + Cesium）](#前端说明-nuxt--cesium)
- [后端说明（Spring Boot + PostGIS）](#后端说明-spring-boot--postgis)
- [数据准备：GeoJSON 拆分](#数据准备-geojson-拆分)
- [数据导入：GeoJSON -> PostGIS（buildings/pipes（存储层 roads）实操流程）](#数据导入-geojson---postgisbuildingspipes存储层-roads实操流程)
- [API 列表（后端）](#api-列表后端)
- [常见问题](#常见问题)
- [Git 工作流（推荐）](#git-工作流推荐)
- [下一步建议](#下一步建议)

---

## 项目结构

```
UniSpace-AI/
├── start.sh                    # 一键启动（前端 + 后端）
├── docker-compose.yml          # PostGIS（PostgreSQL 16 + PostGIS 3.4）
├── backend/                    # Spring Boot 后端
│   ├── build.gradle.kts
│   ├── src/main/java/com/jolt/workflow/
│   │   ├── WorkflowApplication.java
│   │   ├── HelloController.java
│   │   ├── config/CorsConfig.java
│   │   └── geo/
│   │       ├── GeoFeatureController.java
│   │       └── GeoFeatureRow.java
│   └── src/main/resources/
│       ├── application.properties
│       └── db/migration/
│           └── V1__init_postgis_and_features.sql
└── frontend/                   # Nuxt 3 前端
    ├── nuxt.config.ts
    ├── pages/
    │   ├── index.vue           # 主页面（Map + UI Overlay）
    │   └── admin.vue           # 后台大厅（资产中心：buildings/pipes）
    ├── components/
    │   ├── MapView.vue         # Cesium Viewer + 图层加载/拾取（管道逻辑已抽离）
    │   ├── MapControls.vue     # 底部图层切换
    │   ├── LayerToggle.vue
    │   ├── TopNav.vue
    │   ├── SidebarLeft.vue
    │   ├── RightSidebar.vue
    │   └── ChatInterface.vue   # AI 聊天浮窗
    ├── composables/
    │   ├── shared/
    │   │   └── usePipeLayerLoader.ts  # 管道图层加载/分类/样式复用逻辑
    │   ├── useConstants.ts             # Mock 资产/告警/工单数据
    │   └── useGeminiChat.ts            # 与 /api/chat 的 SSE 流式交互
    ├── server/api/
    │   └── chat.post.ts        # Gemini API 代理（SSE）
    ├── scripts/
    │   └── ensure-nuxt-internal.mjs   # 修复 #internal/nuxt/paths 运行时报错
    └── public/map/
        ├── map_all.geojson
        ├── water.geojson
        ├── green.geojson
        ├── buildings.geojson
        ├── roads.geojson
        └── split_geojson.py    # GeoJSON 拆分脚本
```

---

## 技术栈

### 前端

- Nuxt 3 / Vue 3
- Cesium
- TailwindCSS（全局样式/主地图仍使用）
- 后台大厅（`/admin`）：浅色字节后台风格（纯 CSS，组件化在 `frontend/components/admin/`）
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
- Password：`postgres`

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
```

---

## 环境变量与配置

### 后端（backend）

`backend/src/main/resources/application.properties` 中支持如下变量（均有默认值）：

- `DB_URL`（默认：`jdbc:postgresql://localhost:5432/unispace`）
- `DB_USER`（默认：`postgres`）
- `DB_PASSWORD`（默认：`postgres`）

### 前端（frontend）

`frontend/nuxt.config.ts` 中：

- `GEMINI_API_KEY`：Nuxt server 侧读取的 Gemini API Key（**必需**，否则 `/api/chat` 会 500）

示例：

```bash
export GEMINI_API_KEY=YOUR_KEY
```

---

## 前端说明（Nuxt + Cesium）

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
    - 资产中心：从后端 GeoJSON API 拉取真实数据（`GET http://localhost:8080/api/v1/features?layers=buildings|pipes`），并支持搜索、可见性切换、要素 CRUD（新增/编辑/删除）
    - 组件化：表格/弹窗/操作已拆分为 `components/admin/GeoFeatureTable.vue`、`components/admin/AssetFeatureDialog.vue`、`components/admin/AssetDeleteDialog.vue`、`components/admin/AssetRowActions.vue`、`components/admin/AssetVisibilitySwitch.vue`
    - 资产 CRUD 逻辑收敛到 `composables/admin/useAssetCrud.ts`，请求封装在 `services/geo-features.ts`
    - 编辑体验：支持「表单模式（默认）」+「高级 JSON」双模式
    - `useConstants.ts` 中的资产/告警/工单仍为 mock（主地图与右侧详情面板仍会用到）

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

返回：`{"ok":true,"id":"..."}`（或 400/404）。

### `DELETE /api/v1/features?id=...`

用途：按 `id` 删除要素。

返回：`{"ok":true,"id":"..."}`（或 400/404）。

### `PUT /api/v1/features/visibility`

用途：按请求体中的 `id` 更新要素可见性（后台大厅的开关会调用该接口）。

Body：

```json
{"id":"...","visible":true}
```

返回：`{"ok":true}`（或 400/404）。

### `PUT /api/v1/features/{id}/visibility`（兼容接口）

用途：按路径 `id` 更新可见性。

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

- **数据统一**：将 `frontend/public/map/*.geojson` 导入 `geo_features`，前端切换为从 `/api/v1/features` 加载。
- **接口鲁棒性**：让 `/api/v1/features` 在无数据时也返回合法 FeatureCollection（而不是 500）。
- **台账/告警/工单接口化**：逐步替换 `useConstants.ts` 的 mock 数据为后端真实数据。
- **房产管理模块**：`/admin` 下的“房产管理”目前为 mock，可对接真实业务数据与权限体系。
