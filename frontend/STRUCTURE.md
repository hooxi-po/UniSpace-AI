# Frontend 目录结构规范

## 核心原则

### 1) pages/ 只放路由入口
- `pages/index.vue`：地图主页面
- `pages/admin.vue`：后台管理入口（通过三层 tab 动态加载页面组件）

### 2) views/ 只放页面级组件
- **定义**：由路由或动态组件（如 admin.vue 的 `adminCompMap`）直接加载的“页面”
- **命名**：统一使用 `*View.vue` 后缀，便于与 components 区分
- **结构**：
  ```
  views/
    admin/
      property/
        charging/
          BillsView.vue
          OverviewView.vue
          ...
        sections/
          PropertyChargingView.vue   # 二级容器/分组页面
          ...
  ```

### 3) components/ 只放可复用组件
- **定义**：跨 2 个页面以上复用的 UI 组件
- **禁止**：禁止在 `components/` 下放“页面级组件”
- **命名**：PascalCase，如 `BillsTable.vue`、`BaseDialog.vue`
- **结构**：
  ```
  components/
    admin/
      property/
        charging/
          components/
            BillsTable.vue
            BillsFilters.vue
            BillDetailDrawer.vue
    shared/
      ui/
        BaseTable.vue
        BaseDialog.vue
      map/
        MapView.vue
  ```

#### 3.1 admin/ops 例外说明
- `components/admin/ops/` 允许放“单个后台业务域内部复用”的区块组件，即使暂时只被 `PipelineOpsBoard.vue` 使用。
- 原因：`pipeline-ops` 是一个复杂后台工作流界面，主壳组件只负责状态编排，统计区、建单区、列表区、详情区、动作弹层必须拆成子组件维护。
- 当前参考实现：
  - `PipelineOpsBoard.vue`：编排壳
  - `PipelineOpsOverviewSection.vue`：标题/统计/Dashboard
  - `PipelineOpsCreateSection.vue`：人工建单/自动建单
  - `PipelineOpsListSection.vue`：筛选 + 表格 + 分页
  - `PipelineOpsActionDialog.vue`：分配/驳回动作弹层
  - `PipelineOpsDetailPanel.vue`：详情抽屉容器

#### 3.2 components/common 用途
- `components/common/` 放跨业务域的基础交互组件，优先承载“全局但非纯 UI 库级”的组件。
- 当前已落地：
  - `ProxyWriteAuthDialog.vue`：Nuxt 写代理鉴权的全局弹层
- 如果某个组件被多个业务域共享，优先放 `components/common/`，不要复制到各业务目录。

### 4) composables/ 按层级分
- **shared/**：通用 hooks（`useTable`、`usePagination`、`useDialog`）与跨页面地图能力（如 `usePipeLayerLoader`）
- **admin/**：admin 域专用 hooks
- **admin/pipe2d-editor/**：二维编辑器地图层内部拆分模块，允许放单一工作流内部复用的交互/渲染辅助
- **property/**：房产域专用 hooks（如 `useFixationApply`、`useChargingBills`）

### 5) services/ 只放 API 请求封装
- 不包含 Vue 状态，只做 fetch/参数/错误处理
- 按业务域分文件：`services/fixation.ts`、`services/charging.ts`

---

## 已迁移文件（2026-02-06）

### 从 components/ 迁移到 views/
- `admin/property/charging/*` → `views/admin/property/charging/*View.vue`
- `admin/property/fixation/*` → `views/admin/property/fixation/*View.vue`
- `admin/property/allocation/*` → `views/admin/property/allocation/*View.vue`
- `admin/property/operating/*` → `views/admin/property/operating/*View.vue`
- `admin/property/apartments/*` → `views/admin/property/apartments/*View.vue`
- `admin/property/services/*` → `views/admin/property/services/*View.vue`
- `admin/property/inventory/*` → `views/admin/property/inventory/*View.vue`
- `admin/property/query/*` → `views/admin/property/query/*View.vue`
- `admin/property/reports/*` → `views/admin/property/reports/*View.vue`
- `admin/property/Property*.vue` → `views/admin/property/sections/Property*View.vue`

### 已清理目录
- `components/admin/property/` 已删除

---

## 后续新增文件指南

### 新页面
- 路径：`views/admin/property/<domain>/<PageName>View.vue`
- 在 `config/admin-comp-map.ts` 中注册
- 变量名统一为 `*View`，保持与文件名一致

### 新可复用组件
- 路径：`components/admin/property/<domain>/components/<ComponentName>.vue`
- 或者：`components/shared/ui/<ComponentName>.vue`
- 工单后台区块：`components/admin/ops/<ComponentName>.vue`
- 跨域全局弹层/提示：`components/common/<ComponentName>.vue`

### 新 composable
- 通用：`composables/shared/use<Name>.ts`
- 域专用：`composables/<domain>/use<Name>.ts`
- 地图管道加载/分类/样式逻辑：`composables/shared/usePipeLayerLoader.ts`（避免堆在 `MapView.vue`）
- 二维编辑器地图交互分层：
  - 编排壳：`composables/admin/usePipe2DEditorMap.ts`
  - 地图交互/命中/快捷键：`composables/admin/pipe2d-editor/usePipe2DEditorMapInteractions.ts`
  - 地图图元渲染/同步：`composables/admin/pipe2d-editor/usePipe2DEditorMapGraphics.ts`
  - 地图共享类型/缩放/命中辅助：`composables/admin/pipe2d-editor/pipe2d-editor-map-shared.ts`

### 新 service
- 路径：`services/<domain>.ts`
- 只封装请求，不包含 Vue 状态

---

## 地图模块实践（2026-02-09）

- 主地图中“管道”显示逻辑应优先抽到 `composables/shared/`，避免页面组件膨胀。
- `components/MapView.vue` 保持为地图容器与编排层，不承载复杂分类策略。
- 当前已落地：
  - `usePipeLayerLoader` 负责 `pipes` 数据读取、`water/drain/sewage` 分类与统一样式
  - `useMapViewSelection` 负责选中高亮/focus 辅助
  - `useMapViewWorkorderHeat` 负责工单热力图叠加、轮询和泵控刷新联动

## 后台工作流实践（2026-03-26）

- `Pipe2DEditorDialog.vue` 与 `PipelineOpsBoard.vue` 都应视为“编排壳”，不要继续堆大块模板。
- `usePipe2DEditorMap.ts` 应保持为地图装配壳，交互、渲染同步、共享辅助优先继续下沉到 `composables/admin/pipe2d-editor/`。
- 二维编辑器地图内部优先按四层拆分：
  - `usePipe2DEditorMap.ts`：实例装配、相机/底图/场景控制
  - `usePipe2DEditorMapInteractions.ts`：选中、插点、删点、右键、hover、快捷键
  - `usePipe2DEditorMapGraphics.ts`：草稿渲染、Mars3D GraphicLayer 同步、编辑态回写
  - `pipe2d-editor-map-shared.ts`：纯类型、命中辅助、缩放/测长工具
- 复杂后台工作流界面默认拆成：
  - `*OverviewSection.vue`
  - `*CreateSection.vue`
  - `*ListSection.vue`
  - `*DetailPanel.vue`
  - `*ActionDialog.vue`
- 如果壳组件脚本主要在堆表单/弹层/timer/notice/路由联动，优先新增同域 `use*Ui.ts` 放到 `composables/admin/`，例如：
  - `usePipelineOpsBoard.ts`：数据获取、过滤、刷新、写操作
  - `usePipelineOpsBoardUi.ts`：弹层、表单、通知、倒计时、详情打开等壳层交互
- 文案映射、状态标签、共享表单类型优先抽到同目录常量/类型文件，不要散落在主壳组件里。

---

## 禁止行为

- ❌ 在 `components/` 下放“页面级组件”
- ❌ 在 `views/` 下放“纯 UI 组件”
- ❌ 在 composables 里直接写 `$fetch`（应通过 services）
- ❌ 在页面组件里写超过 80 行的表格/表单（应抽成组件）
- ❌ 把 `PipelineOpsBoard.vue`、`Pipe2DEditorDialog.vue` 重新堆回超大模板组件

---

## 违规检测

如果你看到有文件违反上述规则，请：
1) 检查文件职责（页面 vs 组件）
2) 按上述规范迁移到正确目录
3) 更新 `config/admin-comp-map.ts`（如涉及页面组件）

---

> 本文档随项目演进持续更新。
