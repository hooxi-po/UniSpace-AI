# 校园地下管网运维系统

基于赛博朋克风格与玻璃拟态UI的地下管网数字孪生运维仪表盘，集成AI助手。

## 技术栈

- **框架**: Nuxt 3 + Vue 3 (Composition API)
- **构建工具**: Vite (Nuxt 内置)
- **样式**: Tailwind CSS
- **图标**: Lucide Vue Next
- **图表**: Recharts
- **AI**: Google Generative AI (Gemini)
- **语言**: TypeScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量示例
cp .env.example .env
```

编辑 `.env` 文件，添加你的 Gemini API Key：
```env
GEMINI_API_KEY=your_api_key_here
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
├── assets/
│   └── css/
│       └── main.css          # 全局样式和 Tailwind
├── components/
│   ├── ChatInterface.vue     # AI 聊天界面
│   ├── InfoBox.vue          # 信息框（已废弃）
│   ├── LayerToggle.vue      # 图层切换按钮
│   ├── MapControls.vue      # 地图控制器
│   ├── MapView.vue          # 地图主视图
│   ├── PressureChart.vue    # 压力图表
│   ├── RightSidebar.vue     # 右侧详情面板
│   ├── SidebarLeft.vue      # 左侧数据面板
│   ├── TechPanel.vue        # 技术面板容器
│   └── TopNav.vue           # 顶部导航
├── composables/
│   ├── useConstants.ts      # 常量和模拟数据
│   └── useGeminiChat.ts     # Gemini AI 聊天封装
├── pages/
│   └── index.vue            # 主页面
├── server/
│   └── api/
│       └── chat.post.ts     # AI 聊天 API 端点
├── app.vue                  # 应用入口
├── nuxt.config.ts          # Nuxt 配置
├── tailwind.config.js      # Tailwind 配置
├── tsconfig.json           # TypeScript 配置
└── types.ts                # 类型定义
```

## 核心功能

### 1. 可视化地图系统
- 3D 风格的地下管网地图展示
- 支持缩放、平移等交互操作
- 多图层控制（供水、污水、雨水、建筑物）
- 天气模式切换（暴雨模拟）

### 2. 管网监控
- 实时监测三类管道：供水管、污水管、雨水管
- 显示管道状态（正常/警告/严重）
- 监控压力、流量等关键指标
- 管道资产信息（管径、材质、埋深、安装日期等）

### 3. 建筑物管理
- 监控校园建筑（图书馆、宿舍、实验楼等）
- 显示建筑连接的管网信息
- 追踪关键设备和能耗数据
- 设备远程控制模拟

### 4. 智能告警系统
- 实时告警推送（信息/警告/严重三级）
- 显示告警位置和时间
- 压力趋势图表分析

### 5. AI 助手 (NOAH)
- 集成 Google Gemini AI
- 支持自然语言对话
- 提供运维建议和问题诊断
- 流式响应，实时反馈

### 6. 工单管理
- 巡检、维修、保养工单追踪
- 工单状态管理（待处理/处理中/已完成）
- 全生命周期提醒

## 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 生成静态站点
npm run generate
```

## 环境变量

在 `.env` 文件中配置：

```env
# Gemini API Key（必需）
GEMINI_API_KEY=your_api_key_here
```

## API 路由

### POST /api/chat

聊天 API 端点，使用服务端流式响应 (SSE)。

**请求体：**
```json
{
  "message": "用户消息",
  "history": []
}
```

**响应：** Server-Sent Events (SSE) 流

## 性能优化

- 使用 `<ClientOnly>` 包裹纯客户端组件（如图表）
- 使用 `computed` 缓存计算结果
- 使用 `v-show` 而非 `v-if` 用于频繁切换的元素
- 懒加载大型组件

## 浏览器支持

- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)

## 许可证

MIT

## 相关链接

- [Nuxt 3 文档](https://nuxt.com)
- [Vue 3 文档](https://vuejs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Google Gemini AI](https://ai.google.dev)
