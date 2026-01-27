# UniSpace-AI

基于 GIS / 数字孪生的校园地下管网运维系统。

- 前端：Nuxt 3（Vue 3）+ Cesium（3D 地图）+ TailwindCSS + AI 助手（Gemini，SSE 流式输出）
- 后端：Spring Boot 4 + PostgreSQL/PostGIS + Flyway（空间要素表 `geo_features`）

> 当前版本说明：前端地图默认加载 **`frontend/public/map/*.geojson` 静态文件**；后端已经具备 PostGIS 表结构与 GeoJSON API（`/api/v1/features`），但前端尚未切换为按 `bbox/layers` 从后端拉取。

---

## 目录

- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量与配置](#环境变量与配置)
- [前端说明（Nuxt + Cesium）](#前端说明-nuxt--cesium)
- [后端说明（Spring Boot + PostGIS）](#后端说明-spring-boot--postgis)
- [数据准备：GeoJSON 拆分](#数据准备-geojson-拆分)
- [数据导入：GeoJSON -> PostGIS（建议流程）](#数据导入-geojson---postgis建议流程)
- [API 列表（后端）](#api-列表后端)
- [常见问题](#常见问题)
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
    │   └── admin.vue           # 后台大厅（GeoJSON/Mock 数据中心）
    ├── components/
    │   ├── MapView.vue         # Cesium Viewer + GeoJSON 图层加载/拾取
    │   ├── MapControls.vue     # 底部图层切换
    │   ├── LayerToggle.vue
    │   ├── TopNav.vue
    │   ├── SidebarLeft.vue
    │   ├── RightSidebar.vue
    │   └── ChatInterface.vue   # AI 聊天浮窗
    ├── composables/
    │   ├── useConstants.ts     # Mock 资产/告警/工单数据
    │   └── useGeminiChat.ts    # 与 /api/chat 的 SSE 流式交互
    ├── server/api/
    │   └── chat.post.ts        # Gemini API 代理（SSE）
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
- TailwindCSS
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
npm install
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
    - `layers`：图层开关（water/green/buildings/roads 等）
  - 将状态通过 props 传给 `MapView`、`MapControls`、`RightSidebar` 等组件。

- `pages/admin.vue`
  - 后台大厅/数据中心：
    - 读取 `/public/map/*.geojson`，统计 features 数量、几何类型分布、bbox、属性 key 频次等
    - 提供 GeoJSON 预览与 JSON 详情抽屉（可复制）
    - 展示 Mock 资产、告警、工单（来自 `useConstants.ts`）

### 地图核心（`components/MapView.vue`）

- 使用 `Cesium.Viewer` 初始化场景，采用深色底图（Carto dark）
- 为每个图层维护一个 `Cesium.CustomDataSource`：
  - `water` / `green` / `buildings` / `roads`（以及预留的 `sewage`/`drain`）
- 图层数据加载：
  - 使用 `Cesium.GeoJsonDataSource.load('/map/*.geojson')`
  - 加载后会移除默认 label/billboard/point，并按图层应用不同风格
- 图层显隐：
  - 通过 `dataSource.show = props.layers.xxx` 控制
- 拾取：
  - `ScreenSpaceEventHandler` + `viewer.scene.pick`，拾取到 entity 后 emit `select` 给父组件

### 图层与样式

当前前端使用“未来主义/赛博朋克”风格：

- 水体（polygon）深蓝填充 + 边缘线
- 绿地（polygon）深绿填充
- 建筑（polygon）半透明浅蓝 + outline + extrusion（固定 extrudedHeight）
- 道路（polyline）浅蓝发光 `PolylineGlowMaterialProperty`

> 注：目前 `MapControls.vue` UI 展示了“供水/污水/雨水/绿地/建筑”，但 `MapView.vue` 实际加载的静态 GeoJSON 图层是 `water/green/buildings/roads`。`sewage/drain` 在 `MapView.vue` 中存在数据源占位，但当前未加载对应 GeoJSON 文件。

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
- 道路：存在 `properties.highway`

---

## 数据导入：GeoJSON -> PostGIS（buildings/roads 实操流程）

目标：将前端静态文件中的 **建筑/道路** 导入到后端 PostGIS 表 `geo_features`，并通过后端 GeoJSON API 验证。

### 0) 启动数据库容器

```bash
docker compose up -d
```

默认数据库：`postgres/postgres@localhost:5432/unispace`

### 1) 初始化数据库表（Flyway 迁移）

如果你还没启动过后端导致迁移未自动执行，可以手动执行仓库内迁移 SQL：

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

### 3) 导入 roads

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
curl "http://localhost:8080/api/v1/features?layers=buildings,roads&limit=5" | head -c 400
```

---

## API 列表（后端）

> 路径前缀：`/api/v1`

### `GET /api/v1/features`

Query 参数：

- `bbox`（可选）：`minLon,minLat,maxLon,maxLat`（EPSG:4326）
- `layers`（可选）：逗号分隔图层名（对应 `geo_features.layer`）
- `limit`（可选，默认 `2000`）

返回：GeoJSON `FeatureCollection`。

示例：

```bash
curl -s "http://localhost:8080/api/v1/features?layers=water&limit=10" | cat
```

### `GET /api/v1/features/{id}`

返回：单个 GeoJSON `Feature`。

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

### 3) GeoJSON 很大导致前端卡顿

当前是静态一次性加载。后续建议：

- 后端按 `bbox` 分页/裁剪返回
- 前端按视口动态加载（camera changed -> 请求 bbox）

---

## 下一步建议

- **数据统一**：将 `frontend/public/map/*.geojson` 导入 `geo_features`，前端切换为从 `/api/v1/features` 加载。
- **接口鲁棒性**：让 `/api/v1/features` 在无数据时也返回合法 FeatureCollection（而不是 500）。
- **台账/告警/工单接口化**：逐步替换 `useConstants.ts` 的 mock 数据为后端真实数据。
