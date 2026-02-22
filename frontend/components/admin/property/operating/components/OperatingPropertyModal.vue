<template>
  <div v-if="isOpen" class="modalMask" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal__header">
        <h3 class="modal__title">{{ initial ? '编辑房源' : '发布房源' }}</h3>
        <button class="modal__close" @click="$emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="modal__body">
        <div class="formGrid">
          <div class="formItem">
            <label class="formItem__label">所属楼栋</label>
            <input v-model="form.buildingName" type="text" class="formItem__input" placeholder="例如: 综合实验楼" />
          </div>

          <div class="formItem">
            <label class="formItem__label">楼层</label>
            <select v-model="form.floor" class="formItem__input">
              <option v-for="f in floorOptions" :key="f" :value="f">{{ f }}层</option>
            </select>
          </div>

          <div class="formItem">
            <label class="formItem__label">房间号</label>
            <select v-model="form.roomNumber" class="formItem__input">
              <option v-for="r in roomNumberOptions" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>

          <div class="formItem">
            <label class="formItem__label">用途</label>
            <select v-model="form.purpose" class="formItem__input">
              <option value="商铺">商铺</option>
              <option value="办公室">办公室</option>
              <option value="培训中心">培训中心</option>
              <option value="实验场地">实验场地</option>
            </select>
          </div>

          <div class="formItem">
            <label class="formItem__label">建筑面积 (m²)</label>
            <input 
              v-model.number="form.area" 
              type="number" 
              class="formItem__input" 
              placeholder="例如: 120"
            />
          </div>

          <div class="formItem">
            <label class="formItem__label">参考月租 (元)</label>
            <input 
              v-model.number="form.monthlyRent" 
              type="number" 
              class="formItem__input" 
              placeholder="例如: 10000"
            />
          </div>

          <div class="formItem fullWidth">
            <label class="formItem__label">房源说明 (备注)</label>
            <textarea 
              v-model="form.description" 
              class="formItem__input textarea" 
              placeholder="请输入房源详细说明，如配套设施、招租要求等"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn--secondary" @click="$emit('close')">取消</button>
        <button 
          class="btn btn--primary" 
          :disabled="!isFormValid"
          @click="handleSubmit"
        >
          确认发布
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { OperatingSpaceItem } from '~/services/operating'

const props = defineProps<{
  isOpen: boolean
  initial?: OperatingSpaceItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: {
    name: string
    buildingName: string
    floor: string
    roomNumber: string
    purpose: OperatingSpaceItem['purpose']
    area: number
    monthlyRent: number
    description: string
  }): void
}>()

const floorOptions = ['一', '二', '三', '四', '五', '六', '七']

const form = reactive({
  buildingName: '',
  floor: '一',
  roomNumber: '101',
  purpose: '商铺',
  area: null as number | null,
  monthlyRent: null as number | null,
  description: ''
})

const roomNumberOptions = computed(() => {
  const floorIdx = floorOptions.indexOf(form.floor) + 1
  return Array.from({ length: 20 }, (_, i) => `${floorIdx}${String(i + 1).padStart(2, '0')}`)
})

const isFormValid = computed(() => {
  return form.buildingName.trim() && form.area && form.area > 0 && form.monthlyRent && form.monthlyRent > 0
})

function applyInitial(val: OperatingSpaceItem | null | undefined) {
  if (!val) {
    form.buildingName = ''
    form.floor = '一'
    form.roomNumber = '101'
    form.purpose = '商铺'
    form.area = null
    form.monthlyRent = null
    form.description = ''
    return
  }

  // 优先使用结构化字段（若后端/Mock 已提供）
  if (val.buildingName) form.buildingName = val.buildingName
  if (val.description) form.description = val.description

  // 兜底：从名称解析（兼容两种格式）
  // 1) "一层 101 商铺"
  // 2) "创新创业中心416" -> buildingName=创新创业中心, roomNumber=416, floor 根据 roomNumber 首位推断
  const name = String(val.name ?? '').trim()

  const withSpaces = name.match(/^(.+?)层\s+(\d{3,4})\s+(.+)$/)
  if (withSpaces) {
    form.floor = withSpaces[1]
    form.roomNumber = withSpaces[2]
    form.purpose = withSpaces[3]
  } else {
    const compact = name.match(/^(.*?)(\d{3,4})$/)
    if (compact) {
      const maybeBuilding = compact[1].trim()
      const room = compact[2]
      if (!form.buildingName && maybeBuilding) form.buildingName = maybeBuilding
      form.roomNumber = room
      // 通过房号首位推断楼层：416 -> 四层，1203 -> 十二层（仅用于 UI 回填）
      const floorNumStr = room.length === 3 ? room.slice(0, 1) : room.slice(0, 2)
      const floorMap: Record<string, string> = {
        '1': '一',
        '2': '二',
        '3': '三',
        '4': '四',
        '5': '五',
        '6': '六',
        '7': '七',
        '8': '八',
        '9': '九',
        '10': '十',
        '11': '十一',
        '12': '十二',
        '13': '十三',
        '14': '十四',
        '15': '十五',
      }
      form.floor = floorMap[floorNumStr] ?? form.floor
    }
  }

  // 如果仍然没解析出楼栋，保留空值让用户补齐
  form.area = val.area
  form.monthlyRent = val.monthlyRent
}

watch(
  () => props.initial,
  (val) => {
    applyInitial(val)
  },
  { immediate: true }
)

function handleSubmit() {
  if (!isFormValid.value) return
  emit('submit', {
    name: `${form.buildingName}${form.roomNumber}`,
    buildingName: form.buildingName,
    floor: form.floor,
    roomNumber: form.roomNumber,
    purpose: form.purpose as OperatingSpaceItem['purpose'],
    area: form.area!,
    monthlyRent: form.monthlyRent!,
    description: form.description
  })
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
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.modal__close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: 4px;
}

.modal__close:hover {
  background: #f1f2f3;
  color: var(--text);
}

.modal__body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.formGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.formItem {
  display: grid;
  gap: 6px;
}

.formItem.fullWidth {
  grid-column: 1 / -1;
}

.formItem__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.formItem__input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  background: #fff;
}

.formItem__input:focus {
  border-color: var(--primary);
}

.formItem__input.textarea {
  min-height: 80px;
  resize: vertical;
}

.modal__footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--primary {
  background: var(--primary);
  color: #fff;
  border: none;
}

.btn--primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--secondary {
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn--secondary:hover {
  background: #f8fafc;
}
</style>
