<script setup lang="ts">
import CesiumViewer from '../components/CesiumViewer.vue'
import Header from '../components/ui/Header.vue'
import LeftSidebar from '../components/ui/LeftSidebar.vue'
import RightSidebar from '../components/ui/RightSidebar.vue'
import BottomBar from '../components/ui/BottomBar.vue'
import InfoPopup from '../components/ui/InfoPopup.vue'
</script>

<template>
  <div class="app-container">
    <CesiumViewer />
    <Header />
    <LeftSidebar />
    <RightSidebar />
    <BottomBar />
    <InfoPopup />
    <NuxtRouteAnnouncer />
  </div>
</template>

<style>
html, body, #__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0a1629;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  width: 100%;
  height: 100vh;
  position: relative;
}
</style>
