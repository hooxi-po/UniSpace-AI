# UniSpace-AI

> Nuxt.js + Spring Boot + Cesium 全栈 3D 地图项目

前后端分离架构：前端使用 [Nuxt.js](https://nuxt.com/) + [Cesium](https://cesium.com/)，后端使用 [Spring Boot](https://spring.io/projects/spring-boot)。

---

## 目录结构

```
.
├── backend/   # Spring Boot 后端服务
│   ├── src/
│   ├── build.gradle.kts
│   └── ...
└── frontend/  # Nuxt.js (Vue) 前端
    ├── app/
    ├── components/
    │   └── CesiumViewer.vue  # 3D 地图组件
    ├── public/
    │   └── map/
    │       └── map.geojson   # GeoJSON 建筑数据
    ├── nuxt.config.ts
    ├── package.json
    └── ...
```

---

## 技术栈

| 层        | 技术              | 说明 |
|-----------|-------------------|------|
| 前端      | Nuxt.js 4, Vue 3  | TypeScript + 自动导入 |
| 3D 地图   | Cesium            | 3D 建筑渲染、地形、OpenStreetMap 底图 |
| 后端      | Spring Boot 4     | Spring Web |
| 构建工具  | npm, Gradle       | |
| 运行环境  | Node.js ≥ 18, JDK 21 | |

---

## 功能特性

- 🗺️ OpenStreetMap 底图
- 🏔️ Cesium World Terrain 地形数据
- 🏢 GeoJSON 建筑轮廓 3D 拉伸渲染
- 🏙️ OSM 3D Buildings 全球建筑数据
- 📍 自定义初始视角定位

---

## 快速开始

### 环境配置

1. 在 `frontend/.env` 中配置 Cesium Ion Token：
```
NUXT_PUBLIC_CESIUM_TOKEN=your-cesium-ion-token
```

获取 Token: https://cesium.com/ion/tokens

### 一键启动

```bash
./start.sh
```

脚本会并行启动：
- 后端: http://localhost:8080
- 前端: http://localhost:3000

按 `Ctrl+C` 停止所有服务。

### 手动启动

```bash
# 后端
cd backend
./gradlew bootRun

# 前端（另一个终端）
cd frontend
npm install
npm run dev
```

---

## 地图配置

### 修改初始视角

编辑 `frontend/components/CesiumViewer.vue`：

```js
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(
    119.1935,  // 经度
    26.0253,   // 纬度
    800        // 高度（米）
  ),
  orientation: {
    heading: Cesium.Math.toRadians(30),   // 方向角
    pitch: Cesium.Math.toRadians(-35),    // 俯仰角
    roll: 0
  }
})
```

### 修改建筑高度

在 `CesiumViewer.vue` 中调整每层高度：

```js
const height = levels * 20  // 每层 20 米
```

### 添加自定义 GeoJSON

将 GeoJSON 文件放入 `frontend/public/map/` 目录，确保包含 `building` 属性和可选的 `building:levels` 属性。

---

## 生产构建

```bash
# 前端
cd frontend
npm run build
npm run preview

# 后端
cd backend
./gradlew bootJar
java -jar build/libs/workflow-0.0.1-SNAPSHOT.jar
```

---

## API

| 方法 | 路径         | 说明 |
|------|--------------|------|
| GET  | `/api/hello` | 返回 `{ "message": "Hello, world!" }` |

---

## License

[MIT](LICENSE) © 2026 UniSpace Team
