// https://nuxt.com/docs/api/configuration/nuxt-config
import cesium from 'vite-plugin-cesium'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // 1️⃣ 让 Cesium 的静态资源 (Workers / Assets / Widgets) 能被 Nuxt 服务器正确暴露
  // vite-plugin-cesium 会在 dev / build 时把 node_modules/cesium/Build/Cesium
  // 复制到 .output/public/cesium，下方 nitro.publicAssets 把它映射到
  // http://localhost:3000/cesium/** 这样 Cesium 运行时就能请求到了。
  nitro: {
    publicAssets: [
      {
        dir: 'node_modules/cesium/Build/Cesium',
        baseURL: '/cesium'
      }
    ]
  },

  // 2️⃣ Vite 配置：注入插件 + 把运行时常量 CESIUM_BASE_URL 写死成同一路径
  vite: {
    plugins: [cesium()],
    define: {
      CESIUM_BASE_URL: JSON.stringify('/cesium/')
    }
  },

  // 3️⃣ 运行时配置：在环境变量 NUXT_PUBLIC_CESIUM_TOKEN 中提供 Cesium Ion Token
  runtimeConfig: {
    public: {
      cesiumToken: process.env.NUXT_PUBLIC_CESIUM_TOKEN || ''
    }
  }
})
