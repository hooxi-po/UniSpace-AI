# agent.md — UniSpace-AI 项目智能体快速理解文档

本文档面向“后续智能体/自动化助手”，目标是在**不依赖人类口头背景**的前提下，让新智能体快速掌握本仓库的：

- 项目目标与约束
- 运行方式与环境变量
- 前后端目录结构与**逐文件职责**
- 核心数据流（地图/图层/拾取/AI 聊天/后端 GeoJSON API）
- 数据库结构（PostGIS）与迁移
- 已知坑/历史修复点
- 可扩展点与下一步改造建议

> 本文档依据当前仓库代码生成（截至本文写入时），不应包含任何未在代码中出现的文件或功能。

---

## 1. 仓库概览

- 仓库根目录：`UniSpace-AI/`
- 架构：前后端分离 + 本地/容器化数据库

### 1.1 核心模块

- **frontend**：Nuxt 3 + Cesium 地图可视化 + Tailwind UI + Gemini AI（通过 Nuxt server route 代理）
- **backend**：Spring Boot 4 + Postgres/PostGIS + Flyway。提供 `geo_features` 空间要素表与 GeoJSON API。
- **docker-compose.yml**：提供 PostGIS 数据库容器（Postgres 16 + PostGIS 3.4）。
- **start.sh**：一键并行启动前后端（注意端口冲突与依赖安装）。

### 1.2 当前数据现状（非常关键）

- **前端地图为静态 GeoJSON 数据源**：
  - `water/green/buildings/roads`：均从 `frontend/public/map/*.geojson` 静态文件加载（见 `frontend/components/MapView.vue`）
  - 后端 GeoJSON API 目前主要由后台大厅（`/admin`）消费，用于资产中心的 `buildings/roads` 展示与 `visible` 开关
- **后端 API** 已实现：
  - `GET /api/v1/features`（支持 `bbox`、`layers`、`limit`、`visible` 过滤）
  - `GET /api/v1/features/{id}`
  - `PUT /api/v1/features/visibility` 与 `PUT /api/v1/features/{id}/visibility`（用于后台大厅的可见性开关）
- 前端后台大厅（`/admin`）包含两大模块：
  - **资产中心**：接入后端 GeoJSON API（`buildings/roads`），支持搜索、查看原始 Feature JSON，并可在表格中直接切换 `visible`（写入后端 `geo_features.visible`）。
  - **房产管理**：当前为 mock/本地数据与前端页面（包含分配、公寓、收费、经营、报表、维修等子模块），未对接真实后端。
- 前端主地图的“资产台账/告警/工单/压力数据”目前为 **mock 常量**：`frontend/composables/useConstants.ts`

---

## 2. Git 工作流（协作规范）

本仓库推荐使用以 `develop` 为主干的 **GitHub Flow**（功能分支 + PR + Squash 合并）。核心原则：**不要在 `develop`/`main` 上直接改代码**。

### 2.1 开发前同步

```bash
git checkout develop
git pull origin develop
```

### 2.2 创建任务分支

```bash
git checkout -b feature/your-feature-name
```

分支命名建议：

- **功能**：`feature/...`
- **修复**：`fix/...`
- **文档**：`docs/...`

### 2.3 小步提交（一个 commit 做一件事）

```bash
git status
git add .
git commit -m "feat: your message"
```

### 2.4 推送前先同步 develop（处理冲突）

```bash
git pull origin develop
# 如有冲突：解决后再 commit
git push -u origin feature/your-feature-name
```

### 2.5 PR 与合并策略

- **发起 PR**：GitHub 上 *Compare & pull request*
- **评审**：多人协作时走 Code Review
- **合并策略**：建议 **Squash and merge** 保持提交历史整洁

### 2.6 合并后清理

```bash
git checkout develop
git pull origin develop
git branch -d feature/your-feature-name
git fetch -p
```

### 2.7 常用命令速查

- `git status`
- `git log --oneline --graph`
- `git branch -a`
- `git diff`

## 3. 启动方式与端口

### 2.1 一键启动（推荐）

脚本：`start.sh`

- 后端：`backend/` 下执行 `./gradlew bootRun`
- 前端：`frontend/` 下执行 `npm ci`（有 lock）或 `npm install`，然后 `npm run dev`

默认端口：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8080`

### 2.2 数据库启动（可选但建议）

文件：`docker-compose.yml`

- 服务：`postgis`
- 镜像：`postgis/postgis:16-3.4`
- 端口映射：`5432:5432`
- 默认库：`unispace`，用户/密码：`postgres/postgres`

命令：

```bash
docker compose up -d
```

### 2.3 常见启动问题

- **8080 被占用**：后端会启动失败（Tomcat 报 “Port 8080 already in use”）。
  - 临时方案：`./gradlew bootRun --args='--server.port=8081'`
  - 或停止占用 8080 的进程。

---

## 3. 环境变量与配置

### 3.1 后端数据库连接（backend）

配置文件：`backend/src/main/resources/application.properties`

- `spring.datasource.url=${DB_URL:jdbc:postgresql://localhost:5432/unispace}`
- `spring.datasource.username=${DB_USER:postgres}`
- `spring.datasource.password=${DB_PASSWORD:postgres}`

因此后端支持环境变量：

- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`

### 3.2 前端 AI（Gemini）

配置文件：`frontend/nuxt.config.ts`

- 运行时配置：`runtimeConfig.geminiApiKey = process.env.GEMINI_API_KEY || ''`

因此需要：

- `GEMINI_API_KEY`（Nuxt server 侧读取；未设置会导致 `/api/chat` 抛 500）

---

## 4. 目录与逐文件职责（按模块）

下面按目录逐文件说明“这个文件负责什么”、“被谁调用”、“关键数据结构”。

> 说明：以下列表仅覆盖仓库内可见源代码文件；忽略 `build/`、`node_modules/` 等构建产物。

---

# 4A. Root 目录

## `start.sh`

- 目的：一键启动前端与后端。
- 行为：
  - 检查 `java`、`node` 是否存在。
  - 后端：`cd backend && ./gradlew bootRun`（前台启动在子进程中）
  - 前端：`cd frontend && npm ci || npm install && npm run dev`
  - `trap cleanup EXIT INT TERM`：退出时 kill 两个子进程。
- 关键点：
  - `set -euo pipefail`：变量未定义会直接失败。
  - 依赖安装可能比较慢；CI/开发机可考虑用缓存。

## `docker-compose.yml`

- 目的：提供本地 PostGIS 数据库。
- 默认：
  - DB：`unispace`
  - User/Pass：`postgres/postgres`
  - volume：`unispace_postgis_data`

## `README.md`

- 根 README（已更新）：面向开发者的快速开始与模块说明。

---

# 4B. Backend（Spring Boot）

## 4B.1 构建与依赖

### `backend/build.gradle.kts`

- Spring Boot 版本：`4.0.1`
- Java toolchain：21
- 关键依赖：
  - `spring-boot-starter-web`
  - `spring-boot-starter-json`
  - `spring-boot-starter-data-jpa`
  - `spring-boot-starter-jdbc`
  - `flyway-core`
  - `hibernate-spatial`
  - `postgresql`（runtimeOnly）

> 重要历史：
> - 项目曾因缺少 `hibernate-spatial` 导致 `PostgisDialect` 类无法加载；已通过添加 `hibernate-spatial` 修复。
> - Spring Boot 4 使用 `tools.jackson.*`，而非传统 `com.fasterxml.jackson.*`。若代码注入 `com.fasterxml.jackson.databind.ObjectMapper` 会找不到 bean。

### `backend/settings.gradle.kts`

- `rootProject.name = "workflow"`

## 4B.2 配置

### `backend/src/main/resources/application.properties`

- 设置应用名、数据源、JPA、Flyway。
- JPA：`ddl-auto=validate`（要求表已存在；不会自动建表）
- Flyway：`enabled=true`，迁移位置：`classpath:db/migration`

## 4B.3 数据库迁移

### `backend/src/main/resources/db/migration/V1__init_postgis_and_features.sql`

- `CREATE EXTENSION IF NOT EXISTS postgis;`
- 创建表 `geo_features`：
  - `id TEXT PRIMARY KEY`
  - `layer TEXT NOT NULL`
  - `geom geometry(GEOMETRY, 4326) NOT NULL`
  - `properties JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `created_at`/`updated_at`
- 索引：
  - `geo_features_layer_idx`（layer）
  - `geo_features_geom_gist`（geom GIST）
  - `geo_features_properties_gin`（properties GIN）
- 更新触发器：`set_updated_at()` + trigger `trg_geo_features_updated_at`

## 4B.4 源码入口与 Controller

### `backend/src/main/java/com/jolt/workflow/WorkflowApplication.java`

- Spring Boot 启动入口：`@SpringBootApplication`

### `backend/src/main/java/com/jolt/workflow/HelloController.java`

- 简单演示接口：`GET /api/v1/hello`
- 返回：`{"message":"Hello, world!"}`

### `backend/src/main/java/com/jolt/workflow/config/CorsConfig.java`

- 对 `/api/**` 开放 CORS：
  - `allowedOriginPatterns("*")`
  - `allowedMethods(GET,POST,PUT,PATCH,DELETE,OPTIONS)`
  - `allowedHeaders("*")`
  - `allowCredentials(false)`

> 用于前端跨域调用后端 API。

### `backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`

- Base path：`/api/v1`

#### `GET /api/v1/features`

参数：

- `bbox`（可选）：`minLon,minLat,maxLon,maxLat`（EPSG:4326）
- `layers`（可选）：逗号分隔 layer 列表
- `limit`（可选，默认 2000）

实现要点：

- 使用 `JdbcTemplate` 直接查询 `geo_features` 表。
- SQL 使用 Postgres JSONB 组合 GeoJSON：
  - `jsonb_build_object('type','FeatureCollection', 'features', jsonb_agg(...))`
  - 每个 feature：`id`、`properties`、`ST_AsGeoJSON(geom)::jsonb`
- bbox 过滤：`geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)`（使用 bbox 的矩形 envelope 与 bbox 运算符 &&）
- layer 过滤：拼接 `layer IN (?, ?, ...)`。
- 返回类型：`tools.jackson.databind.JsonNode`，通过 `tools.jackson.databind.ObjectMapper.readTree(json)` 解析。

> 已知风险：
> - `jdbcTemplate.queryForObject(sql, params, String.class)` 若返回 `null`（无行）会导致后续 `readTree(null)` 抛异常。
> - SQL/参数个数匹配需要特别留意（尤其是 `LIMIT ?` 参数）。
> - 当前 controller 返回 500 的可能原因通常在这里（表空、SQL 错误、参数错、返回 null）。

#### `GET /api/v1/features/{id}`

- 查询单条 feature，返回 JSON。
- 若无数据：返回 `{"error":"not_found"}`（非 Spring 的 404，仍返回 200/JSON）。

#### `parseBbox`

- 解析 bbox 字符串，长度必须为 4，否则抛 `IllegalArgumentException`。

### `backend/src/main/java/com/jolt/workflow/geo/GeoFeatureRow.java`

- Java record：

```java
public record GeoFeatureRow(String id, String layer, String geomGeoJson, JsonNode properties) {}
```

- 注意：此处 `JsonNode` 仍为 `com.fasterxml.jackson.databind.JsonNode`（与 Spring Boot 4 的 `tools.jackson` 不一致）。
- 当前代码中该 record 并未被 controller 使用；如果未来使用该类型，需要统一 Jackson 体系，否则会出现类型/bean 不匹配。

## 4B.5 测试

### `backend/src/test/java/com/jolt/workflow/WorkflowApplicationTests.java`

- Spring Boot 默认生成的测试入口（未展开分析）。

---

# 4C. Frontend（Nuxt 3 + Cesium）

## 4C.1 构建与配置

### `frontend/package.json`

- Nuxt：`^3.15.3`
- Cesium：`^1.137.0`
- AI：`@google/genai`
- `vite-plugin-cesium`
- Tailwind：`@nuxtjs/tailwindcss`

### `frontend/nuxt.config.ts`

- modules：`@nuxtjs/tailwindcss`
- css：`~/assets/css/main.css` + `cesium/Build/Cesium/Widgets/widgets.css`
- runtimeConfig：
  - server：`geminiApiKey`（来自 `GEMINI_API_KEY`）
  - public：`appName`
- vite：`plugins: [cesium()]`

> 注意：仓库曾配置过 `vite.css.preprocessorOptions.scss`（注入 `~/assets/scss/variables.scss`），会导致开发机必须安装 `sass`/`sass-embedded`。目前已移除该配置，避免强制 SCSS 预处理依赖。

### `frontend/tailwind.config.js`

- Tailwind 配置（未展开阅读内容；若需要可补充）。

### `frontend/tsconfig.json`

- TS 配置（未展开阅读内容；若需要可补充）。

### `frontend/app.vue`

- 根组件：只渲染 `<NuxtPage />`
- 使用 `useHead` 设置 `lang=zh-CN`

## 4C.2 运行时数据模型

### `frontend/types.ts`

定义了前端业务类型：

- `PipeNode`：管网资产（含压力/流量/材质/管径/埋深/坐标等）
- `Building`：建筑资产（房间数/关键设备/能耗等）
- `WorkOrder`：工单
- `Alert`：告警
- `ChatMessage`：聊天消息（含 `isLoading`）
- `GeoJsonFeature`：地图拾取结果（`{id,type:'geojson',properties?}`）

### `frontend/composables/useConstants.ts`

提供 mock 数据：

- `BUILDINGS`（3 条）
- `PIPELINES`（3 条）
- `WORK_ORDERS`
- `MOCK_ALERTS`
- `PRESSURE_DATA`

这些数据被：

- `pages/index.vue`：用于将选中 GeoJSON 匹配到资产
- `components/SidebarLeft.vue`：用于压力/告警展示
- `components/RightSidebar.vue`：用于关联工单
- `pages/admin.vue`：用于后台大厅展示

## 4C.3 主页面与状态流

### `frontend/pages/index.vue`

- 顶层布局：Map 作为背景层 + UI overlay（TopNav/SidebarLeft/MapControls/RightSidebar/ChatInterface）
- 维护核心状态：
  - `selectedItem`：`PipeNode | Building | GeoJsonFeature | null`
  - `viewport`：`{x,y,scale}`（传给 MapView；MapView 也会回传 update）
  - `layers`：water/sewage/drain/buildings/green
  - `weatherMode`：切换 fog/lighting

#### `handleSelection`

- 接收 MapView emit 的选中对象。
- 若选中为 GeoJSON：
  - 若 `properties.building`：尝试匹配 `BUILDINGS`，否则动态生成 Building（注意 coordinates 目前填 0,0）
  - 若 `properties.highway`：尝试匹配 `PIPELINES`，否则 fallback 第一个 pipeline
  - 若都不匹配：保留 GeoJSON feature

> 该逻辑是“将地图 feature 映射为业务资产”的核心。

## 4C.4 地图核心

### `frontend/components/MapView.vue`

- 初始化 `Cesium.Viewer`，底图为 carto dark。
- 建立 `CustomDataSource`：water/green/buildings/roads + sewage/drain（占位）。
- 图层文件映射：
  - `water: /map/water.geojson`
  - `green: /map/green.geojson`
  - `buildings: /map/buildings.geojson`
  - `roads: /map/roads.geojson`
- 按需加载：
  - `loadedLayers: Set<string>` 防止重复加载
  - `loadLayer(layerName)` 使用 `Cesium.GeoJsonDataSource.load(url, { clampToGround: true })`
  - 加载后移除 `label/billboard/point`，并应用样式（water/green/buildings/roads）
  - 加载后将 entity 加入对应 `CustomDataSource`
- 卸载：`dataSource.entities.removeAll()` 并从 `loadedLayers` 移除

#### 拾取与选中

- `ScreenSpaceEventHandler` 监听 LEFT_CLICK
- `viewer.scene.pick(...)` 获取 entity
- 将 entity 的 `properties`（当前时间）取出并 emit `select`，类型为 `GeoJsonFeature`

#### 高亮

- watch `props.selectedId`：在所有 dataSources 中查找 entity
- 保存原样式并改为黄色材质/加粗

#### 视口同步

- 相机变化时（`viewer.camera.changed`）emit `update:viewport`（RAF 节流）
- watch `props.viewport`：flyTo（避免循环比较 eps）

#### Weather 模式

- watch `props.weatherMode`：控制 fog、lighting、imagery brightness/contrast 等

### `frontend/components/MapControls.vue`

- 底部图层切换 UI。
- 会 emit `toggle-layer` 事件，参数：`water|sewage|drain|green|buildings`

> 注意：MapView 实际加载的是 water/green/buildings/roads。
> UI 暴露 sewage/drain，但 MapView 并未加载对应 GeoJSON（仅有占位 dataSource）。

### `frontend/components/LayerToggle.vue`

- 通用的图层按钮。
- 支持图标模式（Eye/EyeOff）或彩色点。

## 4C.5 UI 面板

### `frontend/components/TopNav.vue`

- 顶部导航：标题 + 在线状态 + 当前时间
- 提供入口：`/admin`

### `frontend/components/SidebarLeft.vue`

- 左侧面板：系统状态卡片 + 压力图（占位）+ 事件日志（mock）
- `PressureChart` 当前为占位组件

### `frontend/components/RightSidebar.vue`

- 右侧资产详情面板（仅对 `PipeNode` 或 `Building` 显示）
- Tabs：基础台账 / 实时监测 / 运维工单
- 工单来自 `WORK_ORDERS`（mock）

### `frontend/components/TechPanel.vue`

- 通用玻璃拟态/科技风容器组件（标题 + 边框装饰）

### `frontend/components/PressureChart.vue`

- 占位实现（已移除 React 图表依赖）

### `frontend/components/InfoBox.vue`

- 已废弃组件（模板写死 `v-if=false`），备注被 RightSidebar 替代。

## 4C.6 后台大厅（资产中心 / 房产管理）

### `frontend/pages/admin.vue`

- 后台大厅（浅色字节后台风格），包含两大模块：
  - **资产中心**（`assets`）：对接后端 GeoJSON API，展示 `buildings/roads`，并支持 `visible` 开关。
  - **房产管理**（`property`）：当前为 mock/本地数据与前端页面，包含分配、公寓、收费、经营、库存、报表、维修等子模块（见 `frontend/views/admin/property`）。
- UI 采用左侧菜单布局：
  - `frontend/components/admin/AdminLayout.vue`
  - `frontend/components/admin/AdminSider.vue`

资产中心（`assets`）实现要点：
- 二级菜单：建筑数据（`layer=buildings`）、管道数据（`layer=roads`）
- 数据来源：`GET http://localhost:8080/api/v1/features?layers=buildings|roads&limit=...`
- 搜索：页面顶部搜索框，按 `searchKeys` 模糊匹配。
- 详情：点击行打开 JSON 抽屉，支持复制原始 Feature。
- `visible` 开关：调用 `PUT /api/v1/features/visibility` 写入后端。

### 相关组件（admin）

- `frontend/components/admin/GeoFeatureTable.vue`
  - 通用图层表格组件
  - 输入：`backendBaseUrl`、`layer`、`limit`、`columns`、`mapRow`、`search/searchKeys`
  - 行点击：`emit('select', rawFeature)`
  - 条数回传：`emit('count', n)`

- `frontend/components/admin/JsonDrawer.vue`
  - 通用 JSON 抽屉
  - 输入：`open`、`obj`、`metaLabel`
  - 内置复制 JSON

- `frontend/components/admin/PropertyTable.vue`
  - 房产管理模块的通用表格组件（当前使用本地 mock 数据）
  - 输入：`active`、`search`、`searchKeys`、`columns`
  - 行点击：`emit('select', row)`

### 房产管理页面（`frontend/views/admin/property`）

- 包含多级三级菜单与页面，用于房产全生命周期管理（目前均为 UI 框架，未对接后端）：
  - 分配（allocation）：调房、分析、审批、指派、记录
  - 公寓（apartments）：申请、分配、押金、房间、水电
  - 收费（charging）：账单、个人、记录、催缴
  - 经营（operating）：分析、合同、物业、租金
  - 库存（inventory）：统计、任务、差异
  - 报表（reports）：自定义、日志、上报
  - 维修（fixation）：申请、审核、项目、库存、日志、映射、房间功能、导入

### 配置与工具（admin）

- `frontend/config/admin-comp-map.ts`：三级菜单到组件的映射
- `frontend/config/admin-menu.ts`：菜单结构定义
- `frontend/utils/admin-tables.ts`：表格列定义与行映射函数
- `frontend/composables/useAdminDetail.ts`：详情抽屉状态管理

## 4C.7 AI 聊天

### `frontend/components/ChatInterface.vue`

- 浮窗 UI，消息列表 + 输入框
- 调用 `useGeminiChat().streamChatResponse` 获取流式输出

### `frontend/composables/useGeminiChat.ts`

- `POST /api/chat`
- 解析响应体 `ReadableStream`：按行拆分，读取 `data: ...` 片段，JSON parse 后拿 `text`

### `frontend/server/api/chat.post.ts`

- 使用 `@google/genai` 的 `GoogleGenAI`
- 模型：`gemini-3-flash-preview`
- 返回 SSE：`Content-Type: text/event-stream`
- 未配置 key：抛 500（`createError`）

> 注意：SYSTEM_INSTRUCTION 中提到的“查询数据库/知识图谱”是模拟语气，并未与后端数据库做真实对接。

## 4C.8 GeoJSON 数据文件

目录：`frontend/public/map/`

- `map_all.geojson`：原始数据合集
- `water.geojson`/`green.geojson`/`buildings.geojson`/`roads.geojson`：MapView 实际加载的拆分文件
- `split_geojson.py`：拆分脚本

### `frontend/public/map/split_geojson.py`

- 输入：`map_all.geojson`
- 输出：`{water,green,buildings,roads}.geojson`
- 分类规则：
  - Point 跳过
  - water：`natural=water` 或存在 `water`
  - green：`natural=wood/wetland` 或 `landuse=cemetery`
  - buildings：存在 `building`
  - roads：存在 `highway`

---

## 5. 数据流/请求流（端到端）

### 5.1 前端地图数据流（当前）

1. `pages/index.vue` 初始化 `layers` 默认全开
2. `MapView.vue` onMounted -> `loadGeoJsonLayers()`
3. `loadLayer('water')` 等 -> `GeoJsonDataSource.load('/map/water.geojson')`
4. entities 加入 `CustomDataSource('water')`
5. 用户点击 entity -> `scene.pick` -> emit `select(GeoJsonFeature)`
6. `index.vue` `handleSelection`：将 GeoJsonFeature 尝试映射为 Building/PipeNode（mock），展示到 `RightSidebar`

### 5.2 AI 聊天数据流

1. `ChatInterface.vue` 输入 -> `useGeminiChat.streamChatResponse`
2. `POST /api/chat`（Nuxt server）
3. `server/api/chat.post.ts` 调用 Gemini stream
4. SSE 分片写回 -> 前端按 `data:` 行解析 -> UI 实时追加

### 5.3 后端 GeoJSON API（当前）

1. `GET /api/v1/features?bbox=...&layers=...`
2. `GeoFeatureController` 构造 SQL -> `JdbcTemplate` 查询 `geo_features`
3. 数据库层用 JSONB + `ST_AsGeoJSON` 组合 FeatureCollection
4. Java 用 `tools.jackson ObjectMapper` parse 成 `JsonNode` 返回

> 前端后台大厅（`/admin`）已消费该 API（buildings/roads）；主地图仍默认加载静态 GeoJSON。

---

## 6. 已知坑与历史修复记录（对未来智能体很重要）

### 6.1 Spring Boot 4 的 Jackson 体系

- Spring Boot 4 使用 `tools.jackson.*`（Jackson 3）
- 若代码使用 `com.fasterxml.jackson.*` 进行依赖注入（如 `ObjectMapper`），会出现“找不到 bean”问题。
- 本仓库中：
  - `GeoFeatureController` 已使用 `tools.jackson.databind.ObjectMapper`
  - 但 `GeoFeatureRow` 仍引用 `com.fasterxml.jackson.databind.JsonNode`（潜在问题）

### 6.2 Hibernate Spatial/PostGIS Dialect

- 曾出现 `PostgisDialect` 类找不到的问题。
- 修复方式：添加 `implementation("org.hibernate.orm:hibernate-spatial")`
- 同时避免硬编码 dialect（使用 metadata 自动识别）。

### 6.3 /api/v1/features 返回 500 的可能原因

当数据库为空或 SQL 参数不匹配时，`GeoFeatureController` 可能抛异常：

- `queryForObject` 返回 `null` -> `objectMapper.readTree(null)` -> NPE/parse error
- SQL grammar/参数数不一致（特别是 LIMIT 与 params）

建议未来改造：

- 让无数据时返回：`{"type":"FeatureCollection","features":[]}`
- 对异常返回更明确的错误信息（或转换为 4xx/5xx）

### 6.4 端口占用

- 8080 被占用会导致后端启动失败。

---

## 7. 扩展点与改造建议（面向下一阶段）

### 7.1 GeoJSON -> PostGIS 导入（buildings/roads 实操记录）

当前前端依赖静态文件；后端提供 `geo_features` 作为目标表。

本仓库已验证的一套导入流程（适用于 `buildings.geojson` / `roads.geojson`）：

1. 初始化表结构（未启动过后端/Flyway 未执行时）：

```bash
docker exec -i unispace-postgis psql -U postgres -d unispace < backend/src/main/resources/db/migration/V1__init_postgis_and_features.sql
```

2. 将 GeoJSON 拷贝进数据库容器（避免 stdin 读取截断问题）：

```bash
docker cp frontend/public/map/roads.geojson unispace-postgis:/tmp/roads.geojson
docker cp frontend/public/map/buildings.geojson unispace-postgis:/tmp/buildings.geojson
```

3. 执行导入（示例：roads；buildings 同理仅替换文件与 layer）：

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

4. 验证导入结果：

```bash
docker exec -i unispace-postgis psql -U postgres -d unispace -c "select layer, count(*) from geo_features where layer in ('buildings','roads') group by layer order by layer;"
```

验证 API：

```bash
curl "http://localhost:8080/api/v1/features?layers=buildings,roads&limit=5" | head -c 400
```

导入策略要点：

- 每个文件对应一个 `layer`
- `id`：优先使用 GeoJSON feature 的 `id`；缺失时以 `md5(geometry+properties)` 生成稳定 id（便于重复导入/幂等）
- `properties`：直接存 JSONB
- `geom`：`ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)`

### 7.2 前端改为按 bbox 动态加载

- MapView 已有 camera changed hook 与 viewport 计算。
- 可用 viewport -> bbox（或直接用 `viewer.camera.computeViewRectangle`）来请求后端。
- 支持：
  - 按视口增量加载
  - 按图层加载（layers 参数）
  - limit 与分页

### 7.3 统一业务台账

- 当前 RightSidebar 展示依赖 mock 常量。
- 可逐步增加后端接口：building/pipe/workorder/alert，并让 AI system instruction 与真实数据对接。

### 7.4 AI 与业务数据对接

- 当前 AI 仅做语言模型对话（system prompt 中“数据库查询”是模拟）。
- 可扩展为：
  - 后端提供查询接口
  - Nuxt server route 调用后端并将结果注入 prompt 或工具调用

---

## 8. 文件清单（用于智能体快速索引）

### Root

- `start.sh`
- `docker-compose.yml`
- `README.md`
- `agent.md`（本文）

### Backend 源码

- `backend/build.gradle.kts`
- `backend/settings.gradle.kts`
- `backend/src/main/resources/application.properties`
- `backend/src/main/resources/db/migration/V1__init_postgis_and_features.sql`
- `backend/src/main/java/com/jolt/workflow/WorkflowApplication.java`
- `backend/src/main/java/com/jolt/workflow/HelloController.java`
- `backend/src/main/java/com/jolt/workflow/config/CorsConfig.java`
- `backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`
- `backend/src/main/java/com/jolt/workflow/geo/GeoFeatureRow.java`
- `backend/src/test/java/com/jolt/workflow/WorkflowApplicationTests.java`

### Frontend 源码

- `frontend/nuxt.config.ts`
- `frontend/app.vue`
- `frontend/pages/index.vue`
- `frontend/pages/admin.vue`
- `frontend/components/MapView.vue`
- `frontend/components/MapControls.vue`
- `frontend/components/LayerToggle.vue`
- `frontend/components/TopNav.vue`
- `frontend/components/SidebarLeft.vue`
- `frontend/components/RightSidebar.vue`
- `frontend/components/ChatInterface.vue`
- `frontend/components/TechPanel.vue`
- `frontend/components/PressureChart.vue`
- `frontend/components/InfoBox.vue`
- `frontend/composables/useGeminiChat.ts`
- `frontend/composables/useConstants.ts`
- `frontend/types.ts`
- `frontend/server/api/chat.post.ts`
- `frontend/assets/css/main.css`

### Frontend 数据

- `frontend/public/map/map_all.geojson`
- `frontend/public/map/water.geojson`
- `frontend/public/map/green.geojson`
- `frontend/public/map/buildings.geojson`
- `frontend/public/map/roads.geojson`
- `frontend/public/map/split_geojson.py`

---

## 9. 需要注意的“代码一致性”问题（未来智能体上手时优先检查）

- 前端 `layers` 包含 `sewage/drain`，但 MapView 当前仅加载 `water/green/buildings/roads`。
- 后端 `GeoFeatureRow` 使用 `com.fasterxml.jackson.databind.JsonNode` 与 Boot4 的 `tools.jackson` 不一致。
- 后端 `/api/v1/features/{id}` 未返回 HTTP 404，而是 JSON `{error:not_found}`。

---

## 10. 最小可用验证清单

### 后端

- `GET http://localhost:8080/api/v1/hello` 应返回 `{"message":"Hello, world!"}`
- 数据库连通时，启动日志应出现 Hikari/Database info。

### 前端

- `http://localhost:3000/` 能渲染 Cesium 场景并加载 GeoJSON 图层
- 点击 feature 能触发右侧面板（若匹配到 mock 资产）
- `http://localhost:3000/admin` 可查看 GeoJSON 统计信息
- 配置 `GEMINI_API_KEY` 后，AI 聊天可流式输出
