# UniSpace-AI

> Nuxt.js + Spring Boot 全栈项目

前后端分离架构：前端使用 [Nuxt.js](https://nuxt.com/)，后端使用 [Spring Boot](https://spring.io/projects/spring-boot)。

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
    ├── nuxt.config.ts
    ├── package.json
    └── ...
```

---

## 技术栈

| 层        | 技术              | 说明 |
|-----------|-------------------|------|
| 前端      | Nuxt.js 4, Vue 3  | TypeScript + 自动导入 |
| 后端      | Spring Boot 4     | Spring Web |
| 构建工具  | npm, Gradle       | |
| 运行环境  | Node.js ≥ 18, JDK 21 | |

---

## 快速开始

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
