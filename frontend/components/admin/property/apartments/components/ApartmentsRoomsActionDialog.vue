<template>
  <div v-if="open" class="mask" @click.self="$emit('close')">
    <div class="dialog">
      <div class="header">
        <div class="title">{{ mode === 'vacate' ? '确认腾退' : '床位再分配' }}</div>
        <div class="sub">{{ room?.buildingName }} {{ room?.roomNo }}</div>
      </div>

      <template v-if="mode === 'reassign'">
        <div class="splitGrid">
          <div class="panel">
            <div class="panelTitle">来源床位（当前房间）</div>
            <label class="field">
              <span>来源床位</span>
              <select :value="sourceBedNo" class="input" @change="$emit('update:sourceBedNo', ($event.target as HTMLSelectElement).value)">
                <option value="">请选择来源床位</option>
                <option v-for="bed in sourceBeds" :key="bed" :value="bed">{{ bed }}</option>
              </select>
            </label>
          </div>

          <div class="panel">
            <div class="panelTitle">目标床位</div>
            <label class="field">
              <span>目标楼栋</span>
              <select :value="targetBuildingCode" class="input" @change="$emit('update:targetBuildingCode', ($event.target as HTMLSelectElement).value)">
                <option value="">请选择楼栋</option>
                <option v-for="item in targetBuildingOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>

            <label class="field">
              <span>目标楼层</span>
              <select :value="targetFloor" class="input" @change="$emit('update:targetFloor', Number(($event.target as HTMLSelectElement).value) || null)">
                <option value="">请选择楼层</option>
                <option v-for="floor in targetFloorOptions" :key="floor" :value="floor">{{ floor }} 层</option>
              </select>
            </label>

            <label class="field">
              <span>目标房间</span>
              <select :value="targetRoomId" class="input" @change="$emit('update:targetRoomId', ($event.target as HTMLSelectElement).value)">
                <option value="">请选择房间</option>
                <option v-for="item in targetRoomOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>

            <label class="field">
              <span>目标床位</span>
              <select :value="targetBedNo" class="input" @change="$emit('update:targetBedNo', ($event.target as HTMLSelectElement).value)">
                <option value="">请选择目标床位</option>
                <option v-for="bed in targetBeds" :key="bed" :value="bed">{{ bed }}</option>
              </select>
            </label>
          </div>
        </div>

        <label class="field">
          <span>住户/部门（用于记录）</span>
          <input :value="reassignDepartment" class="input" @input="$emit('update:reassignDepartment', ($event.target as HTMLInputElement).value)" />
        </label>

        <div v-if="bedTransferPreview" class="preview">{{ bedTransferPreview }}</div>
      </template>

      <label class="field">
        <span>原住户（通知用，可选）</span>
        <input :value="oldTenantName" class="input" @input="$emit('update:oldTenantName', ($event.target as HTMLInputElement).value)" />
      </label>

      <label class="field">
        <span>通知备注（可选）</span>
        <textarea :value="noticeRemark" class="input" rows="2" @input="$emit('update:noticeRemark', ($event.target as HTMLTextAreaElement).value)" />
      </label>

      <div class="actions">
        <button class="btn" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" :disabled="submitting" @click="$emit('submit')">{{ submitting ? '处理中...' : '确认' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApartmentRoom } from '~/services/apartments'

defineProps<{
  open: boolean
  submitting: boolean
  mode: 'vacate' | 'reassign'
  room: ApartmentRoom | null
  reassignDepartment: string
  oldTenantName: string
  noticeRemark: string
  sourceBeds: string[]
  sourceBedNo: string
  targetBuildingCode: string
  targetFloor: number | null
  targetRoomId: string
  targetBedNo: string
  targetBuildingOptions: Array<{ label: string; value: string }>
  targetFloorOptions: number[]
  targetRoomOptions: Array<{ label: string; value: string }>
  targetBeds: string[]
  bedTransferPreview: string
}>()

defineEmits([
  'close',
  'submit',
  'update:reassignDepartment',
  'update:oldTenantName',
  'update:noticeRemark',
  'update:sourceBedNo',
  'update:targetBuildingCode',
  'update:targetFloor',
  'update:targetRoomId',
  'update:targetBedNo',
])
</script>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { width: min(760px, 94vw); background: #fff; border: 1px solid var(--border, #dfe3ea); border-radius: 12px; padding: 14px; display: grid; gap: 10px; }
.header { border-bottom: 1px solid var(--border-light, #edf0f5); padding-bottom: 8px; }
.title { font-size: 16px; font-weight: 700; }
.sub { color: #646a73; font-size: 13px; margin-top: 2px; }
.splitGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.panel { border: 1px solid var(--border-light, #edf0f5); border-radius: 10px; padding: 10px; display: grid; gap: 8px; }
.panelTitle { font-size: 13px; font-weight: 700; color: #1f2329; }
.field { display: grid; gap: 6px; font-size: 12px; color: #646a73; }
.input { border: 1px solid var(--border, #dfe3ea); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.preview { font-size: 12px; color: #225fbe; background: #eef5ff; border-radius: 8px; padding: 8px 10px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn { border: 1px solid var(--border, #dfe3ea); background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.btn--primary { border-color: #3370ff; background: #3370ff; color: #fff; }
@media (max-width: 760px) { .splitGrid { grid-template-columns: 1fr; } }
</style>
