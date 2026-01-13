<template>
  <header class="main-header">
    <h1>基于GIS和数字孪生的校园地下管网运维系统</h1>
  </header>
</template>

<script setup lang="ts">
// No script logic needed for this simple component yet
</script>

<style scoped>
.main-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to bottom, rgba(10, 22, 41, 0.8), rgba(10, 22, 41, 0));
  padding: 20px;
  text-align: center;
  z-index: 1000;
  pointer-events: none; /* Allow clicks to pass through to the map */
}

.main-header h1 {
  margin: 0;
  color: white;
  font-size: 28px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(0, 191, 255, 0.8);
}
</style>