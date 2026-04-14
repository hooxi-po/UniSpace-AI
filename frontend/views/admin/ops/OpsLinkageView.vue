<template>
  <div class="ops-linkage-view">
    <PipelineOpsTimeline
      :chains="mockTimelineChains"
      @open-workorder="handleOpenWorkorder"
    />
    <PipelineOpsBoard mode="linkage" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PipelineOpsBoard from '~/components/admin/ops/PipelineOpsBoard.vue'
import PipelineOpsTimeline from '~/components/admin/ops/PipelineOpsTimeline.vue'

// 模拟数据 - 实际应该从后端获取
const mockTimelineChains = ref([
  {
    id: 'CHAIN-001',
    startDate: '2026-04-10T08:30:00',
    items: [
      {
        workorderId: 'WO-INS-001',
        type: 'inspection' as const,
        title: '教学区供水管网例行巡检',
        status: 'completed' as const,
        createdAt: '2026-04-10T08:30:00',
        assignee: '张三',
      },
      {
        workorderId: 'WO-MAI-177',
        type: 'maintenance' as const,
        title: '博学楼供水管道漏水抢修',
        status: 'in_progress' as const,
        createdAt: '2026-04-10T10:15:00',
        assignee: '李四',
        triggerReason: '巡检发现压力异常',
      },
      {
        workorderId: 'WO-RET-003',
        type: 'retrofit' as const,
        title: '老化管段更换改造',
        status: 'todo' as const,
        createdAt: '2026-04-12T14:20:00',
        triggerReason: '评估后需要改造',
      },
    ],
  },
])

function handleOpenWorkorder(id: string) {
  console.log('打开工单:', id)
  // TODO: 实现跳转到工单详情
}
</script>

<style scoped>
.ops-linkage-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}
</style>
