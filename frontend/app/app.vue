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
  background-color: #050b14; /* Darker background */
  font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; /* More modern font stack */
  color: #e0e0e0;
}

.app-container {
  width: 100%;
  height: 100vh;
  position: relative;
  background: radial-gradient(circle at center, rgba(10, 22, 41, 0.1) 0%, rgba(5, 11, 20, 0.8) 100%);
}

/* Global scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 191, 255, 0.3);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 191, 255, 0.5);
}
</style>
