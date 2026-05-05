# UniSpace-AI

基于 GIS、数字孪生、资产拓扑和工单闭环的校园地下管网智能运维平台。

UniSpace-AI 不是一个单纯的地图展示项目，也不是一个孤立的工单系统。它的目标是把校园地下管网相关的空间资产、拓扑关系、楼宇房间、测点数据和运维动作组织到同一个工作台里，让“看见问题、定位问题、分析影响、发起处置、回看过程”发生在同一条资产链路上。

---

## 目录

- [项目概览](#项目概览)
- [核心亮点](#核心亮点)
- [模块全景](#模块全景)
- [模块详解](#模块详解)
- [系统架构](#系统架构)
- [数据模型](#数据模型)
- [接口概览](#接口概览)
- [快速开始](#快速开始)
- [开发说明](#开发说明)
- [关键代码入口](#关键代码入口)
- [当前边界](#当前边界)

---

## 项目概览

传统校园地下管网系统通常存在几个典型断层：

- 地图系统能看空间位置，但不能直接维护真实资产关系
- 工单系统能记录流程，但不能天然绑定真实管段、节点和楼宇
- 房产系统管理楼宇与房间，但无法直接承接管网影响范围
- 运维人员需要在多个系统之间切换，手工判断“一条管道异常会影响哪些楼、哪些房间、哪些设备”

UniSpace-AI 的目标是把这些断层打通，让操作链路变成：

1. 在地图或二维编辑器中选中真实管道资产
2. 即时获得节点、楼宇、测点、历史工单和影响范围上下文
3. 在同一个工作台里发起工单、关联工单或做局部预览
4. 基于真实资产关系推导受影响楼宇、楼层、房间和设备
5. 将日志、泵控、通知、复核等动作持续挂在同一条资产链路上

项目当前统一承载的核心对象包括：

- 建筑
- 管道
- 管网节点
- 管段
- 资产关系
- 楼层与房间
- 实时测点
- 工单
- 建筑模型

---

## 核心亮点

### 1. 空间资产与运维动作真正打通

不是先有地图、再跳工单、再切房产页面，而是在同一个资产上下文里完成：

- 选中管道
- 看节点和测点
- 看关联楼宇
- 发起工单
- 预分析影响范围
- 回看执行日志

### 2. 二维编辑器不是画线工具，而是运维工作台

项目中的二维编辑器承担的不只是几何绘制，还包括：

- 拓扑节点与边维护
- 节点复用
- 建筑绑定
- 工单联动
- 选中管道 `2.5D` 预览
- 资产级局部洞察

### 3. 建筑轮廓、建筑模型、楼层房间三层数据分离

这是很多项目容易做混的地方。UniSpace-AI 当前实现里已经把三者明确分开：

- 建筑轮廓用于二维空间参照和绑定
- 建筑模型用于三维表现与摆放
- 楼层 / 房间用于工单影响范围和房产业务

### 4. 真实资产关系驱动影响范围分析

影响范围不是纯文本备注，而是基于：

- 管段
- 节点
- 楼宇
- `asset_relations`

推导出受影响对象集合。

### 5. 选中管道局部 `2.5D` 预览

当前实现支持对已选中管道做局部立体化表达，联动展示：

- 管体
- 地下参考层
- 真实业务节点
- 当前管段首尾点
- 建筑体块与建筑 GLB 模型
- 纵断面剖面
- 节点压力 / 流量 / 工单状态

---

## 模块全景

当前项目可以按下面几个模块理解：

| 模块 | 作用 | 当前状态 |
| --- | --- | --- |
| 三维地图主视图 | 全局浏览、定位、高亮、钻取入口 | 已实现 |
| 管网二维运维工作台 | 管道编辑、拓扑维护、建筑绑定、工单联动 | 已实现 |
| 选中管道 `2.5D` 预览 | 局部立体化预览、纵断面、节点状态联动 | 已实现 |
| 数字孪生资产查询层（钻取 / 追踪 / 测点） | 穿透查询、上下游追踪、测点查询 | 已实现 |
| 工单系统 | 巡检、维修、改造、报废与影响范围闭环 | 已实现 |
| 建筑模型管理 | GLB 模型配置、位置姿态调节、可视化摆放 | 已实现 |
| 房产 / 楼宇 / 房间联动 | 影响范围对象层、房产业务基础 | 已实现 |
| AI 助手 | 结合资产、工单、测点、影响范围做上下文分析 | 已实现 |

---

## 模块详解

### 三维地图主视图

三维地图负责“总览”和“穿透入口”，不负责重交互编辑。

当前能力：

- 展示建筑、管线、节点等整体空间分布
- 提供全局定位、浏览和高亮能力
- 支持空间要素分页、bbox、图层查询
- 作为资产钻取、上下游追踪和测点查看的入口

适合理解成：

- 地图层负责找到资产
- 编辑层负责修改资产
- 工单层负责处理资产

### 管网二维运维工作台

这是当前项目里最核心、最重交互的模块。

它不仅负责“画管线”，还负责把与当前管道相关的操作组织到同一工作区里。

当前能力：

- 新建管道草稿
- 选中管道后修改名称和属性
- 节点拖拽、插点、删点
- 撤销 / 重做
- 草稿自动保存
- 节点复用
- 多条管道吸附并共享节点
- 建筑轮廓参照
- 当前管道关联工单、楼宇、节点、链路和测点查看
- 选中管道 `2.5D` 预览入口

这个模块的价值不在于“能画折线”，而在于它把下面这些原本分散在多个页面里的动作合并到了同一个上下文中：

- 几何维护
- 拓扑维护
- 资产绑定
- 工单发起
- 影响关系查看
- 局部空间预览

### 选中管道 `2.5D` 预览

这是当前编辑器体系里最偏“资产洞察”的模块。

它的定位不是完整园区级三维漫游器，而是针对“已选中的单条管道”提供局部立体化表达。

当前能力：

- 基于当前选中管道几何生成局部立体预览
- 展示管体、地下参考层、建筑轮廓、建筑体块和建筑模型
- 联动展示节点状态、节点详情和纵断面剖面
- 节点点击、列表点击、剖面点击互相联动

当前节点展示规则：

- 只保留真实业务节点
- 再补当前管段首尾点
- 不再把中间几何折点直接展示为业务节点

这使得 `2.5D` 预览更接近“业务视角下的局部剖面”，而不是纯几何调试视图。

### 数字孪生资产查询层（钻取 / 追踪 / 测点）

这一层是地图、编辑器和工单系统之间的数据桥梁。

当前能力：

- 资产钻取：按 featureId 穿透查询当前管段关联节点、楼宇、关系、测点等信息
- 上下游追踪：沿拓扑关系查询相关路径、节点和管段
- 测点读取：查询最新压力、流量等测点数据
- 编辑审计：查询几何和属性调整后的审计日志

这套能力让前端不只是“看一条线”，而是能围绕一条线拿到完整上下文。

### 工单系统

当前工单系统覆盖四类业务：

- `inspection` 巡检
- `maintenance` 维修
- `retrofit` 改造
- `retire` 报废

当前能力：

- 工单列表、详情、状态流转
- 执行日志
- 影响范围调整
- 自动建单
- 快捷报修
- 泵控联动
- 按 `segmentId / nodeId / buildingId` 精确回查相关工单

这个模块的核心不是表单，而是“真实资产驱动”：

- 创建工单优先从真实节点、管段和楼宇中选择
- 二维编辑器可以带着当前资产上下文直接发起建单
- 后端继续基于资产关系推导影响楼宇、楼层、房间和设备

### 建筑模型管理

项目当前已经把建筑模型配置从二维轮廓里独立出来。

当前能力：

- 为建筑单独配置 GLB 模型
- 管理模型开关、URL、缩放模式和缩放比例
- 配置模型姿态：heading / pitch / roll
- 配置模型经纬度位置
- 通过可视化弹窗辅助摆放

这套配置结果会被：

- 三维地图复用
- 选中管道 `2.5D` 预览复用

### 房产 / 楼宇 / 房间联动

这一层既服务房产业务，也服务地下管网运维。

当前能力：

- 建筑基础数据接入
- 楼层数据接入
- 房间数据接入
- 工单影响范围可下钻到楼宇、楼层和房间

在这个项目里，楼宇和房间不是装饰数据，而是工单影响对象层。

### AI 助手

项目当前已接入 `DeepSeek` 兼容调用，重点不是做通用聊天，而是围绕当前资产上下文给出辅助分析。

当前能力：

- 结合真实业务上下文回答问题
- 结合节点、管段、楼宇、工单、测点和影响范围生成分析
- 作为工作台和业务模块之间的上下文增强入口

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
- `services/`：前端调用层
- `server/`：Nuxt 中间层接口、mock 数据和数据库辅助逻辑

当前几个重点模式比较明确：

- 页面负责业务视图和入口挂载
- `components/admin/pipe2d-editor/` 负责工作台 UI 分区、弹窗和局部可视化
- `composables/admin/` 负责状态组织、编辑器模式切换、草稿同步和预览数据装配
- `services/` 负责前端与 Nuxt server API / backend API 的调用收口

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

## 数据模型

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

这套约定的意义是把“空间几何”和“拓扑资产”分层管理：

- 地图和编辑器主要操作 `geo_features`
- 拓扑、关系、节点、管段信息由 twin / pipeline 表体系承接

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

### 影响范围构造逻辑

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

---

## 接口概览

### 数字孪生 / 地图 / 编辑器

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

说明：

- 选中管道 `2.5D` 预览没有单独新增后端接口
- 它复用现有的 `drilldown`、测点、相关工单和建筑数据
- 因此它属于前端侧的数据装配和可视化能力，而不是新的后端资源模型

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

## 快速开始

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

## 开发说明

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

### 推荐阅读顺序

如果你第一次接手这个仓库，建议按下面顺序理解：

1. 页面入口
2. composable
3. service
4. backend repository

原因是：

- 前端复杂状态组织主要在 composable
- 接口拼接主要在 service
- 核心业务生成逻辑主要在 repository

如果你关注的是工作台里的 `2.5D` 预览链路，建议额外按下面顺序看：

1. `Pipe2DEditorDialog.vue`
2. `Pipe2DEditorRightPanelSection.vue`
3. `useSelectedPipe25DPreview.ts`
4. `Pipe2DSelectedPipe25DPreview.vue`

---

## 关键代码入口

### 管网二维运维工作台

- [`frontend/components/admin/Pipe2DEditorDialog.vue`](frontend/components/admin/Pipe2DEditorDialog.vue)
- [`frontend/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue`](frontend/components/admin/pipe2d-editor/Pipe2DEditorRightPanelSection.vue)
- [`frontend/components/admin/pipe2d-editor/Pipe2DSelectedPipe25DPreview.vue`](frontend/components/admin/pipe2d-editor/Pipe2DSelectedPipe25DPreview.vue)
- [`frontend/components/admin/pipe2d-editor/Pipe2DEditorWorkorderPromptModal.vue`](frontend/components/admin/pipe2d-editor/Pipe2DEditorWorkorderPromptModal.vue)
- [`frontend/composables/admin/pipe2d-editor/useSelectedPipe25DPreview.ts`](frontend/composables/admin/pipe2d-editor/useSelectedPipe25DPreview.ts)
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

### AI 助手与上下文联动

- [`frontend/components/ChatInterface.vue`](frontend/components/ChatInterface.vue)
- [`frontend/server/api/chat.post.ts`](frontend/server/api/chat.post.ts)
- [`frontend/services/pipeline-intelligence.ts`](frontend/services/pipeline-intelligence.ts)

---

## 当前边界

这份 README 按当前真实实现来写，但仍有一些边界需要明确：

- 二维编辑器主视图当前显示的是建筑轮廓，不是把所有 GLB 模型直接渲染到主编辑层
- “管网二维运维工作台”虽然是统一业务命名，但核心组件名仍大量保留 `Pipe2DEditor*`
- 当前 `2.5D` 预览是“选中单条管道后的局部预览”，不是完整园区级三维管网漫游器
- `2.5D` 预览中的节点只保留当前管段首尾点和真实业务节点，不再把中间几何折点当作业务节点展示
- 其中部分端点节点可能来自当前管段首尾点兜底推断，不一定是后端显式下发的真实节点资产
- `2.5D` 预览当前复用的是现有 drilldown / telemetry / related workorders 数据，未引入独立的剖面计算后端
- 建筑楼层数据来自建筑 / 房间基础表，不在二维编辑器里编辑
- 工单影响范围已经基于真实资产关系推导，但还不是完整仿真级水力分析
- `docs/` 目录当前不是完整文档中心，很多实现细节仍以代码为准
