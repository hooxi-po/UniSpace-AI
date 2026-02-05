<template>
  <aside class="admin-sider" :class="{ 'admin-sider--collapsed': collapsed }">
    <div class="admin-sider__brand">
      <div class="admin-sider__logo">U</div>
      <div v-if="!collapsed" class="admin-sider__brand-text">
        <div class="admin-sider__brand-title">UniSpace-AI</div>
        <div class="admin-sider__brand-subtitle">Admin</div>
      </div>
    </div>

    <nav class="admin-sider__nav">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="admin-sider__item"
        :class="{ 'admin-sider__item--active': modelValue === t.key }"
        @click="$emit('update:modelValue', t.key)"
      >
        <span class="admin-sider__item-label">{{ t.label }}</span>
      </button>

      <div v-if="modelValue === 'assets' && subTabs && subTabs.length && !collapsed" class="admin-sider__sub">
        <button
          v-for="st in subTabs"
          :key="st.key"
          class="admin-sider__sub-item"
          :class="{ 'admin-sider__sub-item--active': subValue === st.key }"
          @click="$emit('update:subValue', st.key)"
        >
          {{ st.label }}
        </button>
      </div>
    </nav>

    <div class="admin-sider__footer">
      <button class="admin-sider__collapse" @click="$emit('toggle')">
        {{ collapsed ? '展开' : '收起' }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
type TabKey = 'overview' | 'geo' | 'assets' | 'ops'

type SubKey = 'assets_buildings' | 'assets_pipelines'

defineProps<{
  modelValue: TabKey
  tabs: { key: TabKey; label: string }[]
  collapsed: boolean
  subValue?: SubKey
  subTabs?: { key: SubKey; label: string }[]
}>()

defineEmits<{
  (e: 'update:modelValue', v: TabKey): void
  (e: 'update:subValue', v: SubKey): void
  (e: 'toggle'): void
}>()
</script>

<style scoped>
.admin-sider {
  width: 208px;
  background: #ffffff;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.admin-sider--collapsed {
  width: 64px;
}

.admin-sider__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 12px;
  border-bottom: 1px solid var(--border);
}

.admin-sider__logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(22, 100, 255, 0.1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  user-select: none;
}

.admin-sider__brand-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.admin-sider__brand-subtitle {
  font-size: 11px;
  line-height: 16px;
  color: var(--muted);
}

.admin-sider__nav {
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-sider__sub {
  margin-top: 4px;
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-sider__sub-item {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
}

.admin-sider__sub-item:hover {
  background: #f5f6f7;
}

.admin-sider__sub-item--active {
  background: rgba(22, 100, 255, 0.08);
  color: var(--primary);
}

.admin-sider__item {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 10px 10px;
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}

.admin-sider__item:hover {
  background: #f5f6f7;
}

.admin-sider__item--active {
  background: rgba(22, 100, 255, 0.08);
  color: var(--primary);
}

.admin-sider__footer {
  margin-top: auto;
  padding: 10px 8px;
  border-top: 1px solid var(--border);
}

.admin-sider__collapse {
  width: 100%;
  border: 1px solid var(--border);
  background: #ffffff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
}

.admin-sider__collapse:hover {
  background: #f8f9fa;
}
</style>
