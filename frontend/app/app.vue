<script setup lang="ts">
import CesiumViewer from '../components/CesiumViewer.vue'
</script>

<template>
  <div class="app-container">
    <NuxtRouteAnnouncer />
    <CesiumViewer />
  </div>
</template>

<style>
html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  width: 100%;
  height: 100vh;
}
</style>
