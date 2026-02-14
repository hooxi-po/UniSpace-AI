<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal small" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">{{ type === 'Exchange' ? '申请换房' : '申请退房' }}</div>
          <div class="modalSub">提交申请后，资产处将进行审批并协助办理。</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>

      <div class="modalBody">
        <div class="formGrid">
          <div class="formItem">
            <label>申请部门 *</label>
            <input v-model="form.department" class="input" placeholder="请输入部门" />
          </div>
          <div class="formItem">
            <label>申请人 *</label>
            <input v-model="form.applicant" class="input" placeholder="请输入姓名" />
          </div>
          <div class="formItem">
            <label>现用楼栋 *</label>
            <select v-model="form.fromBuildingName" class="select">
              <option value="">请选择楼栋</option>
              <option v-for="b in buildings" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>
          <div class="formItem">
            <label>现用房间号 *</label>
            <input v-model="form.fromRoomNo" class="input" placeholder="例如：101" />
          </div>
          <div class="formItem">
            <label>房间面积 (m²) *</label>
            <input v-model.number="form.fromArea" type="number" class="input" />
          </div>
          <div class="formItem full">
            <label>{{ type === 'Exchange' ? '换房原因 *' : '退房原因 *' }}</label>
            <textarea v-model="form.reason" class="textarea" :placeholder="type === 'Exchange' ? '请说明换房原因及需求' : '请说明退房原因'"></textarea>
          </div>
        </div>

        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">取消</button>
          <button class="btnPrimary" :disabled="!isValid" @click="submit">提交申请</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'

const props = defineProps<{
  type: 'Exchange' | 'Return'
  buildings: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: any): void
}>()

const form = reactive({
  department: '',
  applicant: '',
  fromBuildingName: '',
  fromRoomNo: '',
  fromArea: 0,
  reason: ''
})

const isValid = computed(() => {
  return form.department.trim() && form.applicant.trim() && form.fromBuildingName && form.fromRoomNo.trim() && form.fromArea > 0 && form.reason.trim()
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
  max-width: 600px;
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
  color: #1f2329;
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
.formItem.full {
  grid-column: 1 / -1;
}
label {
  display: block;
  font-size: 13px;
  color: #1f2329;
  margin-bottom: 8px;
}
.input, .select, .textarea {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.textarea {
  min-height: 100px;
  resize: vertical;
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
  cursor: not-allowed;
}
</style>

