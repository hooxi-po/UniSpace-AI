<template>
  <div v-if="items.length" class="warning">
    <div class="warning__icon" aria-hidden="true">📅</div>
    <div class="warning__content">
      <div class="warning__title">合同到期提醒</div>
      <div class="warning__list">
        <div v-for="it in items" :key="it.id" class="warning__row">
          <div class="warning__left">
            <span class="warning__tenant">{{ it.tenant }}</span>
            <span class="warning__space">({{ it.spaceName }})</span>
          </div>
          <div class="warning__badge" :class="badgeClass(it.days)">
            {{ it.days }}天后到期 ({{ it.endDate }})
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ExpiringItem {
  id: string
  tenant: string
  spaceName: string
  endDate: string
  days: number
}

defineProps<{ items: ExpiringItem[] }>()

const badgeClass = (days: number) => {
  if (days <= 7) return 'is-danger'
  if (days <= 30) return 'is-warn'
  return 'is-info'
}
</script>

<style scoped>
.warning {
  display: flex;
  gap: 12px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  border-radius: 12px;
  padding: 14px;
}

.warning__icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.warning__title {
  font-weight: 700;
  color: #78350f;
  margin-bottom: 10px;
}

.warning__list {
  display: grid;
  gap: 8px;
}

.warning__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.warning__left {
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
}

.warning__tenant {
  font-weight: 600;
  color: var(--text);
}

.warning__space {
  color: var(--muted);
}

.warning__badge {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.warning__badge.is-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.warning__badge.is-warn {
  background: #ffedd5;
  color: #c2410c;
}

.warning__badge.is-info {
  background: #fef3c7;
  color: #92400e;
}
</style>
























