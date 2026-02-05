<template>
  <div class="admin-layout" :class="{ 'admin-layout--collapsed': siderCollapsed }">
    <AdminSider
      v-model="activeTab"
      v-model:subValue="activeSubTab"
      :tabs="tabs"
      :sub-tabs="subTabs"
      :collapsed="siderCollapsed"
      @toggle="siderCollapsed = !siderCollapsed"
    />

    <div class="admin-layout__body">
      <header class="admin-layout__header">
        <div class="admin-layout__header-left">
          <div class="admin-layout__page-title">{{ title }}</div>
          <div v-if="subtitle" class="admin-layout__page-subtitle">{{ subtitle }}</div>
        </div>

        <div class="admin-layout__header-right">
          <slot name="actions" />
        </div>
      </header>

      <main class="admin-layout__main">
        <slot :activeTab="activeTab" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AdminSider from './AdminSider.vue'

type TabKey = 'overview' | 'geo' | 'assets' | 'ops'

type SubKey = 'assets_buildings' | 'assets_pipelines'

defineProps<{
  title: string
  subtitle?: string
  tabs: { key: TabKey; label: string }[]
  subTabs?: { key: SubKey; label: string }[]
}>()

const activeTab = defineModel<TabKey>({ required: true })
const activeSubTab = defineModel<SubKey>('subValue')

const siderCollapsed = ref(false)
</script>

<style scoped>
.admin-layout {
  --bg: #f5f6f8;
  --panel: #ffffff;
  --text: #1f2329;
  --muted: #646a73;
  --border: #e6e8eb;
  --primary: #1664ff;
  --shadow: 0 2px 10px rgba(31, 35, 41, 0.06);

  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  display: flex;
}

.admin-layout__body {
  flex: 1;
  min-width: 0;
}

.admin-layout__header {
  position: sticky;
  top: 0;
  z-index: 10;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 12px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.admin-layout__page-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
}

.admin-layout__page-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--muted);
}

.admin-layout__main {
  padding: 16px;
}
</style>
