<template>
  <div class="grid">
    <section class="panel">
      <div class="panelTitle">任务状态占比</div>
      <div class="legend">
        <div v-for="item in statusStats" :key="item.status" class="row">
          <span class="dot" :style="{ backgroundColor: getStatusMeta(item.status).dot }" />
          <span>{{ item.status }}</span>
          <strong>{{ item.percent }}%</strong>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panelTitle">流程阶段分布</div>
      <div class="bars">
        <div v-for="item in phaseStats" :key="item.phase" class="barRow">
          <div class="name">{{ item.phase }}</div>
          <div class="track"><div class="fill" :style="{ width: `${item.percent}%`, backgroundColor: phaseColor[item.phase] }" /></div>
          <strong>{{ item.percent }}%</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  statusStats: Array<{ status: string; count: number; percent: number }>
  phaseStats: Array<{ phase: string; count: number; percent: number }>
  phaseColor: Record<string, string>
  getStatusMeta: (status: any) => { dot: string }
}>()
</script>

<style scoped>
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.panel{background:#fff;border:1px solid var(--border,#dfe3ea);border-radius:12px;padding:14px}
.panelTitle{font-size:14px;font-weight:700;margin-bottom:12px}
.legend{display:grid;gap:10px}.row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;font-size:13px}
.dot{width:10px;height:10px;border-radius:50%}
.bars{display:grid;gap:10px}.barRow{display:grid;grid-template-columns:84px 1fr auto;gap:8px;align-items:center;font-size:12px}
.track{height:8px;background:#eef2ff;border-radius:999px;overflow:hidden}.fill{height:100%;border-radius:999px}
@media (max-width:900px){.grid{grid-template-columns:1fr}}
</style>