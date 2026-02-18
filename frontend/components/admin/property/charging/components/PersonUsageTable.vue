<template>
  <div class="card">
    <div class="head">
      <div class="title">当月个人用房汇总</div>
      <div class="sub">月份：{{ month }}</div>
    </div>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="usages.length === 0" class="empty">暂无人员用房数据</div>

    <div v-else class="tableWrap">
      <table class="table">
        <thead>
          <tr>
            <th>人员</th>
            <th>部门</th>
            <th>职称</th>
            <th class="right">实际面积</th>
            <th class="right">定额面积</th>
            <th class="right">超额面积</th>
            <th class="right">预计应缴</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in usages" :key="u.id">
            <td class="bold">{{ u.personName }}</td>
            <td>{{ u.departmentName }}</td>
            <td>{{ titleLabel(u.title) }}</td>
            <td class="right">{{ u.actualArea.toFixed(2) }} ㎡</td>
            <td class="right">{{ quotaArea(u.title).toFixed(0) }} ㎡</td>
            <td class="right" :class="excessArea(u) > 0 ? 'bad' : 'good'">
              {{ excessArea(u).toFixed(2) }} ㎡
            </td>
            <td class="right money">¥{{ estimateAmount(u).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PersonTitle, PersonUsage } from '~/server/utils/charging-db'

const props = defineProps<{
  month: string
  loading: boolean
  usages: PersonUsage[]
}>()

function titleLabel(t: PersonTitle) {
  const map: Record<PersonTitle, string> = {
    Assistant: '助教',
    Lecturer: '讲师',
    AssociateProfessor: '副教授',
    Professor: '教授',
    Other: '其他',
  }
  return map[t] || t
}

function quotaArea(t: PersonTitle): number {
  const q: Record<PersonTitle, number> = {
    Assistant: 12,
    Lecturer: 18,
    AssociateProfessor: 25,
    Professor: 30,
    Other: 12,
  }
  return q[t] ?? 12
}

function tierMultiplier(excessPercent: number): number {
  if (excessPercent <= 0) return 1.0
  if (excessPercent <= 10) return 1.0
  if (excessPercent <= 30) return 1.5
  if (excessPercent <= 50) return 2.0
  return 3.0
}

function excessArea(u: PersonUsage) {
  return Math.max(0, u.actualArea - quotaArea(u.title))
}

function estimateAmount(u: PersonUsage) {
  const excess = excessArea(u)
  if (excess <= 0) return 0
  const percent = quotaArea(u.title) > 0 ? (excess / quotaArea(u.title)) * 100 : 0
  const mult = tierMultiplier(percent)
  const baseCost = Math.round(excess * u.basePrice / 12)
  const tierCost = Math.round(baseCost * (mult - 1))
  return baseCost + tierCost
}
</script>

<style scoped>
.card {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.head {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.title {
  font-weight: 700;
  color: #1f2329;
}

.sub {
  font-size: 12px;
  color: #8f959e;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.tableWrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: 10px 12px;
  background: #f8fafc;
  font-size: 12px;
  color: #646a73;
  border-bottom: 1px solid #eef0f2;
  white-space: nowrap;
}

.table td {
  padding: 10px 12px;
  border-bottom: 1px solid #eef0f2;
  font-size: 13px;
  color: #1f2329;
  white-space: nowrap;
}

.bold {
  font-weight: 600;
}

.right {
  text-align: right;
}

.good {
  color: #16a34a;
}

.bad {
  color: #dc2626;
  font-weight: 600;
}

.money {
  font-weight: 700;
}
</style>

