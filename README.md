# UniSpace-AI

基于 GIS、数字孪生和工单闭环的校园地下管网智能运维系统。

UniSpace-AI 不是单纯的地图展示项目，也不是孤立的工单系统。它的目标是把校园地下管网相关的核心对象统一到同一个平台里：

- 建筑
- 管道
- 管网节点
- 资产关系
- 楼层与房间
- 实时测点
- 工单
- 建筑模型

系统当前已经形成一套可运行的前后端一体化实现，重点覆盖：

- 三维地图与空间要素展示
- 管道二维编辑器与拓扑维护
- 工单系统与影响范围分析
- 房产 / 楼宇 / 房间数据联动
- 建筑模型摆放与可视化配置

最近几轮迭代里，项目还完成了几项关键收口：

- 管道空间要素正式统一到 `geo_features(layer='pipes')`
- 新增本地 SQL 脚本用于管道演示数据补全和 `roads -> pipes` 迁移
- 后台入口名称统一为 **管网二维运维工作台**
- AI 助手切换为 `DeepSeek` 兼容接入，并可结合资产、工单、测点和影响范围做联动分析

---

## 目录

- [项目定位](#项目定位)
- [核心能力](#核心能力)
- [系统架构](#系统架构)
- [核心业务对象](#核心业务对象)
- [业务模块](#业务模块)
- [二维编辑器与工单联动](#二维编辑器与工单联动)
- [建筑轮廓、建筑模型、楼层数据的区别](#建筑轮廓建筑模型楼层数据的区别)
- [数据模型与数据库结构](#数据模型与数据库结构)
- [关键接口](#关键接口)
- [运行与启动](#运行与启动)
- [开发方式](#开发方式)
- [关键代码入口](#关键代码入口)
- [当前实现边界](#当前实现边界)

---

## 项目定位

传统校园管网管理通常存在几个断层：

- 地图系统负责“看”，但不负责“改”和“追踪”
- 工单系统负责“填单”，但不直接绑定真实资产
- 房产系统管理楼宇和房间，但和地下管线影响关系脱节
- 运维人员要自己判断“一条管道异常会影响哪栋楼、哪几层、哪些房间”

UniSpace-AI 试图把这些链路打通，让操作路径变成：

1. 在地图或二维编辑器中选中真实管段
2. 直接看到它关联的节点、建筑、房间、测点、历史工单
3. 直接新建或关联工单
4. 自动计算影响范围
5. 在日志、泵控、通知、复核中持续沿同一资产链路流转

所以这个项目本质上是一个“空间资产 + 拓扑关系 + 运维工单闭环”的平台。

---

## 核心能力

### 地图与数字孪生

- 基于 `Cesium` 的三维地图主视图
- 基于 `Mars3D` 的二维 / 2.5D / 3D 管道编辑器
- `geo_features` 统一承载建筑、管道、绿地等空间要素
- 支持 bbox、图层、分页读取空间数据
- 支持 drilldown 穿透查询
- 支持 trace 上下游追踪
- 支持实时测点和编辑审计日志

### 管网二维运维工作台

- 直接新建管道草稿
- 选中管道后修改名称
- 节点拖拽、插点、删点
- 撤销 / 重做
- 草稿自动保存
- 两条管道共用节点
- 第二条管道吸附到第一条管道已有节点继续连线
- 显示建筑轮廓作为空间参照
- 查看当前管道相关工单、楼宇、节点、链路和测点
- 后台大厅顶部可直接进入，不再只挂在资产中心里

### 建筑显示与模型

- 二维编辑器主视图可显示建筑 `2D 轮廓`
- 当前主编辑视图默认是轮廓显示，不做大面积填充
- 支持单独配置建筑模型：
  - `modelEnabled`
  - `modelUrl`
  - `modelScaleMode`
  - `modelScale`
  - `modelHeading`
  - `modelPitch`
  - `modelRoll`
  - `modelLongitude`
  - `modelLatitude`
- 支持“建筑模型摆放”弹窗进行可视化调整

### 工单系统

- 四类工单：
  - `inspection` 巡检
  - `maintenance` 维修
  - `retrofit` 改造
  - `retire` 报废
- 工单列表、详情、状态流转
- 执行日志
- 影响范围调整
- 自动建单
- 快捷报修
- 泵控联动
- 支持按 `segmentId / nodeId / buildingId` 精确查工单

### 房产与楼宇数据

- 建筑基础数据已接入
- 房间数据已接入
- 楼层数据已接入
- 工单影响范围会读取楼宇、楼层、房间信息

---

## 系统架构

### 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                           浏览器                              │
│   三维地图 / 二维编辑器 / 后台业务页面 / 工单页面 / 房产页面   │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                       前端层（Nuxt 3）                        │
│ Pages + Components + Composables + Services + Server API    │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP REST
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    后端层（Spring Boot 4）                    │
│ Controller + Repository + JdbcTemplate + Flyway + Security  │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ JDBC
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                PostgreSQL / PostGIS 数据层                    │
│ geo_features + twin tables + building tables + work_order   │
└──────────────────────────────────────────────────────────────┘
```

### 前端架构

前端采用 `页面 + 组件 + composable + service` 的结构：

- `pages/`：页面入口
- `components/`：可视化组件
- `composables/`：复杂业务逻辑与状态组织
- `services/`：对 Nuxt server API 和 backend API 的调用
- `server/`：Nuxt 侧中间层接口、mock 数据和数据库辅助逻辑

这让二维编辑器、工单、资产弹窗等复杂逻辑可以从页面模板中拆开。

### 后端架构

后端主要使用：

- `Spring Boot 4`
- `JdbcTemplate`
- `Spring Security`
- `Flyway`
- `PostgreSQL + PostGIS`

当前项目里很多业务逻辑集中在 `Repository` 层，而不是传统的 `Controller -> Service -> Repository` 三层拆分。  
这种结构的特点是：

- SQL 和业务装配逻辑更靠近
- 拓扑、影响范围、楼宇关系等逻辑更直观
- 阅读代码时通常需要直接进入 Repository 理解数据生成过程

### 仓库结构

```text
UniSpace-AI/
├── backend/           Spring Boot 后端
├── frontend/          Nuxt 前端
├── docs/              预留文档目录
├── docker-compose.yml PostGIS 容器
├── start.sh           一键启动脚本
└── README.md
```

前端重点目录：

```text
frontend/
├── components/admin/
├── components/admin/pipe2d-editor/
├── composables/admin/
├── pages/
├── public/models/
├── server/
├── services/
└── types/
```

后端重点目录：

```text
backend/src/main/java/com/jolt/workflow/
├── geo/           空间要素、Twin、审计、几何更新
├── pipelineops/   管网工单、影响范围、资产查询、泵控
├── property/      房产相关接口
└── ...
```

---

## 核心业务对象

### 建筑

表示校园楼宇、建筑轮廓、模型配置和部分楼宇台账信息。

### 管道

表示空间管线几何，是地图和二维编辑器里最直接操作的对象。

### 节点

表示管网节点，是拓扑连接、节点复用、上下游追踪和工单定位的重要基础。

### 管段

表示拓扑意义上的边，通常对应一段真实管线。工单定位常落在 `segmentIds` 上。

### 资产关系

由 `asset_relations` 承载，用于表达：

- 管段与建筑
- 节点与建筑
- 建筑与房间
- 其他资产之间

的关系网络。

### 楼层与房间

是工单影响范围里最重要的受影响对象层。

### 工单

是整个业务闭环的执行中心。当前工单不是纯文本记录，而是绑定真实资产的结构化业务对象。

---

## 业务模块

### 三维地图主视图

负责“全局感知”而非精细编辑。

主要职责：

- 展示建筑、管线、节点等整体空间分布
- 承担全局定位、浏览和高亮
- 为 drilldown、trace、测点查看提供入口

### 管网二维运维工作台

这是当前项目最重的交互模块之一。

它不仅负责画线，还承担：

- 几何编辑
- 拓扑编辑
- 节点复用
- 建筑绑定
- 工单联动
- 局部运维洞察

更像一个“运维操作工作台”。

### 工单模块

工单模块覆盖巡检、维修、改造、报废四类业务。

当前的核心方向不是“做一个列表页”，而是：

- 工单绑定真实资产
- 工单可从二维编辑器直接发起
- 工单可自动推导影响范围
- 工单可进入后续日志、泵控、复核、通知流程

### 房产 / 楼宇 / 房间模块

这部分既服务房产业务，也服务管网运维。

例如：

- 哪栋楼受影响
- 影响了哪些楼层
- 影响了哪些房间

都依赖楼宇和房间数据。

### 建筑模型模块

负责为建筑轮廓之上的三维表达能力提供配置入口。

当前主要场景：

- 为建筑配置 GLB 模型
- 调整模型位置和姿态
- 将模型表现与二维轮廓显示分开管理

### 实时测点与告警

系统已具备：

- 实时测点数据读取
- 历史数据保留
- 告警事件支撑
- 自动建单入口

虽然这部分不是最近迭代的主线，但它是后续自动化运维的基础。

---

## 二维编辑器与工单联动

这是当前最有“业务闭环”意味的一条链路。

### 联动入口

在二维编辑器中选中当前管道后，用户可以直接：

- 新建工单
- 关联已有工单

不需要先跳转到工单列表页再手动查资产。

### 自动带入内容

联动弹窗会自动带入当前上下文：

- 当前管段
- 当前解析到的节点
- 当前管道介质
- 当前区域
- 当前已绑定楼宇
- 当前影响范围预分析结果

### 影响范围预分析

预分析会基于：

- `segmentIds`
- `nodeIds`
- `buildingId`
- `asset_relations`

推导受影响楼宇、楼层、房间，并估算：

- 影响楼宇数
- 影响人数
- 预计影响时长

### 关联已有工单

如果当前选中管道已经存在相关工单，弹窗允许直接把当前资产上下文补到已有工单里，而不是强制新建。

### 设计意义

这条链路真正把：

- 空间编辑
- 拓扑资产
- 工单闭环

连接成了一体。

---

## 建筑轮廓、建筑模型、楼层数据的区别

这三者很容易混淆，但在当前系统里职责完全不同。

### 建筑轮廓

- 来源：`geo_features(layer='buildings')`
- 表现：二维编辑器里的 `2D 轮廓线`
- 用途：对齐管道、做建筑绑定、做空间参照

当前二维编辑器主视图里显示的是这个。

### 建筑模型

- 来源：建筑要素 `properties`
- 关键字段：
  - `modelEnabled`
  - `modelUrl`
  - `modelScaleMode`
  - `modelScale`
  - `modelHeading`
  - `modelPitch`
  - `modelRoll`
  - `modelLongitude`
  - `modelLatitude`
- 用途：建筑模型摆放、预览和三维表现

当前“建筑模型摆放”弹窗管理的是这个，不是楼层。

### 建筑楼层

- 来源：`buildings`、`building_floors`、`building_rooms`
- 用途：工单影响范围、楼宇房间影响显示、上层房产业务

楼层不是在二维编辑器里设置的，也不是在建筑模型摆放弹窗里设置的。

---

## 数据模型与数据库结构

### 空间与拓扑表

| 表名 | 用途 |
| --- | --- |
| `geo_features` | 建筑、管道、绿地等空间要素 |
| `pipe_nodes` | 管网节点 |
| `pipe_segments` | 管段 |
| `pipe_valves` | 阀门 |
| `pipe_manholes` | 检查井 |
| `pump_stations` | 泵站 |
| `asset_relations` | 资产关系网络 |
| `telemetry_latest` | 最新测点数据 |
| `edit_audit_log` | 编辑审计 |

当前约定：

- 管道资产正式存放在 `geo_features(layer='pipes')`
- `roads` 仅作为历史兼容语义保留，推荐新数据一律使用 `pipes`
- `pipe_segments.feature_id` 与 `geo_features.id` 对应，用于把空间几何与拓扑边绑定起来

### 建筑与房间表

| 表名 | 用途 |
| --- | --- |
| `buildings` | 建筑基础表 |
| `building_floors` | 建筑楼层 |
| `building_rooms` | 房间与楼层关系 |
| `rooms` | 兼容旧房间表 |

说明：

- `buildings.floor_count` 表示楼栋总层数
- `building_rooms.floor_id` 对应 `building_floors.id`
- `building_floors.floor_no` 才是实际楼层号

### 工单表

| 表名 | 用途 |
| --- | --- |
| `work_order` | 主工单表 |
| `order_building_link` | 工单影响楼宇关系 |
| `work_order_log` | 工单执行日志 |
| `pump_control_log` | 泵控日志 |

### 影响范围是怎么构造的

后端在构造工单影响范围时，会优先看：

- 工单显式绑定的楼宇
- 管段、节点关联到的楼宇
- 楼宇下的房间与楼层

最终生成：

- `impactedBuildings`
- `floors`
- `rooms`
- `equipmentIds`

### 本地数据脚本

为便于本地演示和空库恢复，仓库提供了两份直接可执行的 SQL：

- [`backend/src/main/resources/db/seed/backfill_pipeline_demo_assets.sql`](backend/src/main/resources/db/seed/backfill_pipeline_demo_assets.sql)
  - 用于为现有管道回填演示属性
  - 自动补齐 `pipelineMedium / pipeType / diameter / material / depth / installDate / lastMaintain / pressure / flowRate / status`
  - 自动补齐节点高程和默认测点
- [`backend/src/main/resources/db/seed/migrate_pipeline_layers_to_pipes.sql`](backend/src/main/resources/db/seed/migrate_pipeline_layers_to_pipes.sql)
  - 用于把历史 `roads` 图层中的管道正式迁移到 `pipes`

如果你本地手工重建过管道几何，但只有拓扑骨架没有属性，这两份脚本会很有用。

---

## 关键接口

### Twin / 地图 / 编辑器

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/v1/features` | GET | 查询空间要素 |
| `/api/v1/features` | POST / PUT / DELETE | 增删改空间要素 |
| `/api/v1/features/visibility` | PUT | 更新要素可见性 |
| `/api/v1/twin/drilldown/{featureId}` | GET | 穿透查询 |
| `/api/v1/twin/trace` | GET | 管网追踪 |
| `/api/v1/twin/nodes` | GET | 查询节点 |
| `/api/v1/twin/telemetry/latest` | GET | 查询最新测点 |
| `/api/v1/twin/pipes/{id}/geometry` | PUT | 更新管道几何 |
| `/api/v1/twin/pipes/{id}/properties` | PUT | 更新管道属性 |
| `/api/v1/twin/pipes/{id}/buildings` | PUT | 更新管道绑定楼宇 |
| `/api/v1/twin/audit/{featureId}` | GET | 查询编辑审计 |

### 工单

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/v1/pipeline-ops/workorders` | GET | 工单列表 |
| `/api/v1/pipeline-ops/workorder` | GET | 单个工单详情 |
| `/api/v1/pipeline-ops/workorders` | POST | 创建或更新工单 |
| `/api/v1/pipeline-ops/workorders` | PATCH | 工单状态流转 |
| `/api/v1/pipeline-ops/workorders-related` | GET | 按 segment / node / building 查相关工单 |
| `/api/v1/pipeline-ops/assets` | GET | 查询可选节点 / 管段 / 楼宇资产 |
| `/api/v1/pipeline-ops/impact-analysis` | POST | 影响范围预分析 |
| `/api/v1/pipeline-ops/auto-create` | POST | 自动建单 |
| `/api/v1/pipeline-ops/quick-report` | POST | 快捷报修 |
| `/api/v1/pipeline-ops/action` | POST | 日志、泵控、影响范围调整等动作 |
| `/api/v1/pipeline-ops/stats` | GET | 工单统计 |
| `/api/v1/pipeline-ops/dashboard` | GET | 工单看板 |

### 房产 / 建筑

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/v1/property/buildings` | GET | 查询建筑列表 |
| `/api/v1/property/rooms` | GET | 查询房间列表 |
| `/api/v1/property/overview` | GET | 房产概览 |

---

## 运行与启动

### 环境要求

- `Node.js >= 18`
- `JDK 21`
- `Docker`（推荐）

### 环境变量

根目录 `.env`：

```bash
POSTGRES_PASSWORD=replace-with-a-strong-password
DB_PASSWORD=replace-with-a-strong-password

APP_SECURITY_WRITE_AUTH_ENABLED=true
APP_ADMIN_USER=admin
APP_ADMIN_PASSWORD=replace-with-a-strong-password

BACKEND_WRITE_AUTH_ENABLED=true
BACKEND_ADMIN_USER=admin
BACKEND_ADMIN_PASSWORD=replace-with-a-strong-password

GEMINI_API_KEY=replace-with-your-gemini-key
DEEPSEEK_API_KEY=replace-with-your-deepseek-key
DEEPSEEK_MODEL=deepseek-v4-flash
```

前端 `frontend/.env`：

```bash
GEMINI_API_KEY=replace-with-your-gemini-key
DEEPSEEK_API_KEY=replace-with-your-deepseek-key
DEEPSEEK_MODEL=deepseek-v4-flash
NUXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8080

BACKEND_WRITE_AUTH_ENABLED=true
BACKEND_ADMIN_USER=admin
BACKEND_ADMIN_PASSWORD=replace-with-a-strong-password
```

说明：

- 当前前端聊天服务会优先使用 `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY` 仍保留在配置中，但已不是当前主聊天通道

### 一键启动

```bash
chmod +x start.sh
./start.sh
```

脚本会自动：

- 读取根目录 `.env`
- 检查 Java / Node
- 检查 `docker compose`
- 在缺少本地数据库时自动拉起 `postgis`
- 清理本项目残留端口
- 启动后端和前端

默认端口：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8080`
- 数据库：`localhost:5432`

### 手动启动

启动数据库：

```bash
docker compose up -d postgis
```

启动后端：

```bash
cd backend
./gradlew bootRun
```

启动前端：

```bash
cd frontend
npm ci
npm run dev
```

---

## 开发方式

### 常用命令

前端：

```bash
cd frontend
npm run dev
npm run build
npm run typecheck
```

后端：

```bash
cd backend
./gradlew bootRun
./gradlew test
```

数据库：

```bash
docker compose up -d postgis
docker exec -it unispace-postgis psql -U postgres -d unispace
```

### Flyway 迁移

当前迁移重点大致如下：

- `V1` 基础空间表
- `V3-V7` Twin 拓扑、实体、测点体系
- `V8-V9` 建筑与房间种子
- `V10` 工单体系
- `V15` 房产服务工单迁移（用于避开历史重复 `V10` 冲突）

迁移目录：

- [`backend/src/main/resources/db/migration`](backend/src/main/resources/db/migration)

### 推荐的阅读顺序

当前项目很多核心逻辑不在文档里，而在具体实现文件里。建议用下面顺序接手：

1. 看页面入口
2. 看 composable
3. 看 service
4. 看 backend repository

因为：

- 前端复杂状态组织主要在 composable
- 接口拼接主要在 service
- 核心业务生成逻辑主要在 repository

---

## 关键代码入口

### 管网二维运维工作台

- [`frontend/components/admin/Pipe2DEditorDialog.vue`](frontend/components/admin/Pipe2DEditorDialog.vue)
- [`frontend/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue`](frontend/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue)
- [`frontend/components/admin/pipe2d-editor/Pipe2DEditorWorkorderPromptModal.vue`](frontend/components/admin/pipe2d-editor/Pipe2DEditorWorkorderPromptModal.vue)
- [`frontend/composables/admin/usePipe2DEditorMap.ts`](frontend/composables/admin/usePipe2DEditorMap.ts)
- [`frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`](frontend/composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts)

### 工单

- [`frontend/components/admin/ops/PipelineOpsBoard.vue`](frontend/components/admin/ops/PipelineOpsBoard.vue)
- [`frontend/components/admin/ops/PipelineOpsCreateSection.vue`](frontend/components/admin/ops/PipelineOpsCreateSection.vue)
- [`frontend/components/admin/ops/PipelineOpsListSection.vue`](frontend/components/admin/ops/PipelineOpsListSection.vue)
- [`frontend/composables/admin/usePipelineOpsBoard.ts`](frontend/composables/admin/usePipelineOpsBoard.ts)
- [`frontend/composables/admin/usePipelineOpsBoardUi.ts`](frontend/composables/admin/usePipelineOpsBoardUi.ts)
- [`backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java`](backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepository.java)
- [`backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java`](backend/src/main/java/com/jolt/workflow/pipelineops/WorkOrderRepositorySupport.java)

### 建筑模型与楼宇

- [`frontend/components/admin/pipe2d-editor/Pipe2DEditorBuildingModelModal.vue`](frontend/components/admin/pipe2d-editor/Pipe2DEditorBuildingModelModal.vue)
- [`frontend/components/admin/ModelCoordinatePickerDialog.vue`](frontend/components/admin/ModelCoordinatePickerDialog.vue)
- [`backend/src/main/java/com/jolt/workflow/geo/TwinController.java`](backend/src/main/java/com/jolt/workflow/geo/TwinController.java)

---

## 当前实现边界

这份 README 尽量按“当前真实实现”来写，但仍有一些边界需要明确：

- 二维编辑器主视图当前显示的是建筑轮廓，不是直接把所有 GLB 模型都渲染到主编辑层
- “管网二维运维工作台”虽然名字已经升级，但核心组件和部分代码命名仍保留 `Pipe2DEditor*` 形式
- 建筑楼层数据来自建筑 / 房间基础表，不是在二维编辑器里编辑
- 工单影响范围已经基于真实资产关系推导，但还不是完整仿真级水力分析
- `docs/` 目录当前不是完整文档中心，很多实现细节仍以代码为准

---

## 总结

如果只用一句话概括这个项目：

**UniSpace-AI 是一个把地下管网空间数据、拓扑关系、建筑楼宇、房间楼层、实时测点和工单闭环真正连接起来的校园运维平台。**

如果你刚接手这个仓库，优先看懂三条线：

1. 二维编辑器如何维护真实管网资产
2. 工单如何绑定真实资产并生成影响范围
3. 建筑、楼层、房间如何成为工单影响对象

把这三条线看懂，基本就看懂了整个项目的核心。  
