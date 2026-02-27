<template>
  <div class="rankingWrap">
    <table class="table">
      <thead>
        <tr>
          <th>排名</th>
          <th>承租方</th>
          <th>房源</th>
          <th class="text-right">累计租金</th>
          <th class="text-right">欠费金额</th>
          <th class="text-center">履约评分</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in items" :key="item.id">
          <td>
            <span :class="['rank-badge', index < 3 ? `rank-${index + 1}` : 'rank-normal']">
              {{ index + 1 }}
            </span>
          </td>
          <td class="font-medium">{{ item.tenant }}</td>
          <td>{{ item.spaceName }}</td>
          <td class="text-right font-medium text-success">¥{{ item.totalReceived.toLocaleString() }}</td>
          <td class="text-right font-medium text-danger">
            {{ item.outstanding > 0 ? `¥${item.outstanding.toLocaleString()}` : '-' }}
          </td>
          <td class="text-center">
            <div class="stars">
              <span v-for="i in 5" :key="i" :class="['star', i <= item.rating ? 'star--active' : '']">
                ★
              </span>
            </div>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="6" class="empty">暂无排名数据</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { TenantRankingItem } from '~/services/operating'

defineProps<{
  items: TenantRankingItem[]
}>()
</script>

<style scoped>
.rankingWrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th, .table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.table th {
  background: #f8fafc;
  color: var(--muted);
  font-weight: 600;
}

.font-medium { font-weight: 700; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.rank-1 { background: #fef3c7; color: #b45309; }
.rank-2 { background: #f1f5f9; color: #475569; }
.rank-3 { background: #ffedd5; color: #9a3412; }
.rank-normal { background: transparent; color: var(--muted); }

.stars {
  display: flex;
  justify-content: center;
  gap: 2px;
}

.star {
  color: #e2e8f0;
  font-size: 14px;
}

.star--active {
  color: #fbbf24;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--muted);
}
</style>








