<template>
  <div v-if="isOpen && fee" class="modalMask" @click.self="handleClose">
    <div class="modal small">
      <div class="modalHead">
        <div class="modalTitle">发送催缴通知</div>
        <button class="iconBtn" @click="handleClose"><X :size="18" /></button>
      </div>

      <div class="modalBody">
        <div class="infoBox">
          <div class="infoRow">
            <div class="k">部门</div>
            <div class="v">{{ fee.departmentName }}</div>
          </div>
          <div class="infoRow">
            <div class="k">账单月份</div>
            <div class="v">{{ fee.month }}</div>
          </div>
          <div class="infoRow">
            <div class="k">待缴金额</div>
            <div class="v money">¥{{ fee.remainingAmount.toLocaleString() }}</div>
          </div>
          <div class="infoRow" v-if="fee.hasReminder">
            <div class="k">已催缴</div>
            <div class="v">{{ fee.reminderCount }} 次（最近：{{ fee.lastReminderAt }}）</div>
          </div>
        </div>

        <div class="field">
          <div class="label">备注（将合并到催缴内容中）</div>
          <textarea
            v-model="note"
            class="textarea"
            rows="3"
            placeholder="例如：请于本周五前完成确认/缴费，否则将影响后续用房申请…"
          />
        </div>

        <div class="reminderBtns">
          <button class="reminderBtn" @click="handleSend('System')">
            <div class="remIcon bgBlue"><Bell :size="18" /></div>
            <div>
              <div class="remTitle">系统通知</div>
              <div class="remDesc">发送站内消息通知</div>
            </div>
          </button>
          <button class="reminderBtn" @click="handleSend('OA')">
            <div class="remIcon bgPurple"><MessageSquare :size="18" /></div>
            <div>
              <div class="remTitle">OA通知</div>
              <div class="remDesc">通过办公自动化系统发送</div>
            </div>
          </button>
          <button class="reminderBtn" @click="handleSend('SMS')">
            <div class="remIcon bgGreen"><Send :size="18" /></div>
            <div>
              <div class="remTitle">短信通知</div>
              <div class="remDesc">发送短信到负责人手机</div>
            </div>
          </button>
        </div>
      </div>

      <div class="modalFoot">
        <button class="btnGhost" @click="handleClose">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Bell, MessageSquare, Send, X } from 'lucide-vue-next'
import type { ExtendedDepartmentFee, ReminderRecord } from '~/server/utils/charging-db'

const emit = defineEmits<{
  close: []
  send: [payload: { fee: ExtendedDepartmentFee; reminderType: ReminderRecord['reminderType']; content: string }]
}>()

const props = defineProps<{
  isOpen: boolean
  fee: ExtendedDepartmentFee | null
}>()

const note = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) note.value = ''
  }
)

function baseContent(fee: ExtendedDepartmentFee) {
  return `【催缴通知】${fee.departmentName}${fee.year}年度${fee.month}公房使用费账单待处理，待缴费用¥${fee.remainingAmount.toLocaleString()}。`
}

function handleSend(reminderType: ReminderRecord['reminderType']) {
  if (!props.fee) return

  const n = note.value.trim()
  const content = n ? `${baseContent(props.fee)}\n备注：${n}` : baseContent(props.fee)

  note.value = ''
  ;(emit as any)('send', { fee: props.fee, reminderType, content })
}

function handleClose() {
  note.value = ''
  emit('close')
}
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
  max-width: 560px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.modal.small {
  max-width: 560px;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.infoBox {
  background: #f9fafb;
  border: 1px solid #eef0f2;
  padding: 10px;
  border-radius: 10px;
}

.infoRow {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  padding: 4px 0;
}

.k {
  color: #8f959e;
}

.v {
  color: #1f2329;
  font-weight: 600;
}

.money {
  color: #1f2329;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  color: #8f959e;
}

.textarea {
  border: 1px solid #dee0e3;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
  resize: vertical;
}

.reminderBtns {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reminderBtn {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  gap: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.remIcon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remTitle {
  font-weight: 700;
  color: #1f2329;
  font-size: 13px;
}

.remDesc {
  font-size: 12px;
  color: #8f959e;
  margin-top: 2px;
}

.bgBlue {
  background: #eff6ff;
  color: #1d4ed8;
}

.bgPurple {
  background: #f3e8ff;
  color: #6d28d9;
}

.bgGreen {
  background: #ecfdf5;
  color: #047857;
}
</style>
