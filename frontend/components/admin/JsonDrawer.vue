<template>
  <div v-if="open" class="drawer">
    <div class="drawer__mask" @click="$emit('close')"></div>
    <div class="drawer__panel">
      <div class="drawer__header">
        <div class="drawer__title">{{ title }}</div>
        <button class="admin-btn admin-btn--link" @click="$emit('close')">关闭</button>
      </div>
      <div class="drawer__body">
        <div v-if="metaLabel" class="kv">
          <div class="kv__row">
            <div class="kv__key">类型</div>
            <div class="kv__val mono">{{ metaLabel }}</div>
          </div>
        </div>

        <div class="code">
          <pre>{{ jsonText }}</pre>
        </div>

        <div class="drawer__footer">
          <button class="admin-btn" @click="copy">复制 JSON</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  title?: string
  metaLabel?: string
  obj: unknown
}>()

defineEmits<{
  (e: 'close'): void
}>()

const jsonText = computed(() => {
  try {
    return JSON.stringify(props.obj, null, 2)
  } catch {
    return String(props.obj)
  }
})

async function copy() {
  try {
    await navigator.clipboard.writeText(jsonText.value)
  } catch {
    // ignore
  }
}
</script>

<style scoped>
.admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;

  border-radius: 8px;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text);

  font-size: 13px;
  line-height: 30px;
  cursor: pointer;
  user-select: none;
}

.admin-btn:hover {
  background: #f8f9fa;
}

.admin-btn--link {
  border-color: transparent;
  background: transparent;
  color: var(--primary);
  padding: 0 6px;
}

.admin-btn--link:hover {
  background: rgba(22, 100, 255, 0.08);
}

.kv {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kv__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.kv__key {
  font-size: 12px;
  color: var(--muted);
}

.kv__val {
  font-size: 12px;
}

.code {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #0b1220;
  color: #e6edf3;
  padding: 10px;
  max-height: 70vh;
  overflow: auto;
}

.code pre {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.drawer {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.drawer__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.drawer__panel {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 560px;
  max-width: 100%;
  background: #ffffff;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.drawer__header {
  padding: 12px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer__title {
  font-weight: 600;
}

.drawer__body {
  padding: 12px;
  overflow: auto;
}

.drawer__footer {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
