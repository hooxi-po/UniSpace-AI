# UniSpace-AI 项目指南

> 本文档为 Claude 提供项目架构、约定和最佳实践的持久化指导。

## 项目概述

UniSpace-AI 是一个基于 GIS 和数字孪生技术的校园地下管网运维系统，采用前后端分离架构。

**技术栈**：
- 前端：Nuxt 3 + Vue 3 + Cesium（3D 地图）+ Mars3D（2D 编辑器）+ TailwindCSS
- 后端：Spring Boot 4 + PostgreSQL/PostGIS + Flyway
- AI：Gemini（通过 Nuxt server 代理）

## 架构设计原则

### 后端架构

1. **Controller-Repository 模式**
   - 没有传统的 Service 层
   - Repository 直接处理业务逻辑和数据访问
   - 使用 `JdbcTemplate` 而非 JPA/Hibernate

2. **数据库端 JSON 构造**
   - 利用 PostgreSQL 的 `jsonb_build_object` 和 `jsonb_agg` 在数据库层直接生成 GeoJSON
   - 避免 Java 侧大量序列化开销
   - 示例：`GeoFeatureController.listFeatures()`

3. **图层别名映射**
   - API 语义：`pipes`（管道）
   - 存储层：`roads`（道路）
   - 映射逻辑：`GeoFeatureController.normalizeLayerName()`

4. **安全策略**
   - GET 请求公开访问
   - POST/PUT/DELETE 需要 HTTP Basic 认证
   - 可通过环境变量关闭认证（开发环境）
   - 配置：`SecurityConfig.java`

### 前端架构

1. **状态管理模式**
   - 主页面（`pages/index.vue`）作为"状态源头"
   - 通过 props 向下传递状态给子组件
   - 使用 Composition API + Composables 复用逻辑

2. **服务层封装**
   - `services/` 目录统一封装 API 调用
   - `geo-features.ts`：空间要素 CRUD
   - `twin.ts`：数字孪生数据（drilldown/trace/telemetry）
   - `pipeline-ops.ts`：工单系统

3. **Nuxt Server 代理**
   - `server/api/` 处理写鉴权和 CORS
   - 前端写操作统一走 `/api/backend/*` 或 `/api/pipeline-ops/*`
   - 自动附加 HTTP Basic Auth

4. **地图渲染策略**
   - 使用多个 `CustomDataSource` 管理不同图层
   - 动态加载：按视口 bbox 分页拉取（800 条/页，最多 5 页）
   - 防抖机制：相机移动后 350ms 才重新加载

## 代码组织结构

### 后端目录结构

```
backend/src/main/java/com/jolt/workflow/
├── config/              # 配置类
│   ├── CorsConfig.java
│   ├── SecurityConfig.java
│   └── GlobalExceptionHandler.java
├── geo/                 # 空间要素相关
│   ├── GeoFeatureController.java
│   ├── TwinController.java
│   ├── TwinWriteController.java
│   └── Module2TelemetryController.java
└── pipelineops/         # 工单系统
    ├── PipelineOpsController.java
    ├── WorkOrderRepository.java
    └── WorkOrderRepositorySupport.java
```

### 前端目录结构

```
frontend/
├── pages/               # 路由页面
│   ├── index.vue        # 主地图（3D Cesium）
│   ├── admin.vue        # 后台大厅
│   └── admin-pipe-editor.vue  # 独立管道编辑器页面
├── components/          # UI 组件
│   ├── MapView.vue      # 地图容器
│   ├── ChatInterface.vue
│   └── admin/           # 后台组件
│       ├── Pipe2DEditorDialog.vue  # 管道编辑器主容器
│       ├── pipe2d-editor/          # 编辑器子组件
│       └── ops/                    # 工单看板组件
├── composables/         # 逻辑复用
│   ├── admin/
│   │   ├── usePipe2DEditorMap.ts      # 地图交互
│   │   ├── usePipe2DEditorData.ts     # 数据管理
│   │   ├── usePipe2DEditorDrafts.ts   # 草稿管理
│   │   ├── usePipe2DEditorWorkspace.ts # 工作区状态
│   │   ├── usePipe2DEditorGraph.ts    # 图结构编辑
│   │   └── usePipelineOpsBoard.ts     # 工单看板
│   └── shared/
│       ├── usePipeLayerLoader.ts      # 管道图层加载
│       ├── useMapViewSelection.ts     # 地图选择
│       └── useMapViewWorkorderHeat.ts # 工单热力图
├── services/            # API 封装
│   ├── geo-features.ts
│   ├── twin.ts
│   └── pipeline-ops.ts
├── server/api/          # Nuxt server 路由
│   ├── backend/         # 后端代理
│   ├── pipeline-ops/    # 工单代理
│   └── chat.post.ts     # AI 聊天
└── utils/               # 工具函数
    ├── mars3d-loader.ts      # Mars3D 懒加载
    ├── pipe2d-geometry.ts    # 几何计算
    ├── pipe2d-graph.ts       # 图结构定义
    └── map-view-helpers.ts   # 地图辅助函数
```

## 数据库设计

### 核心表

1. **geo_features**（空间要素表）
```sql
CREATE TABLE geo_features (
    id TEXT PRIMARY KEY,
    layer TEXT NOT NULL,                    -- buildings/roads/green
    geom geometry(GEOMETRY, 4326) NOT NULL, -- PostGIS 几何
    properties JSONB NOT NULL,              -- 灵活属性
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
-- 索引：GIST (geom), GIN (properties)
```

2. **work_order**（工单表）
```sql
CREATE TABLE work_order (
    id TEXT PRIMARY KEY,
    order_type TEXT CHECK (order_type IN ('inspection', 'maintenance', 'retrofit', 'retire')),
    status TEXT CHECK (status IN ('draft', 'todo', 'assigned', 'in_progress', ...)),
    topology_chain JSONB,      -- 拓扑链路
    node_ids JSONB,            -- 关联节点
    segment_ids JSONB,         -- 关联管段
    impact_scope JSONB,        -- 影响范围
    ...
);
```

3. **Twin 拓扑表**（V3 迁移）
- `pipe_nodes`：管网节点
- `pipe_segments`：管段
- `asset_relations`：资产关系
- `telemetry_latest`：最新测点数据
- `edit_audit_log`：编辑审计日志

## 管道编辑器架构（重点）

### 组件层次结构

```
Pipe2DEditorDialog.vue (主容器)
├── Pipe2DEditorTopbarSection.vue      # 顶栏（标题/保存状态/撤销重做）
├── Pipe2DEditorToolbarSection.vue     # 左侧工具栏
├── Pipe2DEditorStageSection.vue       # 中央画布区
├── Pipe2DEditorRightPanelSection.vue  # 右侧属性面板
├── Pipe2DEditorStatusbarSection.vue   # 底部状态栏
└── Pipe2DEditorShortcutHelp.vue       # 快捷键帮助
```

### Composables 职责划分

1. **usePipe2DEditorMap.ts**（地图交互核心）
   - Mars3D 地图初始化和销毁
   - 相机控制（缩放/平移/2D-3D 切换）
   - 节点/线段的拾取和拖拽
   - 撤销/重做历史管理
   - 右键菜单
   - 吸附提示
   - 图结构编辑（Phase 1+2）

2. **usePipe2DEditorData.ts**（数据管理）
   - 加载管道列表
   - 并行拉取 Twin 数据（drilldown/trace/telemetry/audit）
   - 保存几何到后端（优先 Twin API，失败回退到 GeoFeature）
   - 错误处理

3. **usePipe2DEditorDrafts.ts**（草稿管理）
   - 本地 localStorage 自动保存（800ms 防抖 + 8s 定时）
   - 切换管道时自动读写草稿
   - 草稿状态提示

4. **usePipe2DEditorWorkspace.ts**（工作区状态）
   - 工具栏拖拽
   - 视图模式切换
   - 项目标题编辑
   - 快捷键绑定
   - 画布样式管理

5. **usePipe2DEditorGraph.ts**（图结构编辑）
   - 节点（Node）和边（Edge）的增删改查
   - 节点类型：default/valve/pump/meter
   - 边类型：straight/curve
   - 与 Lines 数据结构的双向同步

6. **useMindmapEditor.ts**（思维导图交互）
   - 节点创建：createNodeAt、createChildNode、createSiblingNode
   - 节点删除：deleteSelected
   - 边操作：createEdge、toggleEdgeCurve
   - 选中和悬停状态管理

7. **useMindmapEditorEvents.ts**（事件处理）
   - 键盘快捷键：Tab、Enter、Delete、Ctrl+Z/Y、Ctrl+A、ESC
   - 鼠标交互：双击、单击、多选、拖拽
   - 悬停检测：50ms 防抖优化

8. **pipe2d-editor/usePipe2DEditorMapGraphics.ts**（图元渲染）
   - 草稿线/点渲染
   - Mars3D 图层同步
   - 编辑态图元回写
   - 多级视觉反馈（光晕/轮廓/标签/徽章）
   - 连接点渲染（四方向）
   - 悬停效果

9. **pipe2d-editor/usePipe2DEditorMapInteractions.ts**（交互逻辑）
   - 选中/插点/删点
   - 右键菜单
   - 吸附提示
   - 长度 hover
   - 撤销/重做
   - 键盘快捷键

10. **pipe2d-editor/pipe2d-editor-map-shared.ts**（共享辅助）
    - 地图层共享类型
    - 缩放/测长辅助
    - 命中辅助函数

### 数据流

```
用户操作 → usePipe2DEditorMap（交互）
         ↓
    draftLines（响应式状态）
         ↓
    renderDraftGraphics（渲染）
         ↓
    Mars3D GraphicLayer（显示）
```

### 保存流程

```
用户点击保存
    ↓
usePipe2DEditorData.saveGeometry()
    ↓
优先调用 twinService.updatePipeGeometry()
    ↓ (失败)
回退到 geoFeatureService.update()
    ↓
更新本地 pipes 数组
    ↓
清空历史记录
    ↓
清除本地草稿
    ↓
重新加载 Twin 数据
```

### 草稿机制

1. **自动保存时机**
   - 用户编辑后 800ms 防抖
   - 每 8 秒定时保存
   - 切换管道前自动保存

2. **存储格式**
```typescript
localStorage.setItem(`pipe2d-draft-${featureId}`, JSON.stringify({
  lines: draftLines.value,
  graph: editorGraph.graph.value,
  timestamp: Date.now()
}))
```

3. **恢复逻辑**
   - 切换到管道时检查是否有草稿
   - 如果草稿比服务端新，自动恢复
   - 显示"已恢复草稿"提示

### 图结构编辑与思维导图式交互

**设计思路**：
- 传统编辑：直接操作 Lines（坐标数组）
- 图结构编辑：操作 Nodes（节点）和 Edges（边）
- 思维导图模式：XMind/Miro 风格的直接操作体验
- 三种模式可以共存，通过 `editorGraph.initFromLines()` 和 `editorGraph.toLines()` 互相转换

**节点类型**：
- `default`：普通节点
- `valve`：阀门
- `pump`：泵站
- `meter`：测点

**边类型**：
- `straight`：直线
- `curve`：曲线（贝塞尔）

**核心 Composables**：

1. **usePipe2DEditorGraph.ts**（图结构管理）
   - 节点和边的增删改查
   - 与 Lines 数据结构的双向同步
   - 图结构验证和完整性检查

2. **useMindmapEditor.ts**（思维导图交互）
   - 节点创建：`createNodeAt`、`createChildNode`、`createSiblingNode`
   - 节点删除：`deleteSelected`
   - 边操作：`createEdge`、`toggleEdgeCurve`
   - 选中状态管理：`selectedNodeIds`、`selectedEdgeIds`
   - 悬停状态管理：`hoveredNodeId`、`hoveredEdgeId`

3. **useMindmapEditorEvents.ts**（事件处理）
   - 键盘快捷键：Tab、Enter、Delete、Ctrl+Z/Y、Ctrl+A、ESC
   - 鼠标交互：双击、单击、多选、拖拽
   - 悬停检测：50ms 防抖优化

4. **usePipe2DEditorMapGraphics.ts**（视觉反馈）
   - 多级视觉反馈：光晕 + 轮廓 + 标签 + 徽章
   - 连接点渲染：四方向（上/右/下/左）
   - 悬停效果：节点 13px + 3px 边框，边 4px 宽度
   - 性能优化：条件渲染、防抖、requestAnimationFrame

**视觉反馈层次**：
- 选中光晕：24px 半透明圆圈
- 节点轮廓：选中 4px / 悬停 3px / 默认 2px
- 节点大小：选中 16px / 悬停 13px / 默认 10px
- 标签增强：选中时显示节点类型标签
- 徽章显示：选中时显示连接数徽章
- 连接点：仅在选中或悬停时显示，12x12 像素

**性能指标**：
- 100 节点场景：55-60 FPS
- 防抖优化：50ms 悬停检测
- 渲染优化：requestAnimationFrame 节流

## 工单系统架构

### 状态机

```
draft → todo → assigned → in_progress → review → completed → closed
         ↓                      ↓
      cancelled              paused
```

### 查询优化

**问题**：快速切换筛选条件时，旧响应可能覆盖新状态

**解决方案**：使用 `refreshRequestId`
```typescript
let refreshRequestId = 0
async function refresh() {
  const requestId = ++refreshRequestId
  const [workorders, stats, dashboard] = await Promise.all([...])
  if (requestId !== refreshRequestId) return  // 丢弃过期响应
  list.value = workorders.list
}
```

### 影响范围计算

工单创建时，后端自动计算影响范围：
1. 根据 `nodeIds` 和 `segmentIds` 查询 `asset_relations`
2. 找到关联的 `buildingId`
3. 查询 `building_floors` 和 `building_rooms`
4. 写入 `order_building_link` 表

## 编码约定

### 命名规范

1. **后端**
   - Controller：`XxxController`
   - Repository：`XxxRepository`
   - 常量：`UPPER_SNAKE_CASE`
   - 方法：`camelCase`

2. **前端**
   - 组件：`PascalCase.vue`
   - Composables：`useCamelCase.ts`
   - 服务：`kebab-case.ts`
   - 常量：`UPPER_SNAKE_CASE`

### 类型定义

1. **GeoJSON Feature**
```typescript
type GeoJsonFeature = {
  id: string | number
  type: 'geojson'
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiLineString' | ...
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}
```

2. **Lines（管道几何）**
```typescript
type Point = [number, number]  // [lon, lat]
type Line = Point[]
type Lines = Line[]  // MultiLineString
```

3. **工单类型**
```typescript
type PipelineOrderType = 'inspection' | 'maintenance' | 'retrofit' | 'retire'
type PipelineOrderStatus = 'draft' | 'todo' | 'assigned' | 'in_progress' | 'paused' | 'review' | 'completed' | 'closed' | 'cancelled' | 'rejected'
```

### 错误处理

1. **后端**
```java
// 使用自定义异常
throw new WorkOrderRepository.PipelineOpsException(400, "id_required");

// 全局异常处理器
@ExceptionHandler(PipelineOpsException.class)
public ResponseEntity<JsonNode> handlePipelineOpsException(...)
```

2. **前端**
```typescript
// 统一错误提示
actionMessage.value = { type: 'error', text: getErrorMessage(err, '默认消息') }

// Promise.allSettled 处理并行请求
const [result1, result2] = await Promise.allSettled([...])
if (result1.status === 'fulfilled') { ... }
```

## 性能优化

### 后端

1. **数据库索引**
   - 空间索引：`GIST (geom)`
   - JSONB 索引：`GIN (properties)`
   - 复合索引：`(layer, visible)`

2. **查询优化**
   - 使用 `ST_MakeEnvelope` 进行 bbox 过滤
   - 限制单次查询数量（max 5000）
   - 分页查询

### 前端

1. **地图渲染**
   - 视口外的实体不渲染
   - 使用 `DistanceDisplayCondition` 控制显示距离
   - 防抖加载（350ms）

2. **草稿保存**
   - 800ms 防抖
   - 只保存变化的数据
   - 使用 `localStorage`（同步操作）

3. **组件懒加载**
   - Mars3D 懒加载：`utils/mars3d-loader.ts`
   - 动态 import：`const mod = await import('mars3d')`

## 测试策略

### 后端测试

1. **单元测试**
   - Repository 测试：`WorkOrderRepositoryTest.java`
   - 使用 `@DataJpaTest` 或 `@SpringBootTest`

2. **集成测试**
   - API 测试：使用 `MockMvc` 或 `RestAssured`
   - 数据库测试：使用 Testcontainers

### 前端测试

1. **类型检查**
```bash
npm run typecheck
```

2. **构建验证**
```bash
npm run build
```

3. **仓库级验证**
```bash
./scripts/verify-local.sh
```

## 部署

### 环境变量

**后端**：
- `DB_URL`：数据库连接
- `DB_PASSWORD`：数据库密码
- `APP_SECURITY_WRITE_AUTH_ENABLED`：是否启用写鉴权
- `APP_ADMIN_PASSWORD`：管理员密码

**前端**：
- `GEMINI_API_KEY`：Gemini API 密钥（必需）
- `NUXT_PUBLIC_BACKEND_BASE_URL`：后端地址
- `BACKEND_WRITE_AUTH_ENABLED`：是否启用写鉴权
- `BACKEND_ADMIN_PASSWORD`：管理员密码

### 一键启动

```bash
cp .env.example .env
# 编辑 .env 配置必需的环境变量
chmod +x start.sh
./start.sh
```

## 常见问题

### 1. Mars3D 加载失败

**原因**：网络问题或 chunk 加载失败

**解决**：
- 检查 `node_modules/mars3d` 是否存在
- 清除 `.nuxt` 缓存重新构建
- 使用本地 npm 模式（已配置）

### 2. 草稿丢失

**原因**：localStorage 被清除或浏览器隐私模式

**解决**：
- 定期保存到服务端
- 提示用户不要清除浏览器数据

### 3. 工单查询慢

**原因**：缺少索引或查询条件过宽

**解决**：
- 检查 `work_order` 表的索引
- 限制日期范围
- 使用分页

### 4. 地图卡顿

**原因**：实体数量过多

**解决**：
- 减小 `DYNAMIC_LAYER_PAGE_SIZE`
- 减小 `DYNAMIC_LAYER_MAX_PAGES`
- 使用聚合显示

## 下一步建议

1. **实时协同**
   - WebSocket 推送工单状态变更
   - 多人同时编辑管道时的冲突检测

2. **权限系统**
   - 角色化权限（admin/operator/viewer）
   - 细粒度权限控制（按区域/按类型）

3. **性能监控**
   - 前端性能指标（FPS/加载时间）
   - 后端 API 响应时间
   - 数据库慢查询日志

4. **移动端适配**
   - 响应式布局
   - 触摸手势支持
   - 离线模式

5. **数据导入导出**
   - 批量导入管道数据
   - 导出工单报表
   - GeoJSON/Shapefile 互转

---

**最后更新**：2026-03-28
