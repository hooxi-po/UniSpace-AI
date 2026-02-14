<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal small" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">新增临时借用</div>
          <div class="modalSub">管理员主动录入的校内单位间房源临时借用协议。</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>

      <div class="modalBody">
        <div class="formGrid">
          <div class="formItem">
            <label>借出部门 (所有权方) *</label>
            <input v-model="form.ownerDept" class="input" placeholder="例如：物理学院" />
          </div>
          <div class="formItem">
            <label>借入部门 (使用方) *</label>
            <input v-model="form.borrowerDept" class="input" placeholder="例如：科研处" />
          </div>
          <div class="formItem">
            <label>楼栋 *</label>
            <select v-model="form.buildingName" class="select">
              <option value="">请选择楼栋</option>
              <option v-for="b in buildings" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>
          <div class="formItem">
            <label>房间号 *</label>
            <input v-model="form.roomNo" class="input" placeholder="例如：204" />
          </div>
          <div class="formItem">
            <label>借用开始日期 *</label>
            <input v-model="form.startDate" type="date" class="input" />
          </div>
          <div class="formItem">
            <label>借用结束日期 *</label>
            <input v-model="form.endDate" type="date" class="input" />
          </div>
        </div>

        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">取消</button>
          <button class="btnPrimary" :disabled="!isValid" @click="submit">保存记录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'

const props = defineProps<{
  buildings: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: any): void
}>()

const form = reactive({
  ownerDept: '',
  borrowerDept: '',
  buildingName: '',
  roomNo: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: ''
})

const isValid = computed(() => {
  return form.ownerDept.trim() && 
         form.borrowerDept.trim() && 
         form.buildingName && 
         form.roomNo.trim() && 
         form.startDate && 
         form.endDate
})

function submit() {
  if (!isValid.value) return
  emit('submit', { ...form })
}
</script>

<style scoped>
.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}
.modalHeader {
  padding: 16px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.modalTitle {
  font-weight: 700;
  font-size: 18px;
}
.modalSub {
  font-size: 12px;
  color: #8f959e;
  margin-top: 4px;
}
.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}
.modalBody {
  padding: 16px;
}
.formGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
label {
  display: block;
  font-size: 13px;
  color: #1f2329;
  margin-bottom: 8px;
}
.input, .select {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}
.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}
.btnPrimary:disabled {
  opacity: 0.5;
}
</style>

