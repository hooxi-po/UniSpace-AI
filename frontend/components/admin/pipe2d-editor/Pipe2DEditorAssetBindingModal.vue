<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type BuildingItem = {
  id: string | number
  properties?: Record<string, unknown>
}

const props = defineProps<{
  open: boolean
  saving: boolean
  pipeName: string
  buildings: BuildingItem[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', buildingIds: string[]): void
}>()

const searchQuery = ref('')
const selectedIdSet = ref<Set<string>>(new Set())

watch(
  () => [props.open, props.selectedIds.join(',')] as const,
  ([open]) => {
    if (!open) return
    searchQuery.value = ''
    selectedIdSet.value = new Set(props.selectedIds)
  },
  { immediate: true },
)

const filteredBuildings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const items = props.buildings.map((item) => {
    const properties = item.properties || {}
    const name = String(properties.name || properties.buildingName || item.id)
    const type = String(properties.buildingType || properties.amenity || '')
    const campus = String(properties.campus || properties.area || '')
    return {
      id: String(item.id),
      name,
      type,
      campus,
      searchText: `${String(item.id)} ${name} ${type} ${campus}`.toLowerCase(),
    }
  })

  if (!query) return items.slice(0, 80)
  return items.filter(item => item.searchText.includes(query)).slice(0, 80)
})

const selectedCount = computed(() => selectedIdSet.value.size)

function toggleBuilding(id: string) {
  const next = new Set(selectedIdSet.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIdSet.value = next
}

function handleSave() {
  emit('save', [...selectedIdSet.value])
}
</script>

<template>
  <div v-if="open" class="asset-bind-modal">
    <div class="asset-bind-modal__mask" @click="emit('close')" />
    <div class="asset-bind-modal__panel" @click.stop>
      <div class="asset-bind-modal__header">
        <div>
          <div class="asset-bind-modal__title">房产绑定</div>
          <div class="asset-bind-modal__subtitle">{{ pipeName }} 可直接绑定关联楼宇，用于影响范围和工单联动</div>
        </div>
        <button class="asset-bind-modal__close" type="button" :disabled="saving" @click="emit('close')">关闭</button>
      </div>

      <div class="asset-bind-modal__toolbar">
        <input v-model="searchQuery" class="asset-bind-modal__search" type="text" placeholder="搜索楼宇 ID / 名称 / 类型 / 区域" />
        <div class="asset-bind-modal__meta">已选 {{ selectedCount }} 栋</div>
      </div>

      <div class="asset-bind-modal__body">
        <div v-if="!filteredBuildings.length" class="asset-bind-modal__empty">未找到匹配楼宇</div>
        <ul v-else class="asset-bind-modal__list">
          <li v-for="item in filteredBuildings" :key="item.id" class="asset-bind-modal__item">
            <label class="asset-bind-modal__option">
              <input
                :checked="selectedIdSet.has(item.id)"
                class="asset-bind-modal__checkbox"
                type="checkbox"
                @change="toggleBuilding(item.id)"
              >
              <span class="asset-bind-modal__content">
                <strong>{{ item.name }}</strong>
                <span>{{ item.id }}</span>
                <span v-if="item.type || item.campus">{{ [item.type, item.campus].filter(Boolean).join(' · ') }}</span>
              </span>
            </label>
          </li>
        </ul>
      </div>

      <div class="asset-bind-modal__footer">
        <button class="btn btn--sm" type="button" :disabled="saving" @click="emit('close')">取消</button>
        <button class="btn btn--primary" type="button" :disabled="saving" @click="handleSave">
          {{ saving ? '保存中...' : '保存绑定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-bind-modal {
  position: absolute;
  inset: 0;
  z-index: 58;
}

.asset-bind-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.42);
  backdrop-filter: blur(4px);
}

.asset-bind-modal__panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(760px, calc(100vw - 40px));
  max-height: min(78vh, 760px);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.97), rgba(15, 23, 42, 0.93));
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.45);
  color: #e2e8f0;
  overflow: hidden;
}

.asset-bind-modal__header,
.asset-bind-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.asset-bind-modal__footer {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  border-bottom: none;
}

.asset-bind-modal__title {
  font-size: 18px;
  font-weight: 700;
}

.asset-bind-modal__subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(148, 163, 184, 0.92);
}

.asset-bind-modal__close,
.btn {
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(30, 41, 59, 0.88);
  color: #e2e8f0;
  padding: 0 14px;
  font-size: 13px;
}

.btn--primary {
  border-color: rgba(34, 211, 238, 0.28);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.92), rgba(34, 197, 94, 0.88));
  color: #f8fafc;
}

.asset-bind-modal__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.asset-bind-modal__search {
  flex: 1;
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  padding: 0 12px;
  font-size: 14px;
}

.asset-bind-modal__search::placeholder {
  color: rgba(100, 116, 139, 0.9);
}

.asset-bind-modal__meta {
  color: rgba(148, 163, 184, 0.92);
  font-size: 12px;
  white-space: nowrap;
}

.asset-bind-modal__body {
  min-height: 0;
  overflow: auto;
  padding: 16px 20px;
}

.asset-bind-modal__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.asset-bind-modal__option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.72);
}

.asset-bind-modal__checkbox {
  margin-top: 2px;
}

.asset-bind-modal__content {
  display: grid;
  gap: 4px;
}

.asset-bind-modal__content strong {
  font-size: 14px;
}

.asset-bind-modal__content span {
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
  line-height: 1.45;
}

.asset-bind-modal__empty {
  padding: 32px 20px;
  text-align: center;
  color: rgba(148, 163, 184, 0.92);
  font-size: 13px;
}

@media (max-width: 720px) {
  .asset-bind-modal__header,
  .asset-bind-modal__toolbar,
  .asset-bind-modal__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
