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

### 4) composables/ 按层级分
- **shared/**：通用 hooks（`useTable`、`usePagination`、`useDialog`）
- **admin/**：admin 域专用 hooks
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

### 新 composable
- 通用：`composables/shared/use<Name>.ts`
- 域专用：`composables/<domain>/use<Name>.ts`

### 新 service
- 路径：`services/<domain>.ts`
- 只封装请求，不包含 Vue 状态

---

## 禁止行为

- ❌ 在 `components/` 下放“页面级组件”
- ❌ 在 `views/` 下放“纯 UI 组件”
- ❌ 在 composables 里直接写 `$fetch`（应通过 services）
- ❌ 在页面组件里写超过 80 行的表格/表单（应抽成组件）

---

## 违规检测

如果你看到有文件违反上述规则，请：
1) 检查文件职责（页面 vs 组件）
2) 按上述规范迁移到正确目录
3) 更新 `config/admin-comp-map.ts`（如涉及页面组件）

---

> 本文档随项目演进持续更新。
