<template>
  <div class="list">
    <div v-for="b in items" :key="b.id" class="bill">
      <div class="bill__main">
        <div class="bill__head">
          <div class="bill__tenant">{{ b.tenant }}</div>
          <div class="bill__space">{{ b.spaceName }}</div>
          <span
            :class="[
              'badge',
              b.status === 'Paid'
                ? 'badge--success'
                : b.status === 'Overdue'
                  ? 'badge--danger'
                  : 'badge--warn',
            ]"
          >
            {{ statusText(b.status) }}
          </span>
        </div>

        <div class="bill__grid">
          <div class="kv">
            <div class="k">账期</div>
            <div class="v">{{ b.period }}</div>
          </div>
          <div class="kv">
            <div class="k">租金</div>
            <div class="v">¥{{ b.rentAmount.toLocaleString() }}</div>
          </div>
          <div v-if="b.lateFee" class="kv">
            <div class="k">滞纳金</div>
            <div class="v v--danger">¥{{ b.lateFee.toLocaleString() }}</div>
          </div>
          <div class="kv">
            <div class="k">应缴总额</div>
            <div class="v">¥{{ b.totalAmount.toLocaleString() }}</div>
          </div>
          <div class="kv">
            <div class="k">待缴金额</div>
            <div :class="['v', remainAmount(b) > 0 ? 'v--danger' : 'v--success']">
              ¥{{ remainAmount(b).toLocaleString() }}
            </div>
          </div>
        </div>

        <div v-if="b.reminderCount > 0 && b.status !== 'Paid'" class="bill__hint">
          已催缴 {{ b.reminderCount }} 次<span v-if="b.lastReminderDate">（最近：{{ b.lastReminderDate }}）</span>
        </div>

        <div v-if="b.status === 'Paid'" class="bill__hint bill__hint--success">
          已缴清：¥{{ b.paidAmount.toLocaleString() }}
          <span v-if="b.paidDate">（{{ b.paidDate }}）</span>
          <span v-if="b.paymentMethod">｜{{ b.paymentMethod }}</span>
          <span v-if="b.transactionNo">｜流水号：{{ b.transactionNo }}</span>
        </div>
      </div>

      <div v-if="adminMode" class="bill__actions">
        <button class="btn" :disabled="b.status === 'Paid'" @click="$emit('remind', b)">
          催缴
        </button>
        <button class="btn btn--primary" :disabled="b.status === 'Paid'" @click="$emit('pay', b)">
          登记缴费
        </button>
      </div>
    </div>

    <div v-if="items.length === 0" class="empty">暂无账单数据</div>
  </div>
</template>

<script setup lang="ts">
import type { OperatingRentBill } from '~/services/operating'

defineProps<{
  items: OperatingRentBill[]
  adminMode?: boolean
}>()

defineEmits<{
  (e: 'remind', item: OperatingRentBill): void
  (e: 'pay', item: OperatingRentBill): void
}>()

function remainAmount(b: OperatingRentBill) {
  return Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0))
}

function statusText(status: OperatingRentBill['status']) {
  switch (status) {
    case 'Paid':
      return '已缴清'
    case 'Overdue':
      return '已逾期'
    default:
      return '待缴纳'
  }
}
</script>

<style scoped>
.list {
  display: grid;
  gap: 12px;
}

.bill {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 14px;
  background: #fff;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.bill__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bill__tenant {
  font-weight: 800;
  color: var(--text);
}

.bill__space {
  color: var(--muted);
  font-size: 13px;
}

.bill__grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.kv .k {
  font-size: 12px;
  color: var(--muted);
}

.kv .v {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
}

.v--danger {
  color: #dc2626;
}

.v--success {
  color: #16a34a;
}

.bill__hint {
  margin-top: 10px;
  font-size: 12px;
  color: #b45309;
}

.bill__hint--success {
  color: #16a34a;
}

.bill__actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge--success {
  background: #eefdf3;
  color: #16a34a;
}

.badge--warn {
  background: #fffbeb;
  color: #d97706;
}

.badge--danger {
  background: #fef2f2;
  color: #dc2626;
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
}

@media (max-width: 960px) {
  .bill {
    flex-direction: column;
  }

  .bill__grid {
    grid-template-columns: 1fr 1fr;
  }

  .bill__actions {
    justify-content: flex-end;
  }
}
</style>
