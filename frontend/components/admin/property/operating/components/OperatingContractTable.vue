<template>
  <div class="tableWrap">
    <table class="table">
      <thead>
        <tr>
          <th>合同编号</th>
          <th>房源</th>
          <th>承租方</th>
          <th>月租金</th>
          <th>合同期限</th>
          <th>状态</th>
          <th class="text-center">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in items" :key="c.id">
          <td class="font-medium">{{ c.contractNo }}</td>
          <td>{{ c.spaceName }}</td>
          <td>{{ c.tenant }}</td>
          <td class="font-medium">¥{{ c.rentPerMonth.toLocaleString() }}</td>
          <td>
            <div>{{ c.startDate }}</div>
            <div class="muted">至 {{ c.endDate }}</div>
          </td>
          <td>
            <span :class="['badge', c.status === 'Active' ? 'badge--success' : 'badge--warn']">
              {{ c.status === 'Active' ? '履约中' : '即将到期' }}
            </span>
          </td>
          <td class="text-center">
            <div class="actions">
              <button class="link" @click="$emit('detail', c)">详情</button>
              <button v-if="editable" class="link" @click="$emit('edit', c)">编辑</button>
              <button v-if="editable" class="link link--danger" @click="$emit('delete', c)">删除</button>
            </div>
          </td>
        </tr>

        <tr v-if="items.length === 0">
          <td class="empty" colspan="7">暂无合同数据</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { OperatingContractItem } from '~/services/operating'

defineProps<{
  items: OperatingContractItem[]
  editable?: boolean
}>()

defineEmits<{
  (e: 'detail', item: OperatingContractItem): void
  (e: 'edit', item: OperatingContractItem): void
  (e: 'delete', item: OperatingContractItem): void
}>()
</script>

<style scoped>
.tableWrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.table th {
  background: #f8fafc;
  color: var(--muted);
  font-weight: 600;
}

.font-medium {
  font-weight: 700;
}

.muted {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}

.actions {
  display: inline-flex;
  gap: 10px;
  justify-content: center;
}

.link {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  color: var(--primary);
}

.link--danger {
  color: #dc2626;
}

.text-center {
  text-align: center;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badge--success {
  background: #eefdf3;
  color: #16a34a;
}

.badge--warn {
  background: #fffbeb;
  color: #d97706;
}

.empty {
  text-align: center;
  color: var(--muted);
  padding: 20px;
}
</style>

