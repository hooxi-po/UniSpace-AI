// https://nuxt.com/docs/api/configuration/nuxt-config
import cesium from 'vite-plugin-cesium'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
  ],

  css: ['~/assets/css/main.css', 'cesium/Build/Cesium/Widgets/widgets.css'],

  runtimeConfig: {
    // 服务端可访问的私有配置
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    
    // 客户端可访问的公共配置
    public: {
      appName: '校园地下管网运维系统'
    }
  },

  app: {
    head: {
      title: '校园地下管网运维系统',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '基于赛博朋克风格与玻璃拟态UI的地下管网数字孪生运维仪表盘' }
      ],
    }
  },

  typescript: {
    strict: true,
    typeCheck: true
  },

  vite: {
    plugins: [cesium()]
  }
})
