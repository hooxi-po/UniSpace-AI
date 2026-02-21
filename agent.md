# agent.md — UniSpace-AI 编码助手黄金手册（v2）

> 作用：给任何接手本仓库的编码助手一套“可执行、可验证、可交付”的统一规则。  
> 适用范围：`UniSpace-AI/` 全仓库（前端 + 后端 + 文档）。  
> 最后对齐时间：2026-02-21（基于当前代码状态）。

---

## 0) 先读 60 秒（最重要）

- 本仓库关键语义：**业务层 `pipes`，存储层 `roads`**。
- 主地图管道数据：后端 API `layers=pipes`，前端再分类为 `water/drain/sewage`。
- 管道渲染逻辑已组件化：`frontend/composables/shared/usePipeLayerLoader.ts`。
- 管道二维编辑已接入 Twin 链路：`drilldown / trace / telemetry / audit / write`。
- Twin 拓扑实体已扩展：`pipe_manholes / pipe_valves / pump_stations / building_floors / building_rooms`。
- 三类管道线宽统一：`5`。
- 改“语义/接口/地图行为”后，必须同步：
  - `README.md`
  - `开发日志.md`
  - 本文 `agent.md`

---

## 1) 不可违背规则（MUST）

1. **语义一致**：对外文案/API 优先使用 `pipes`；提到 `roads` 必须注明“存储层 roads”。
2. **职责分离**：复杂地图业务逻辑不得堆进 `MapView.vue`，优先抽到 `composables/shared/`。
3. **结构遵循**：新增前端文件必须遵守 `frontend/STRUCTURE.md`。
4. **变更可验证**：每次改动至少完成对应“最小验证”（见第 8 节）。
5. **文档同步**：功能/接口行为变化必须更新文档，不允许“代码已改文档未改”。
6. **小步改动**：只改当前任务必需文件，不顺手大面积重构。
7. **保持兼容**：已有 API 语义兼容（如 `pipes -> roads`）不得被无意移除。
8. **禁止虚构**：文档与说明必须对应仓库现状，不写未落地能力。

### 1.1 指令冲突裁决顺序（必须遵守）

当规则冲突时，按以下优先级执行：

1. 当前对话中的用户明确要求
2. 本文件 `agent.md`（仓库协作规则）
3. `README.md` / `frontend/STRUCTURE.md` / 其它说明文档
4. 历史习惯或个人偏好

若第 1 条与第 2 条冲突：
- 先执行用户要求
- 同时在交付说明中明确“与既有规则冲突点”与影响范围

---

## 2) 仓库与模块总览

- 前端：`frontend/`（Nuxt 3 + Cesium + Tailwind）
- 后端：`backend/`（Spring Boot 4 + JdbcTemplate + PostGIS）
- 启动脚本：`start.sh`
- 默认端口：前端 `3000`，后端 `8080`
- API 前缀：`/api/v1`

---

## 3) 领域词典（统一术语）

- **pipes（业务语义）**：前端地图与后台资产中心对外使用的管道图层名称。
- **roads（存储语义）**：`geo_features.layer` 中实际存储的道路层名。
- **pipeType**：前端给要素注入的分类字段，值为 `water|drain|sewage`。
- **可见性**：`geo_features.visible`，由后台资产中心开关写入。
- **Twin drilldown**：按要素返回段/节点/关系/关联楼宇的穿透视图。
- **Twin trace**：按上下游方向追踪管段拓扑路径。
- **Twin telemetry_latest**：按要素返回当前最新测点指标。

---

## 4) 当前真实实现快照

### 4.1 主地图数据流

1. `frontend/pages/index.vue` 维护图层状态：`water/sewage/drain/buildings/green`
2. `frontend/components/MapView.vue` 负责地图容器、拾取、高亮、编排
3. `frontend/composables/shared/usePipeLayerLoader.ts` 负责：
   - 请求 `GET /api/v1/features?layers=pipes&visible=true`
   - 按 `highway` 分类 `water/drain/sewage`
   - 注入 `properties.pipeType`
   - 应用统一管道样式（线宽 `5`）
4. 建筑层来自 `layers=buildings`，绿地仍来自 `/map/green.geojson`

### 4.2 后台资产中心

- 页面：`frontend/pages/admin.vue`
- 图层：`buildings` + `pipes`
- 表格：`frontend/components/admin/GeoFeatureTable.vue`
- 编辑/删除弹窗：`frontend/components/admin/AssetFeatureDialog.vue`、`frontend/components/admin/AssetDeleteDialog.vue`
- 行级操作组件：`frontend/components/admin/AssetRowActions.vue`、`frontend/components/admin/AssetVisibilitySwitch.vue`
- CRUD 状态编排：`frontend/composables/admin/useAssetCrud.ts`
- CRUD 请求封装：`frontend/services/geo-features.ts`
- 可见性接口：`PUT /api/v1/features/visibility`
- 资产 CRUD：`POST /api/v1/features`、`PUT /api/v1/features`、`DELETE /api/v1/features?id=...`

### 4.3 后端 Geo 接口核心

- 文件：`backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`
- `GET /features` 支持：`bbox/layers/limit/visible`
- `POST/PUT/DELETE /features` 支持资产中心新增/编辑/删除
- `PUT /features/visibility` 为可见性主接口（另保留 legacy path 兼容）
- `normalizeLayerName(...)` 当前映射：`pipes => roads`

### 4.4 管道 Twin（2D 编辑 + 拓扑 + 遥测 + 审计）

- 前端入口：`frontend/components/admin/Pipe2DEditorDialog.vue`
- 前端数据编排：`frontend/composables/admin/usePipe2DEditorData.ts`
- 前端 2D 几何交互：`frontend/composables/admin/usePipe2DEditorMap.ts`
- 请求封装：`frontend/services/twin.ts`
- 后端只读接口：`backend/src/main/java/com/jolt/workflow/geo/TwinController.java`
  - `GET /api/v1/twin/drilldown/{featureId}`
  - `GET /api/v1/twin/trace?startId=...&direction=up|down`
  - `GET /api/v1/twin/telemetry/latest?featureIds=...`
- 后端写接口：`backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java`
  - `PUT /api/v1/twin/pipes/{id}/geometry`
  - `PUT /api/v1/twin/pipes/{id}/properties`
  - `GET /api/v1/twin/audit/{featureId}?limit=...`
- 数据表迁移：
  - `V3__add_twin_topology_tables.sql`：`pipe_nodes / pipe_segments / asset_relations / telemetry_latest / edit_audit_log`
  - `V4__seed_twin_topology_and_telemetry.sql`：根据 `geo_features(layer='roads')` 回填拓扑与测点
  - `V5__add_twin_entity_tables.sql`：新增 `pipe_manholes / pipe_valves / pump_stations / building_floors / building_rooms`

---

## 5) 目录职责与代码落位

### 5.1 前端（严格遵守 `frontend/STRUCTURE.md`）

- `pages/`：路由入口，不堆复杂业务
- `views/`：页面级组件（`*View.vue`）
- `components/`：可复用组件（非页面）
- `composables/shared/`：跨域共享逻辑
- `services/`：请求封装，不放 Vue 状态

> 说明：存量代码存在历史例外；**新增代码必须按规范**，改存量时优先“就近收敛”。

### 5.2 地图模块红线

- 不在 `MapView.vue` 新增复杂分类规则。
- 不在多个组件重复写同一管道分类逻辑。
- 修改 `PIPE_LAYER_NAMES` 时必须同步：
  - `MapControls.vue` 图层按钮
  - `index.vue` 选中映射逻辑
  - 文档与验证命令

### 5.3 后端模块红线

- 不要移除 `pipes -> roads` 兼容映射（除非明确全链路升级）。
- 改 `listFeatures` SQL 时，必须检查参数顺序与占位符一致。
- 返回结构应保持 GeoJSON 兼容（`FeatureCollection` / `Feature`）。
- 改 Twin 写接口时，保持“几何写入 + 拓扑同步 + 审计日志”事务语义。
- `resolvePipeFeatureId(...)` 需兼容“featureId 或 segmentId”两种输入。

---

## 6) 任务决策树（编码助手执行路径）

### 6.1 如果需求是“改地图表现”

1. 先判断：是样式问题还是数据来源/分类问题
2. 样式优先改 `usePipeLayerLoader.ts`
3. 仅编排层改动放 `MapView.vue`
4. 验证：页面显示 + `curl layers=pipes`
5. 同步文档（至少 `开发日志.md`）

### 6.2 如果需求是“改后端接口行为”

1. 改 `GeoFeatureController`
2. 校验 `layers=pipes` 是否仍可用
3. 用 `curl` 验证 `layers/visible/bbox/limit` 组合
4. 回归 `admin` + 主地图联调

### 6.3 如果需求是“结构重构/组件化”

1. 先对照 `frontend/STRUCTURE.md` 决定目标目录
2. 优先抽共享逻辑到 `composables/shared/`
3. 保持外部接口（props/emit）不破坏
4. 补文档（结构变化必须写）

### 6.4 如果需求是“改管道二维编辑 / Twin 追踪”

1. 前端优先改 `usePipe2DEditorData.ts` / `usePipe2DEditorMap.ts`，`Pipe2DEditorDialog.vue` 仅保留编排
2. 后端优先改 `TwinController` / `TwinWriteController`，避免把 Twin 逻辑塞回 `GeoFeatureController`
3. 保留写接口 fallback 行为（Twin 写失败时可回退到 `geoFeatureService.update`）
4. 验证至少覆盖：drilldown + trace + telemetry + audit + geometry write
5. 同步文档（`开发日志.md`，必要时 `README.md`）

### 6.5 如果需求描述不完整（默认处理）

1. 优先按“最小可行改动”实现，不阻塞主流程
2. 对不确定项采用向后兼容策略（不破坏现有接口）
3. 在交付说明里列出“假设清单”与可选后续方案
4. 若会引发破坏性变更，先停下并请求用户确认

---

## 7) 常见任务改动地图（文件定位）

### 7.1 管道分类规则

- `frontend/composables/shared/usePipeLayerLoader.ts`
- 可能联动：`frontend/pages/index.vue`（选中映射）

### 7.2 管道显示样式（颜色/线宽/发光）

- `frontend/composables/shared/usePipeLayerLoader.ts`

### 7.3 地图图层开关或默认状态

- `frontend/pages/index.vue`
- `frontend/components/MapControls.vue`
- `frontend/components/MapView.vue`

### 7.4 后台资产中心字段或图层

- `frontend/pages/admin.vue`
- `frontend/components/admin/GeoFeatureTable.vue`
- `frontend/utils/admin-tables.ts`

### 7.5 API 过滤与映射

- `backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`

### 7.6 Twin 穿透/追踪/编辑

- `frontend/components/admin/Pipe2DEditorDialog.vue`
- `frontend/composables/admin/usePipe2DEditorData.ts`
- `frontend/composables/admin/usePipe2DEditorMap.ts`
- `frontend/services/twin.ts`
- `backend/src/main/java/com/jolt/workflow/geo/TwinController.java`
- `backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java`

### 7.7 改动影响矩阵（快速判断）

- 改 `usePipeLayerLoader.ts`：影响地图管道展示、分类、选中映射（需回归 `index.vue`）
- 改 `MapView.vue`：影响图层加载与拾取（需回归图层开关 + 高亮）
- 改 `GeoFeatureController.java`：影响主地图与后台资产中心（需双页面回归）
- 改 `TwinController.java`：影响二维编辑器的穿透/追踪/遥测侧栏（需回归 `/admin` 二维编辑）
- 改 `TwinWriteController.java`：影响几何保存、拓扑同步、审计日志（需回归“保存后立即重载”链路）
- 改 `admin-tables.ts`：影响后台字段展示与搜索（需回归 `/admin`）
- 改 `start.sh` / `frontend/package.json`：影响全员启动链路（需记录到 `README.md`）

---

## 8) 改动-验证矩阵（DoD 核心）

### 8.1 改前端地图（样式/分类/图层）

**至少执行：**

```bash
curl -s "http://localhost:8080/api/v1/features?layers=pipes&limit=1"
```

并在浏览器确认：
- 地图可打开（`http://localhost:3000`）
- 三类管道可切换显示
- 点击实体后右侧详情不报错

### 8.2 改后端 `GeoFeatureController`

**至少执行：**

```bash
curl -s "http://localhost:8080/api/v1/features?layers=pipes&limit=1"
curl -s "http://localhost:8080/api/v1/features?layers=buildings&limit=1"
curl -s "http://localhost:8080/api/v1/features?layers=pipes&visible=true&limit=1"
```

### 8.3 改后台资产中心

- 打开 `/admin`
- 资产中心切到“建筑/管道”都能出数据
- `visible` 开关可写回且刷新后生效
- 新增/编辑/删除操作可成功写回并刷新列表

### 8.4 改 Twin 接口 / 二维管道编辑

**至少执行：**

```bash
curl -s "http://localhost:8080/api/v1/twin/drilldown/way/25598484" | head -c 400
curl -s "http://localhost:8080/api/v1/twin/trace?startId=way/25598484&direction=down" | head -c 400
curl -s "http://localhost:8080/api/v1/twin/telemetry/latest?featureIds=way/25598484" | head -c 400
curl -s "http://localhost:8080/api/v1/twin/audit/way/25598484?limit=5" | head -c 400
```

并在 `/admin` -> 资产中心 -> 管道数据 -> 二维地图编辑确认：
- 管道列表可加载且可检索
- 拖拽点位后可保存几何
- 保存后“穿透信息 / 下游追踪 / 实时测点 / 编辑审计”有响应且不报错

### 8.5 改启动/构建链路

**至少执行：**

```bash
cd frontend && npm run build
```

如果涉及 Nuxt 运行时异常，再执行：

```bash
cd frontend
rm -rf .nuxt
npm run dev
```

### 8.6 验证失败时的闭环要求

- 必须在交付说明中写清：失败命令、报错摘要、已尝试修复动作
- 若失败与本次改动无关，需明确“已确认为历史问题/环境问题”
- 禁止跳过验证直接宣称“已完成”

---

## 9) 已知问题与稳定修复

### 9.1 Nuxt 内部别名报错

- 现象：`#internal/nuxt/paths` 未定义
- 修复脚本：`frontend/scripts/ensure-nuxt-internal.mjs`
- 已挂载：`dev/build/postinstall`
- 辅助兜底：`frontend/nuxt.config.ts` 中对 `#app-manifest` 的 fallback alias

### 9.2 端口冲突

- `start.sh` 启动前会检查 `3000/8080`
- 冲突需先释放端口，再启动

### 9.3 Jackson 体系混用风险

- Boot 4 侧优先 `tools.jackson.*`
- `GeoFeatureRow` 仍有 `com.fasterxml` 历史类型，修改相关代码时注意统一

### 9.4 前端热更新栈溢出风险（历史出现过）

- 现象：`Maximum call stack size exceeded`（Vite transform 链）
- 高风险操作：在 `frontend/package.json` 里添加不当 `imports` 别名映射
- 当前稳定策略：使用 `scripts/ensure-nuxt-internal.mjs` 补丁，不在项目 `package.json` 增加该内部别名

### 9.5 Twin 拓扑回填边界

- `TwinWriteController` 的几何同步要求目标要素可归一为线几何（`LineString/MultiLineString`）
- 若数据是非线要素或线合并失败，会出现 `line_geometry_required` / `topology_sync_failed`
- 遇到该类报错，优先检查 `geo_features.layer='roads'` 且 geometry 类型正确

---

## 10) 文档同步规则（强制）

满足任一条件时，必须更新 `开发日志.md`：

- 接口行为变化
- 地图图层语义变化
- 可见性/分类规则变化
- 启动链路与排障方式变化

满足任一条件时，建议同步 `README.md`：

- 对外使用方式变化（命令、接口、访问路径）
- 新增关键模块或脚本

满足任一条件时，必须同步 `agent.md`：

- 核心数据流变化
- 关键文件职责变化
- 不可违背规则变化

### 10.1 文档同步最小矩阵

- 改接口参数/返回结构：更新 `README.md` + `开发日志.md`
- 改地图图层语义/样式：更新 `README.md` + `开发日志.md` + `agent.md`
- 改 Twin 拓扑/写接口/审计行为：更新 `README.md` + `开发日志.md` + `agent.md`
- 改目录结构/组件职责：更新 `frontend/STRUCTURE.md` + `agent.md`
- 改启动命令或脚本：更新 `README.md` + `开发日志.md`

---

## 11) 交付完成定义（Definition of Done）

一次任务仅在以下全部满足后才算完成：

1. 代码实现与需求一致
2. 无明显结构违例（符合 `frontend/STRUCTURE.md`）
3. 通过对应“最小验证”（第 8 节）
4. 文档已同步（至少 `开发日志.md`）
5. 说明中明确了 `pipes/roads` 语义（如涉及图层）
6. 交付说明包含“验证证据”（命令或页面验证结果）

---

## 12) 快速命令手册

```bash
# 一键启动
./start.sh

# 后端独立启动
cd backend && ./gradlew bootRun

# 前端独立启动
cd frontend && npm ci || npm install && npm run dev

# 最小 API 验证
curl -s "http://localhost:8080/api/v1/features?layers=pipes&limit=1"
curl -s "http://localhost:8080/api/v1/features?layers=buildings&limit=1"
curl -s "http://localhost:8080/api/v1/twin/drilldown/way/25598484" | head -c 200
curl -s "http://localhost:8080/api/v1/twin/trace?startId=way/25598484&direction=down" | head -c 200
```

---

## 13) 高价值文件索引

- 启动脚本：`start.sh`
- 前端地图容器：`frontend/components/MapView.vue`
- 管道共享逻辑：`frontend/composables/shared/usePipeLayerLoader.ts`
- 主页面状态：`frontend/pages/index.vue`
- 后台资产中心：`frontend/pages/admin.vue`
- 后端 GeoJSON API：`backend/src/main/java/com/jolt/workflow/geo/GeoFeatureController.java`
- 二维管道编辑器：`frontend/components/admin/Pipe2DEditorDialog.vue`
- Twin 前端请求封装：`frontend/services/twin.ts`
- Twin 只读接口：`backend/src/main/java/com/jolt/workflow/geo/TwinController.java`
- Twin 写接口：`backend/src/main/java/com/jolt/workflow/geo/TwinWriteController.java`
- 数据库迁移：
  - `backend/src/main/resources/db/migration/V1__init_postgis_and_features.sql`
  - `backend/src/main/resources/db/migration/V2__add_visibility_to_geo_features.sql`
  - `backend/src/main/resources/db/migration/V3__add_twin_topology_tables.sql`
  - `backend/src/main/resources/db/migration/V4__seed_twin_topology_and_telemetry.sql`
  - `backend/src/main/resources/db/migration/V5__add_twin_entity_tables.sql`
- 前端结构规范：`frontend/STRUCTURE.md`
- 变更记录：`开发日志.md`

---

## 14) 分支与提交建议

- 主开发分支：`develop`
- 推荐功能分支：`feature/<task-name>`
- 仓库历史存在 `feture/...` 拼写分支，兼容即可，不建议继续扩散

推荐流程：

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<task-name>
```

提交信息建议：

- `feat:` 新功能
- `fix:` 缺陷修复
- `refactor:` 重构（无功能变化）
- `docs:` 文档更新

---

## 15) 禁止事项（DON'T）

- 不要把临时调试输出与 TODO 注释直接提交
- 不要提交运行时产物（如 `.start.pid`、`.nuxt`）
- 不要在未说明影响面的情况下改公共接口语义
- 不要在单个任务中夹带无关重构

---

> 维护建议：每次完成“地图语义 / API 行为 / 启动链路”任一类变更后，优先更新本文件第 4、8、9、10、11 节，保持它始终可执行。


## 16) 标准交付模板（建议助手按此输出）

1. 变更摘要：改了什么、为什么改
2. 关键文件：列出文件路径
3. 验证结果：执行了哪些命令/页面验证
4. 风险与后续：是否有遗留风险、建议下一步

> 目标：让每次交付都“可复盘、可追踪、可继续迭代”。
