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
      <div
        v-for="t in tabs"
        :key="t.key"
        class="admin-sider__group"
      >
        <button
        class="admin-sider__item"
        :class="{ 'admin-sider__item--active': modelValue === t.key }"
          @click="handleTabClick(t.key)"
      >
        <span class="admin-sider__item-label">{{ t.label }}</span>
      </button>

        <div
          v-if="modelValue === t.key && expandedTabs.has(t.key) && subTabs && subTabs.length && !collapsed"
          class="admin-sider__sub"
        >
          <div
          v-for="st in subTabs"
          :key="st.key"
            class="admin-sider__sub-group"
          >
            <button
          class="admin-sider__sub-item"
          :class="{ 'admin-sider__sub-item--active': subValue === st.key }"
              @click="handleSubClick(st.key)"
        >
          {{ st.label }}
        </button>

            <div
              v-if="subValue === st.key && expandedSubs.has(st.key) && thirdTabs && thirdTabs.length && !collapsed"
              class="admin-sider__third"
            >
          <button
            v-for="tt in thirdTabs"
            :key="tt.key"
            class="admin-sider__third-item"
            :class="{ 'admin-sider__third-item--active': thirdValue === tt.key }"
            @click="$emit('update:thirdValue', tt.key)"
          >
            {{ tt.label }}
          </button>
            </div>
          </div>
        </div>
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
import { ref, watch } from 'vue'
import type { TabKey, SubKey, ThirdKey } from '~/types/admin'

const props = defineProps<{
  modelValue: TabKey
  tabs: { key: TabKey; label: string }[]
  collapsed: boolean
  subValue?: SubKey
  subTabs?: { key: SubKey; label: string }[]
  thirdValue?: ThirdKey
  thirdTabs?: { key: ThirdKey; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: TabKey): void
  (e: 'update:subValue', v: SubKey): void
  (e: 'update:thirdValue', v: ThirdKey): void
  (e: 'toggle'): void
}>()

const expandedTabs = ref<Set<TabKey>>(new Set())
const expandedSubs = ref<Set<SubKey>>(new Set())

watch(() => props.modelValue, (newKey, oldKey) => {
  if (newKey !== oldKey) {
    expandedSubs.value.clear()
  }
}, { immediate: true })

watch(() => props.subValue, (newKey, oldKey) => {
  if (newKey !== oldKey) {
    // no-op: keep expanded state controlled by click
  }
}, { immediate: true })

function handleTabClick(key: TabKey) {
  if (props.modelValue === key) {
    if (expandedTabs.value.has(key)) {
      expandedTabs.value.delete(key)
    } else {
      expandedTabs.value.add(key)
    }
  } else {
    emit('update:modelValue', key)
    expandedTabs.value.clear()
    expandedTabs.value.add(key)
  }
}

function handleSubClick(key: SubKey) {
  if (props.subValue === key) {
    if (expandedSubs.value.has(key)) {
      expandedSubs.value.delete(key)
    } else {
      expandedSubs.value.add(key)
    }
  } else {
    emit('update:subValue', key)
    expandedSubs.value.clear()
    expandedSubs.value.add(key)
  }
}
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
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.admin-sider__sub {
  margin-top: 4px;
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-sider__sub-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-sider__third {
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

.admin-sider__third-item {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 7px 10px;
  border-radius: 8px;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
}

.admin-sider__third-item:hover {
  background: #f5f6f7;
}

.admin-sider__third-item--active {
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
