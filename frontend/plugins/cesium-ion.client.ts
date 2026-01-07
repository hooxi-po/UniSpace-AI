import { Ion, buildModuleUrl } from 'cesium'
import { defineNuxtPlugin, useRuntimeConfig } from '#app'

// This plugin configures Cesium to use the locally hosted static bundle that
// you placed in `public/cesium` (which contains Assets/, Workers/, ThirdParty/,
// etc. copied from `Build/Cesium`).
// It also applies the public runtime Ion token when provided.

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // ---------------------------------------------------------------------------
  // 1) Configure Cesium Ion token (optional but recommended)
  // ---------------------------------------------------------------------------
  const token = config.public?.cesiumToken as string | undefined
  if (token) {
    Ion.defaultAccessToken = token
  } else {
    // eslint-disable-next-line no-console
    console.warn('[Cesium] Ion token not provided (set NUXT_PUBLIC_CESIUM_TOKEN)')
  }

  // ---------------------------------------------------------------------------
  // 2) Tell Cesium where to load its static resources from.
  //    With the bundle copied to `public/cesium`, every resource lives under
  //      /cesium/Assets
  //      /cesium/Workers
  //      /cesium/ThirdParty
  //      ...
  // ---------------------------------------------------------------------------
  buildModuleUrl.setBaseUrl('/cesium/')

  // Some Cesium helper libraries still rely on the global `CESIUM_BASE_URL`.
  // Define it when running in the browser for maximum compatibility.
  if (process.client) {
    // @ts-expect-error – declare global for legacy scripts
    window.CESIUM_BASE_URL = '/cesium/'
  }
})
