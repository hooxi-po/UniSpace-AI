<template>
  <section class="section">
    <div class="sectionTitle">年度盘点任务清单</div>

    <div v-if="loading" class="emptyText">加载中...</div>
    <div v-else-if="tasks.length === 0" class="emptyText">暂无符合条件的盘点任务</div>

    <div v-else-if="viewMode === 'card'" class="cardGrid">
      <article v-for="task in tasks" :key="task.id" class="taskCard">
        <div class="taskHead">
          <div>
            <div class="taskName">{{ task.taskName }}</div>
            <div class="taskMeta">{{ task.id }} · {{ task.year }} 年 · {{ task.building }}</div>
          </div>
          <span class="statusTag" :style="{ backgroundColor: getStatusMeta(task.status).bg, color: getStatusMeta(task.status).text }">{{ task.status }}</span>
        </div>

        <div class="desc">盘点范围：{{ task.scope }}</div>

        <div class="metrics">
          <div class="metric"><span>负责人</span><strong>{{ task.leader }}</strong></div>
          <div class="metric"><span>责任部门</span><strong>{{ task.ownerDept }}</strong></div>
          <div class="metric"><span>差异项</span><strong>{{ task.discrepancyCount }}</strong></div>
        </div>

        <div class="progressLine">
          <div class="progressTop"><span>{{ task.phase }}</span><strong>{{ task.progress }}%</strong></div>
          <div class="track"><div class="fill" :style="{ width: `${task.progress}%` }" /></div>
        </div>

        <div class="actions">
          <button class="btn btn--primary" @click="$emit('view-detail', task)">查看详情</button>
          <button class="btn" :disabled="!task.permissions?.canStartReview || acting" :title="!task.permissions?.canStartReview ? (task.permissions?.reason || '无权限') : ''" @click="$emit('start-review', task)">发起复核</button>
          <button class="btn" :disabled="!task.permissions?.canArchive || acting" :title="!task.permissions?.canArchive ? (task.permissions?.reason || '无权限') : ''" @click="$emit('archive-task', task)">归档完成</button>
        </div>

        <div class="foot">已盘点 {{ task.checkedAssets }}/{{ task.totalAssets }} 项 · 截止 {{ task.dueDate }} · 更新 {{ task.lastUpdatedAt }}</div>
      </article>
    </div>

    <div v-else class="tableWrap">
      <table class="table">
        <thead>
          <tr>
            <th>任务</th><th>范围</th><th>阶段</th><th>进度</th><th>差异</th><th>截止日期</th><th>状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id">
            <td><div class="taskNameSm">{{ task.taskName }}</div><div class="taskMeta">{{ task.id }} · {{ task.building }}</div></td>
            <td>{{ task.scope }}</td>
            <td>{{ task.phase }}</td>
            <td>{{ task.progress }}%</td>
            <td>{{ task.discrepancyCount }}</td>
            <td>{{ task.dueDate }}</td>
            <td><span class="statusTag" :style="{ backgroundColor: getStatusMeta(task.status).bg, color: getStatusMeta(task.status).text }">{{ task.status }}</span></td>
            <td>
              <div class="tableActions">
                <button class="linkBtn" @click="$emit('view-detail', task)">详情</button>
                <button class="linkBtn" :disabled="!task.permissions?.canStartReview || acting" @click="$emit('start-review', task)">复核</button>
                <button class="linkBtn" :disabled="!task.permissions?.canArchive || acting" @click="$emit('archive-task', task)">归档</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { InventoryTask } from '~/services/inventory'

defineProps<{
  loading: boolean
  acting: boolean
  viewMode: 'card' | 'list'
  tasks: InventoryTask[]
  getStatusMeta: (status: InventoryTask['status']) => { bg: string; text: string }
}>()

defineEmits<{
  'view-detail': [InventoryTask]
  'start-review': [InventoryTask]
  'archive-task': [InventoryTask]
}>()
</script>

<style scoped>
.section{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:14px}
.sectionTitle{font-size:14px;font-weight:700;margin-bottom:12px}.emptyText{font-size:13px;color:#646a73}
.cardGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.taskCard{border:1px solid var(--border-light,#edf0f5);border-radius:10px;padding:12px;display:grid;gap:10px}
.taskHead{display:flex;justify-content:space-between;gap:8px}.taskName{font-weight:700}.taskMeta{font-size:12px;color:#646a73;margin-top:4px}
.desc{font-size:13px;color:#3f4752}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.metric{background:#f8fafc;border-radius:8px;padding:8px;text-align:center}.metric span{display:block;font-size:12px;color:#646a73}.metric strong{font-size:13px}
.progressTop{display:flex;justify-content:space-between;font-size:12px;color:#646a73}.track{margin-top:6px;height:8px;background:#edf2ff;border-radius:999px;overflow:hidden}.fill{height:100%;background:#3370ff;border-radius:999px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{border:1px solid var(--border,#dfe3ea);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px}
.btn:disabled{cursor:not-allowed;color:#9aa0a6;background:#f5f6f8}
.btn--primary{background:#3370ff;color:#fff;border-color:#3370ff}
.foot{font-size:12px;color:#646a73}.statusTag{border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}
.tableWrap{overflow:auto}.table{width:100%;border-collapse:collapse}.table th,.table td{border-bottom:1px solid var(--border-light,#edf0f5);padding:10px 8px;font-size:13px;text-align:left}.table th{color:#646a73;background:#f8fafc}
.taskNameSm{font-weight:600}.tableActions{display:flex;gap:6px}
.linkBtn{border:none;background:transparent;color:#3370ff;cursor:pointer;font-size:12px;padding:0}
.linkBtn:disabled{color:#a0a6ad;cursor:not-allowed}
@media (max-width:900px){.cardGrid{grid-template-columns:1fr}}
</style>