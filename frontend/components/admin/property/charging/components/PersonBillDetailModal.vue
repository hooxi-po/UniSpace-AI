<template>
  <div v-if="isOpen && bill" class="mask" @click.self="$emit('close')">
    <div class="modal">
      <div class="head">
        <div class="title">账单详情 - {{ bill.personName }}</div>
        <button class="iconBtn" @click="$emit('close')"><X :size="18" /></button>
      </div>

      <div class="body">
        <div class="grid">
          <div class="item">
            <div class="k">月份</div>
            <div class="v">{{ bill.month }}</div>
          </div>
          <div class="item">
            <div class="k">部门</div>
            <div class="v">{{ bill.departmentName }}</div>
          </div>
          <div class="item">
            <div class="k">定额面积</div>
            <div class="v">{{ bill.quotaArea }} ㎡</div>
          </div>
          <div class="item">
            <div class="k">实际面积</div>
            <div class="v">{{ bill.actualArea }} ㎡</div>
          </div>
          <div class="item">
            <div class="k">超额面积</div>
            <div class="v" :class="bill.excessArea > 0 ? 'bad' : 'good'">{{ bill.excessArea }} ㎡</div>
          </div>
          <div class="item">
            <div class="k">费率倍数</div>
            <div class="v">{{ bill.tierMultiplier }}x</div>
          </div>
        </div>

        <div class="calc">
          <div class="calcTitle">费用计算明细</div>
          <div class="row"><span class="k">基础单价</span><span class="v">¥{{ bill.basePrice }}/m²/年</span></div>
          <div class="row"><span class="k">超额面积</span><span class="v">{{ bill.excessArea }} m²</span></div>
          <div class="row"><span class="k">基础费用</span><span class="v">¥{{ bill.baseCost.toLocaleString() }}</span></div>
          <div class="row"><span class="k">阶梯加收</span><span class="v">¥{{ bill.tierCost.toLocaleString() }}</span></div>
          <div class="row total"><span>合计</span><span class="money">¥{{ bill.amount.toLocaleString() }}</span></div>

          <div class="row" v-if="bill.paidAt"><span class="k">缴费时间</span><span class="v">{{ bill.paidAt }}</span></div>
        </div>
      </div>

      <div class="foot">
        <button class="btnGhost" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { PersonFeeBill } from '~/server/utils/charging-db'

defineEmits<{ close: [] }>()

defineProps<{
  isOpen: boolean
  bill: PersonFeeBill | null
}>()
</script>

<style scoped>
.mask {
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
  max-width: 720px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.head {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-weight: 700;
  color: #1f2329;
}

.iconBtn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #3370ff;
  padding: 2px;
}

.body {
  padding: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.item .k {
  font-size: 12px;
  color: #8f959e;
}

.item .v {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.good { color: #16a34a; }
.bad { color: #dc2626; }

.calc {
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

.row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.row .k { color: #646a73; }

.row.total {
  border-top: 1px solid #dee0e3;
  padding-top: 10px;
  margin-top: 6px;
  font-weight: 700;
}

.money { color: #1f2329; }

.foot {
  padding: 12px 14px;
  border-top: 1px solid #eef0f2;
  display: flex;
  justify-content: flex-end;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  color: #1f2329;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
}
</style>

