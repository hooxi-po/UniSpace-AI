# UniSpace-AI

**基于 GIS 和数字孪生技术的校园地下管网智能运维系统**

一个集成了空间数据可视化、拓扑关系管理、实时监测告警、工单全生命周期管理的完整数字孪生平台。

## 技术栈

- **前端**：Nuxt 3 + Vue 3 + Cesium（3D地图）+ Mars3D（2D编辑器）+ TailwindCSS
- **后端**：Spring Boot 4 + PostgreSQL/PostGIS + Flyway + JdbcTemplate
- **AI**：Gemini 流式对话（`/api/chat`）
- **数据层**：空间要素（GeoJSON）、Twin 拓扑、实时测点、工单系统、房产管理

## 核心功能

### 1. 三维地图可视化
- **Cesium 三维引擎**：校园全景三维展示
- **多图层管理**：建筑、管道（供水/排水/污水）、管网节点、绿地
- **动态加载优化**：按视口 bbox 分页加载（800条/页，最多5页），防抖350ms
- **实时高亮**：点击实体自动高亮并显示详情
- **工单热力图**：叠加显示进行中的工单位置

### 2. 拓扑关系管理
- **drilldown 穿透查询**：点击管段自动查询关联的节点、阀门、建筑、房间、设备
- **trace 上下游追踪**：基于 BFS 算法追踪管网上游/下游完整路径
- **影响范围自动计算**：工单创建时自动计算受影响的建筑和房间
- **拓扑数据模型**：`pipe_nodes`（节点）、`pipe_segments`（管段）、`asset_relations`（关系）

### 3. 实时监测与告警
- **测点数据采集**：支持压力、流量、浊度、余氯等多指标
- **阈值规则引擎**：自动评估数据并触发 warning/critical 告警
- **双表存储**：`m2_metric_latest`（最新值）+ `m2_metric_history`（历史数据）
- **告警事件管理**：`m2_alert_events` 记录所有告警，支持状态流转

### 4. 工单全生命周期管理
- **四类工单**：巡检（inspection）、维修（maintenance）、改造（retrofit）、报废（retire）
- **状态机流转**：draft → todo → assigned → in_progress → review → completed → closed
- **热水泵联动控制**：批量控制受影响建筑的热水泵开关，支持定时恢复
- **执行日志**：支持照片、语音、GPS 定位上传
- **影响范围调整**：手动调整工单影响的建筑和房间
- **统计与看板**：工单状态统计、效率分析、影响范围 Top 10

### 5. 管道二维编辑器
- **Mars3D 引擎**：支持 2D/2.5D/3D 视图切换
- **可视化编辑**：节点拖拽、线段插点/删点、右键菜单
- **草稿自动保存**：800ms 防抖 + 8s 定时保存到 localStorage
- **撤销/重做**：支持无限次撤销和重做（最多保留50条历史）
- **Twin 数据洞察**：实时查看 drilldown、trace、telemetry、audit 数据
- **快捷报修**：编辑器内直接创建维修工单

### 6. 建筑 3D 模型管理
- **GLB 模型加载**：支持上传和配置 GLB 格式的建筑模型
- **可视化坐标编辑**：在地图上点击或拖拽设置模型位置
- **姿态调整**：滑杆实时预览 Heading/Pitch/Roll 旋转
- **自动缩放**：根据建筑底面自动估算模型缩放比例

### 7. 房产管理（部分实现）
- **转固管理**：资产转固申请、审核、库存管理
- **调配管理**：公用房归口调配、临时借用
- **收费管理**：公房收费标准、缴费记录
- **经营管理**：经营性用房租赁管理
- **人员管理**：人员信息维护

### 8. AI 智能助手
- **Gemini 集成**：基于 Google Gemini API 的对话式 AI
- **SSE 流式输出**：实时流式返回 AI 回复
- **业务查询**：支持管网状态查询、工单进度查询等（需进一步完善）

## 系统架构

### 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器层                              │
│  主地图（3D Cesium）+ 后台管理（资产/工单/房产）             │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      前端层（Nuxt 3）                         │
│  Pages + Components + Composables + Nuxt Server API         │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP REST
┌─────────────────────────────────────────────────────────────┐
│                   后端层（Spring Boot 4）                     │
│  Controllers + Repositories（JdbcTemplate）                  │
└─────────────────────────────────────────────────────────────┘
                              ↓ JDBC
┌─────────────────────────────────────────────────────────────┐
│                数据库层（PostgreSQL + PostGIS）               │
│  空间要素 + 拓扑关系 + 测点数据 + 工单系统                    │
└─────────────────────────────────────────────────────────────┘
```

### 核心数据表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `geo_features` | 空间要素（建筑/管道/绿地） | id, layer, geom, properties, visible |
| `pipe_nodes` | 管网节点 | id, feature_id, node_type, properties |
| `pipe_segments` | 管段 | id, feature_id, from_node_id, to_node_id, diameter_mm, material |
| `asset_relations` | 资产关系 | source_id, source_type, target_id, target_type, relation_type |
| `telemetry_latest` | 实时测点数据 | point_id, feature_id, metric, value, sampled_at |
| `m2_metric_history` | 历史测点数据 | point_id, metric, value, sampled_at |
| `m2_alert_events` | 告警事件 | point_id, metric, severity, status |
| `work_order` | 工单 | id, order_type, status, node_ids, segment_ids, impact_scope |
| `pump_control_log` | 热水泵控制日志 | work_order_id, building_id, pump_id, action, result |

### 技术特点

1. **数据库端 JSON 构造**：利用 PostgreSQL 的 `jsonb_build_object` 和 `ST_AsGeoJSON` 在数据库层直接生成 GeoJSON，性能提升 6 倍
2. **Controller-Repository 模式**：无 Service 层，Repository 直接处理业务逻辑
3. **按需动态加载**：按视口 bbox 分页拉取，单次 800 条，最多 5 页，帧率稳定在 55-60 FPS
4. **拓扑图算法**：基于 BFS 的上下游追踪，支持复杂管网结构
5. **草稿自动保存**：800ms 防抖 + 8s 定时保存，避免数据丢失
6. **审计日志完整**：所有编辑操作记录 before/after payload，可回溯

## 文档导航

- 项目总览：当前这份 [`README.md`](./README.md)
- 开发指南：[`CLAUDE.md`](./CLAUDE.md)（项目架构、约定和最佳实践）
- 模块导航：[`docs/README.md`](./docs/README.md)
- 前端手册：[`docs/frontend.md`](./docs/frontend.md)
- 后端手册：[`docs/backend.md`](./docs/backend.md)
- 数据与 API 手册：[`docs/data-and-api.md`](./docs/data-and-api.md)
- 业务模块手册：[`docs/business-modules.md`](./docs/business-modules.md)

## 快速开始

### 环境要求

- Node.js >= 18
- JDK 21
- PostgreSQL/PostGIS 或 Docker

### 1. 准备环境变量

```bash
cp .env.example .env
```

至少需要配置：

- `POSTGRES_PASSWORD` 或 `DB_PASSWORD`
- `APP_ADMIN_PASSWORD`（当后端写鉴权开启时）
- `GEMINI_API_KEY`（使用 AI 对话时需要）

### 2. 一键启动

```bash
chmod +x start.sh
./start.sh
```

`start.sh` 会自动：
- 解析根目录 `.env`
- 校验 Java / Node 环境
- 若本地没有 PostgreSQL，自动启动 Docker 容器
- 清理遗留的 3000/8080 端口进程
- 安装前端依赖
- 启动后端和前端

启动后访问：
- 前端：`http://localhost:3000`
- 后端：`http://localhost:8080`

### 3. 手动启动

```bash
# 启动数据库
docker compose up -d

# 启动后端
cd backend
./gradlew bootRun

# 启动前端
cd frontend
npm ci
npm run dev
```

## 核心 API

### 空间要素与拓扑关系

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/features` | GET | 查询空间要素（支持 bbox、图层、分页） |
| `/api/v1/features/{id}` | GET | 查询单个要素 |
| `/api/v1/features` | POST | 创建要素 |
| `/api/v1/features` | PUT | 更新要素 |
| `/api/v1/features` | DELETE | 删除要素 |
| `/api/v1/features/visibility` | PUT | 更新可见性 |
| `/api/v1/twin/drilldown/{featureId}` | GET | 穿透查询（节点/建筑/房间/设备） |
| `/api/v1/twin/trace` | GET | 上下游追踪 |
| `/api/v1/twin/nodes` | GET | 查询管网节点 |
| `/api/v1/twin/telemetry/latest` | GET | 查询最新测点数据 |
| `/api/v1/twin/pipes/{id}/geometry` | PUT | 更新管道几何 |
| `/api/v1/twin/pipes/{id}/properties` | PUT | 更新管道属性 |
| `/api/v1/twin/audit/{featureId}` | GET | 查询编辑审计日志 |

### 实时监测与告警

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/module2/telemetry/ingest` | POST | 上报测点数据 |
| `/api/v1/module2/telemetry/thresholds` | PUT | 设置阈值规则 |
| `/api/v1/module2/telemetry/latest` | GET | 查询最新测点数据 |
| `/api/v1/module2/telemetry/history` | GET | 查询历史测点数据 |

### 工单系统

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/pipeline-ops/workorders` | GET | 查询工单列表 |
| `/api/v1/pipeline-ops/workorder` | GET | 查询单个工单 |
| `/api/v1/pipeline-ops/workorders` | POST | 创建/更新工单 |
| `/api/v1/pipeline-ops/workorders` | PATCH | 工单状态流转 |
| `/api/v1/pipeline-ops/auto-create` | POST | 自动创建工单（告警触发） |
| `/api/v1/pipeline-ops/quick-report` | POST | 快捷报修 |
| `/api/v1/pipeline-ops/action` | POST | 执行工单操作（泵控/日志/调整） |
| `/api/v1/pipeline-ops/stats` | GET | 工单统计 |
| `/api/v1/pipeline-ops/dashboard` | GET | 工单看板数据 |

### 房产管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/property/buildings` | GET | 查询建筑列表 |
| `/api/v1/property/rooms` | GET | 查询房间列表 |
| `/api/v1/property/overview` | GET | 房产概览统计 |

## 数据库迁移

当前 Flyway 迁移版本：`V1 ~ V10`

| 版本 | 说明 |
|------|------|
| V1 | 初始化 PostGIS + `geo_features` 表 |
| V2 | 添加 `visible` 字段 |
| V3 | Twin 拓扑表（`pipe_nodes`、`pipe_segments`、`asset_relations`、`telemetry_latest`、`edit_audit_log`） |
| V4 | Twin 拓扑种子数据 |
| V5 | Twin 实体表（`pipe_valves`、`pump_stations`、`pipe_manholes`、`building_floors`、`building_rooms`） |
| V6 | Module2 测点系统表 |
| V7 | 扩展拓扑实体种子数据 |
| V8 | 房产基础表（`buildings`、`rooms`） |
| V9 | 房产种子数据 |
| V10 | 工单系统表（`work_order`、`order_building_link`、`work_order_log`、`pump_control_log`） |

## 环境变量

| 变量 | 用途 | 默认值 / 说明 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Docker/Postgres 密码 | 必填 |
| `DB_URL` | Spring 数据库地址 | `jdbc:postgresql://localhost:5432/unispace` |
| `DB_USER` | Spring 数据库用户 | `postgres` |
| `DB_PASSWORD` | Spring 数据库密码 | 为空时回退 `POSTGRES_PASSWORD` |
| `APP_SECURITY_WRITE_AUTH_ENABLED` | Spring 写接口鉴权开关 | `true` |
| `APP_ADMIN_USER` | Spring Basic 用户名 | `admin` |
| `APP_ADMIN_PASSWORD` | Spring Basic 密码 | 写鉴权开启时必填 |
| `BACKEND_WRITE_AUTH_ENABLED` | Nuxt 写代理鉴权开关 | 默认继承后端语义，建议保持 `true` |
| `BACKEND_ADMIN_USER` | Nuxt 代理转发时附加的用户名 | `admin` |
| `BACKEND_ADMIN_PASSWORD` | Nuxt 代理转发时附加的密码 | 写代理开启时必填 |
| `BACKEND_BASE_URL` / `NUXT_PUBLIC_BACKEND_BASE_URL` | Nuxt 访问后端的基地址 | `http://localhost:8080` |
| `GEMINI_API_KEY` | `/api/chat` 使用的 Gemini Key | 未配置时聊天接口返回 500 |
| `CORS_ALLOWED_ORIGINS` | 后端 CORS 白名单 | `http://localhost:3000,http://127.0.0.1:3000` |
| `JPA_SHOW_SQL` | 是否打印 SQL | `false` |

## 环境变量

| 变量 | 用途 | 默认值 / 说明 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Docker/Postgres 密码 | 必填 |
| `DB_URL` | Spring 数据库地址 | `jdbc:postgresql://localhost:5432/unispace` |
| `DB_USER` | Spring 数据库用户 | `postgres` |
| `DB_PASSWORD` | Spring 数据库密码 | 为空时回退 `POSTGRES_PASSWORD` |
| `APP_SECURITY_WRITE_AUTH_ENABLED` | Spring 写接口鉴权开关 | `true` |
| `APP_ADMIN_USER` | Spring Basic 用户名 | `admin` |
| `APP_ADMIN_PASSWORD` | Spring Basic 密码 | 写鉴权开启时必填 |
| `BACKEND_WRITE_AUTH_ENABLED` | Nuxt 写代理鉴权开关 | 默认继承后端语义 |
| `BACKEND_ADMIN_USER` | Nuxt 代理转发用户名 | `admin` |
| `BACKEND_ADMIN_PASSWORD` | Nuxt 代理转发密码 | 写代理开启时必填 |
| `BACKEND_BASE_URL` | Nuxt 访问后端的基地址 | `http://localhost:8080` |
| `GEMINI_API_KEY` | AI 对话 API Key | 未配置时聊天接口返回 500 |
| `CORS_ALLOWED_ORIGINS` | 后端 CORS 白名单 | `http://localhost:3000,http://127.0.0.1:3000` |

## 验证与测试

### 仓库级验证

```bash
./scripts/verify-local.sh
```

支持：
- `./scripts/verify-local.sh full` - 完整验证（后端测试 + 前端类型检查 + 前端构建）
- `./scripts/verify-local.sh frontend` - 仅前端验证
- `./scripts/verify-local.sh backend` - 仅后端验证
- `./scripts/verify-local.sh guardrails` - 代码规模检查

### 其他脚本

```bash
# 检查大文件阈值
./scripts/check-size-guardrails.sh

# 生成性能基线报告
./scripts/perf-baseline.sh

# 前端类型检查
cd frontend
npm run typecheck

# 前端生产构建
npm run build

# 迁移工单数据到 Postgres
npm run migrate:pipeline-ops

# 创建测试建筑（带 GLB 模型）
npm run seed:test-building
```

### 测试现状

后端已有测试：
- `WorkflowApplicationTests` - 应用启动测试
- `SecurityConfigTest` - 安全配置测试
- `WorkOrderRepositoryTest` - 工单仓储测试

前端当前以 `npm run typecheck` 和 `npm run build` 作为主要验证手段。

## 目录结构

```text
UniSpace-AI/
├── .env.example                    # 环境变量模板
├── docker-compose.yml              # Docker 配置
├── start.sh                        # 一键启动脚本
├── CLAUDE.md                       # 项目架构与开发指南
├── scripts/
│   ├── verify-local.sh            # 仓库级验证
│   ├── check-size-guardrails.sh   # 代码规模检查
│   └── perf-baseline.sh           # 性能基线测试
├── backend/
│   ├── build.gradle.kts
│   ├── src/main/java/com/jolt/workflow/
│   │   ├── config/                # CORS / 安全 / RequestId / 异常处理
│   │   ├── geo/                   # GeoJSON / Twin / 遥测
│   │   ├── pipelineops/           # 管网工单
│   │   └── property/              # 房产基础接口
│   ├── src/main/resources/
│   │   ├── application.properties
│   │   └── db/migration/          # Flyway 迁移脚本 V1~V10
│   └── src/test/
└── frontend/
    ├── pages/
    │   ├── index.vue              # 主地图
    │   ├── admin.vue              # 后台管理
    │   └── admin-pipe-editor.vue  # 管道编辑器
    ├── components/
    │   ├── MapView.vue            # Cesium 地图组件
    │   ├── ChatInterface.vue      # AI 对话组件
    │   └── admin/
    │       ├── AssetFeatureDialog.vue           # 资产表单
    │       ├── ModelCoordinatePickerDialog.vue  # 模型坐标编辑器
    │       ├── Pipe2DEditorDialog.vue           # 管道编辑器主容器
    │       └── ops/                             # 工单看板组件
    ├── composables/
    │   ├── admin/                 # 后台管理逻辑
    │   ├── property/              # 房产管理逻辑
    │   └── shared/                # 共享逻辑
    ├── services/                  # API 服务层
    ├── server/
    │   ├── api/                   # Nuxt Server API 路由
    │   ├── data/                  # 本地 JSON 数据
    │   └── utils/                 # 服务端工具
    ├── public/
    │   ├── map/                   # GeoJSON 样例数据
    │   └── models/                # GLB 3D 模型
    └── views/admin/               # 后台页面视图
```

## 开发提示

1. **写操作鉴权**：浏览器端的建筑与管道写操作统一走 Nuxt `/api/backend/*` 代理，并通过全局 Basic 鉴权弹层补充凭据
2. **管道图层映射**：Spring Boot 对外 API 名称是 `pipes`，实际数据库层复用 `geo_features.layer='roads'`
3. **房产模块状态**：房产业务大量是文件型原型实现（JSON 文件），”已实现”指页面与读写链路存在，不代表都已切到后端数据库
4. **性能优化**：地图采用按视口 bbox 分页加载，单次 800 条，最多 5 页，相机移动后 350ms 防抖加载
5. **草稿机制**：管道编辑器支持本地草稿自动保存（800ms 防抖 + 8s 定时），避免数据丢失
6. **审计日志**：所有编辑操作记录在 `edit_audit_log` 表，包含 before/after payload

## 常见问题

### 1. 后端启动失败：数据库连接错误
检查 `.env` 中的数据库配置，确保 PostgreSQL 已启动：
```bash
docker compose up -d
```

### 2. 前端启动失败：端口被占用
清理占用的端口：
```bash
lsof -ti:3000 | xargs kill -9
```

### 3. AI 对话返回 500 错误
检查 `.env` 中是否配置了 `GEMINI_API_KEY`

### 4. 写操作返回 401/403 错误
检查后端和前端的写鉴权配置是否一致：
- `APP_SECURITY_WRITE_AUTH_ENABLED`
- `BACKEND_WRITE_AUTH_ENABLED`
- `APP_ADMIN_PASSWORD` / `BACKEND_ADMIN_PASSWORD`

### 5. Mars3D 加载失败
检查 `node_modules/mars3d` 是否存在，清除 `.nuxt` 缓存重新构建：
```bash
cd frontend
rm -rf .nuxt
npm run dev
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature-name`
3. 提交更改：`git commit -m “feat: your message”`
4. 推送到分支：`git push origin feature/your-feature-name`
5. 提交 Pull Request

## 许可证

[MIT License](LICENSE)

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
