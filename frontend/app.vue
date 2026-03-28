<template>
  <div>
    <NuxtPage />
    <ProxyWriteAuthDialog />
  </div>
</template>

<script setup lang="ts">
import ProxyWriteAuthDialog from '~/components/common/ProxyWriteAuthDialog.vue'

useHead({
  htmlAttrs: {
    lang: 'zh-CN'
  }
})
</script>
