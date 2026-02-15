<template>
  <div v-if="isOpen && fee" class="modalMask" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">费用详情 - {{ fee.departmentName }}</div>
        <button class="iconBtn" @click="$emit('close')"><X :size="18" /></button>
      </div>

      <div class="modalBody">
        <div class="infoGrid">
          <div class="infoItem">
            <div class="k">年度</div>
            <div class="v">{{ fee.year }}</div>
          </div>
          <div class="infoItem">
            <div class="k">状态</div>
            <div class="v">
              <span class="badge" :class="getStatusColorClass(fee.status)">
                {{ getStatusLabel(fee.status) }}
              </span>
            </div>
          </div>
          <div class="infoItem">
            <div class="k">定额面积</div>
            <div class="v">{{ fee.quotaArea }} m²</div>
          </div>
          <div class="infoItem">
            <div class="k">实际占用</div>
            <div class="v">{{ fee.actualArea }} m²</div>
          </div>
          <div class="infoItem">
            <div class="k">超额面积</div>
            <div class="v" :class="fee.excessArea > 0 ? 'bad' : 'good'">
              {{ fee.excessArea > 0 ? '+' : '' }}{{ fee.excessArea }} m² ({{ fee.excessPercent.toFixed(1) }}%)
            </div>
          </div>
          <div class="infoItem">
            <div class="k">适用费率</div>
            <div class="v" :class="getTierColorClass(fee.excessPercent)">
              {{ fee.tierMultiplier }}x ({{ getTierLabel(fee.excessPercent) }})
            </div>
          </div>
        </div>

        <div class="calcCard">
          <div class="calcTitle">费用计算明细</div>
          <div class="calcRow"><span class="k">基础单价</span><span class="v">¥{{ fee.basePrice }}/m²/年</span></div>
          <div class="calcRow"><span class="k">超额面积</span><span class="v">{{ fee.excessArea }} m²</span></div>
          <div class="calcRow"><span class="k">基础费用</span><span class="v">¥{{ fee.baseCost.toLocaleString() }}</span></div>
          <div class="calcRow"><span class="k">阶梯加收</span><span class="v">¥{{ fee.tierCost.toLocaleString() }}</span></div>
          <div class="calcRow total"><span>应缴总额</span><span class="money">¥{{ fee.totalCost.toLocaleString() }}</span></div>

          <template v-if="fee.paidAmount > 0">
            <div class="calcRow paid"><span>已缴金额</span><span>-¥{{ fee.paidAmount.toLocaleString() }}</span></div>
            <div class="calcRow due"><span>待缴金额</span><span>¥{{ fee.remainingAmount.toLocaleString() }}</span></div>
          </template>
        </div>
      </div>

      <div class="modalFoot">
        <button class="btnGhost" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { ExtendedDepartmentFee, FeeStatus } from '~/server/utils/charging-db'

defineEmits<{
  close: []
}>()

defineProps<{
  isOpen: boolean
  fee: ExtendedDepartmentFee | null
  getStatusLabel: (s: FeeStatus) => string
  getStatusColorClass: (s: FeeStatus) => string
  getTierLabel: (p: number) => string
  getTierColorClass: (p: number) => string
}>()
</script>

<style scoped>
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.modal {
  width: 100%;
  max-width: 820px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.modalHead {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modalTitle {
  font-weight: 700;
  color: #1f2329;
}

.modalBody {
  padding: 14px;
}

.modalFoot {
  padding: 12px 14px;
  border-top: 1px solid #eef0f2;
  display: flex;
  justify-content: flex-end;
}

.iconBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #3370ff;
  padding: 2px;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  color: #1f2329;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.infoGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.infoItem .k {
  font-size: 12px;
  color: #8f959e;
}

.infoItem .v {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.bgGray { background: #f2f3f5; color: #646a73; }
.bgBlue { background: #eff6ff; color: #1d4ed8; }
.bgAmber { background: #fff7ed; color: #c2410c; }
.bgRed { background: #fef2f2; color: #dc2626; }
.bgPurple { background: #f3e8ff; color: #6d28d9; }
.bgGreen { background: #ecfdf5; color: #047857; }

.good { color: #16a34a; }
.bad { color: #dc2626; }

.calcCard {
  margin-top: 14px;
  background: #f5f6f7;
  border-radius: 12px;
  padding: 12px;
}

.calcTitle {
  font-weight: 700;
  margin-bottom: 10px;
  color: #1f2329;
}

.calcRow {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 6px 0;
}

.calcRow .k { color: #646a73; }

.calcRow.total {
  border-top: 1px solid #dee0e3;
  margin-top: 6px;
  padding-top: 10px;
  font-weight: 700;
}

.calcRow.paid { color: #047857; font-weight: 600; }
.calcRow.due { color: #dc2626; font-weight: 700; }
.money { color: #1f2329; }

@media (max-width: 600px) {
  .infoGrid { grid-template-columns: 1fr; }
}
</style>

