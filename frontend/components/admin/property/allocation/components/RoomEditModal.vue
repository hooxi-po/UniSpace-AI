<template>
  <div class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modalHeader">
        <div>
          <div class="modalTitle">房源编辑 / 分配</div>
          <div v-if="room" class="modalSub">{{ room.buildingName }} · {{ room.roomNo }}</div>
        </div>
        <button class="closeBtn" @click="$emit('close')">关闭</button>
      </div>

      <div v-if="room" class="modalBody">
        <div class="grid">
          <div class="formItem">
            <label>楼栋</label>
            <div class="displayField">{{ room.buildingName }}</div>
          </div>
          <div class="formItem">
            <label>房间号</label>
            <div class="displayField">{{ room.roomNo }}</div>
          </div>
          <div class="formItem">
            <label>楼层</label>
            <div class="displayField">{{ room.floor }}F</div>
          </div>
          <div class="formItem">
            <label>面积(m²)</label>
            <div class="displayField">{{ room.area }} m²</div>
          </div>
          <div class="formItem">
            <label>功能主类</label>
            <div class="displayField">{{ room.functionMain || '未设置' }}</div>
          </div>
          <div class="formItem">
            <label>功能亚类</label>
            <div class="displayField">{{ room.functionSub || '未设置' }}</div>
          </div>
          <div class="formItem">
            <label>当前状态</label>
            <div :class="['badge', room.status === 'Empty' ? 'badgeOk' : 'badgeGray']">
              {{ room.status === 'Empty' ? '可分配' : '已占用' }}
            </div>
          </div>
          <div class="formItem">
            <label>分配对象类型 *</label>
            <div class="radioRow">
              <label class="radioItem">
                <input v-model="assigneeType" type="radio" value="college" :disabled="room.status !== 'Empty'" />
                <span>学院</span>
              </label>
              <label class="radioItem">
                <input v-model="assigneeType" type="radio" value="person" :disabled="room.status !== 'Empty'" />
                <span>个人</span>
              </label>
            </div>
          </div>
          <div class="formItem">
            <label>分配对象名称 *</label>
            <input
              v-model="assigneeName"
              class="input"
              :placeholder="assigneeType === 'college' ? '请输入学院名称' : '请输入个人姓名'"
              :disabled="room.status !== 'Empty'"
            />
          </div>
          <div class="formItem full">
            <label>分配通知内容 *</label>
            <textarea
              v-model="notificationContent"
              class="textarea"
              placeholder="请输入通知内容，例如：该房间已正式分配给贵单位使用。"
              :disabled="room.status !== 'Empty'"
            ></textarea>
          </div>
        </div>

        <div class="actions">
          <button class="btnGhost" @click="$emit('close')">取消</button>
          <button 
            v-if="room.status === 'Empty'"
            class="btnPrimary" 
            :disabled="saving || !isAllocationValid" 
            @click="save"
          >
            确认主动分配
          </button>
          <div v-else class="statusHint">已占用房源不可再次直接分配</div>
        </div>
      </div>

      <div v-else class="modalBody empty">未选择房间</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Room } from '~/server/utils/fixation-stock-db'

const props = defineProps<{ room: Room | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { id: string; updates: Partial<Room>; notification: string; assigneeType: 'college' | 'person' }): void
}>()

const saving = ref(false)

const notificationContent = ref('')

const local = reactive<Partial<Room>>({})

const assigneeType = ref<'college' | 'person'>('college')
const assigneeName = ref('')

const isAllocationValid = computed(() => {
  return !!props.room && props.room.status === 'Empty' && assigneeName.value.trim() && notificationContent.value.trim()
})

watch(
  () => props.room,
  (r) => {
    Object.assign(local, r || {})
  },
  { immediate: true }
)

async function save() {
  if (!props.room || !isAllocationValid.value) return
  saving.value = true
  try {
    emit('save', {
      id: props.room.id,
      updates: {
        status: 'Occupied',
        department: assigneeName.value.trim(),
      },
      notification: notificationContent.value.trim(),
      assigneeType: assigneeType.value
    })
  } finally {
    saving.value = false
  }
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
  z-index: 80;
}

.modal {
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.modalHeader {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modalTitle {
  font-weight: 800;
  color: #1f2329;
}

.modalSub {
  margin-top: 2px;
  font-size: 12px;
  color: #8f959e;
}

.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.modalBody {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.formItem.full {
  grid-column: 1 / -1;
}

label {
  display: block;
  font-size: 12px;
  color: #646a73;
  margin-bottom: 6px;
}

.displayField {
  width: 100%;
  background: #f5f6f7;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: #1f2329;
}

.radioRow {
  display: flex;
  gap: 16px;
  padding: 8px 0;
}

.radioItem {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #1f2329;
}

.input,
.select,
.textarea {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.textarea {
  min-height: 80px;
  resize: vertical;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
}

.badgeOk { background: #dcfce7; color: #15803d; }
.badgeGray { background: #e5e7eb; color: #374151; }

.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.statusHint {
  font-size: 13px;
  color: #8f959e;
}

.btnGhost {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}

.btnPrimary {
  border: 1px solid #3370ff;
  background: #3370ff;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}

.btnPrimary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  color: #8f959e;
  text-align: center;
  padding: 24px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>

