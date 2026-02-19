<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">房间功能划分</h2>
        <p class="desc">对“待归档 / 已归档”的项目进行房间功能划分，为高基表映射做准备。</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="search">
        <Search class="searchIcon" :size="16" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索项目名称/编号..." />
      </div>
      <div class="count">共 {{ filteredProjects.length }} 项待处理</div>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>项目编号</th>
            <th>项目名称</th>
            <th>房间数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProjects" :key="p.id" class="row">
            <td class="mono">{{ p.id }}</td>
            <td class="name">{{ p.name }}</td>
            <td class="muted">{{ p.roomCount || '-' }}</td>
            <td>
              <button class="link" type="button" @click="openDialog(p.id)">
                <Layers :size="14" />
                功能划分
              </button>
            </td>
          </tr>

          <tr v-if="!loading && filteredProjects.length === 0">
            <td class="empty" colspan="4">暂无“待归档 / 已归档”的项目需要进行房间功能划分。</td>
          </tr>
          <tr v-if="loading">
            <td class="empty" colspan="4">加载中...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedProject" class="mask" @click="closeDialog">
      <div class="modal" @click.stop>
        <div class="modalHeader">
          <div>
            <div class="modalTitle">房间功能划分：{{ selectedProject.name }}</div>
            <div class="modalSub">{{ selectedProject.id }}</div>
          </div>
          <button class="iconBtn" type="button" @click="closeDialog">
            <X :size="18" />
          </button>
        </div>

        <div class="modalBody">
          <div class="alertSection">
            <div class="warningBox">
              <AlertCircle :size="18" class="warningIcon" />
              <div>
                <div class="warningTitle">归档前必须完成建筑-房间管理（按主类/亚类）。</div>
                <div :class="['statusText', selectedProject.roomFunctionPlanConfirmed ? 'confirmed' : 'unconfirmed']">
                  {{ selectedProject.roomFunctionPlanConfirmed ? '已确认：可以进行归档' : '未确认：归档将被阻止' }}
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panelTitle">新增房间</div>
            <div class="addRow">
              <div class="field">
                <label>建筑</label>
                <input v-model="addForm.buildingName" class="input" disabled placeholder="同步名称" />
              </div>
              <div class="field">
                <label>楼层</label>
                <select v-model="addForm.floor" class="input" :disabled="!isEditable">
                  <option value="">选择楼层</option>
                  <option v-for="f in floorOptions" :key="f" :value="String(f)">{{ f }}F</option>
                </select>
              </div>
              <div class="field">
                <label>房间号</label>
                <input v-model="addForm.roomNo" class="input" :disabled="!isEditable" placeholder="如：305" />
              </div>
              <div class="field">
                <label>面积(㎡)</label>
                <input v-model.number="addForm.area" class="input" :disabled="!isEditable" type="number" min="0" placeholder="如：85" />
              </div>
              <div class="field">
                <label>主类</label>
                <select v-model="addForm.mainCategory" class="input" :disabled="!isEditable">
                  <option value="">选择主类</option>
                  <option v-for="m in MAIN_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
              </div>
              <div class="field">
                <label>亚类</label>
                <select v-model="addForm.subCategory" class="input" :disabled="!isEditable || !addForm.mainCategory">
                  <option value="">选择亚类</option>
                  <option v-for="s in subOptionsFor(addForm.mainCategory)" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
              </div>
              <div class="field">
                <label>备注</label>
                <input v-model="addForm.notes" class="input" :disabled="!isEditable" placeholder="填写备注" />
              </div>
              <div class="field">
                <label>操作</label>
                <button class="btnPrimary fullWidth" type="button" :disabled="!isEditable" @click="addPlan">
                  <Plus :size="14" />
                  添加
                </button>
              </div>
            </div>
            <div class="hintSub">说明：建筑名自动同步；楼层/房间号/面积可同步或手填；主亚类级联选择。</div>
          </div>

          <!-- 数据表格 -->
          <div class="card overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>建筑</th>
                  <th>楼层</th>
                  <th>房间号</th>
                  <th class="right">面积(㎡)</th>
                  <th>主类</th>
                  <th>亚类</th>
                  <th>备注</th>
                  <th class="center">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in planList" :key="item.id">
                  <td>
                    <input v-model="item.buildingName" class="input tiny" disabled />
                  </td>
                  <td>
                    <select v-model="(item as any).floor" class="input tiny w-16" :disabled="!isEditable">
                      <option value="">-</option>
                      <option v-for="f in floorOptions" :key="f" :value="String(f)">{{ f }}F</option>
                    </select>
                  </td>
                  <td>
                    <input v-model="item.roomNo" class="input tiny" :disabled="!isEditable" />
                  </td>
                  <td class="right">
                    <input v-model.number="item.area" class="input tiny w-20" :disabled="!isEditable" type="number" min="0" />
                  </td>
                  <td>
                    <select v-model="item.mainCategory" class="input tiny" :disabled="!isEditable">
                      <option value="">-</option>
                      <option v-for="m in MAIN_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="item.subCategory" class="input tiny" :disabled="!isEditable || !item.mainCategory">
                      <option value="">-</option>
                      <option v-for="s in subOptionsFor(item.mainCategory)" :key="s.value" :value="s.value">{{ s.label }}</option>
                    </select>
                  </td>
                  <td>
                    <input v-model="(item as any).notes" class="input tiny" :disabled="!isEditable" placeholder="备注" />
                  </td>
                  <td class="center">
                    <button class="iconDanger" type="button" :disabled="!isEditable" title="删除" @click="removePlan(item.id)">
                      <Trash2 :size="16" />
                    </button>
                  </td>
                </tr>
                <tr v-if="planList.length === 0">
                  <td class="empty" colspan="8">暂无房间计划</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="actions">
            <button class="btn" type="button" @click="closeDialog">关闭</button>
            <button class="btnPrimary" type="button" :disabled="!isEditable || saving" @click="savePlan">
              <Save :size="14" />
              {{ saving ? '保存中...' : '保存更改' }}
            </button>
            <button class="btnGreen" type="button" :disabled="!isEditable || saving" @click="confirmAndSync">
              <CheckCircle2 :size="14" />
              确认并同步
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { AlertCircle, CheckCircle2, Layers, Plus, Save, Search, Trash2, X } from 'lucide-vue-next'
import { useFixationAudit } from '~/composables/useFixationAudit'
import { fixationService } from '~/services/fixation'
import type { RoomPlanItem } from '~/server/utils/fixation-audit-db'

const { projects, loading } = useFixationAudit()

const searchTerm = ref('')
const selectedProjectId = ref<string | null>(null)
const saving = ref(false)

const selectedProject = computed(() => {
  if (!selectedProjectId.value) return null
  return projects.value.find(p => p.id === selectedProjectId.value) || null
})

const isEditable = computed(() => {
  if (!selectedProject.value) return false
  return selectedProject.value.status === 'PendingArchive' || selectedProject.value.status === 'Archived'
})

const filteredProjects = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  return projects.value
    .filter(p => p.status === 'PendingArchive' || p.status === 'Archived')
    .filter(p => {
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    })
})

const planList = ref<RoomPlanItem[]>([])

const addForm = reactive<{ buildingName: string; floor: string; roomNo: string; area: number | null; mainCategory: string; subCategory: string; notes: string }>({
  buildingName: '',
  floor: '',
  roomNo: '',
  area: null,
  mainCategory: '',
  subCategory: '',
  notes: '',
})

const MAIN_OPTIONS = [
  { value: 'Teaching', label: '教学用房' },
  { value: 'Research', label: '科研用房' },
  { value: 'Administration', label: '行政办公用房' },
  { value: 'LifeService', label: '生活服务用房' },
  { value: 'Commercial', label: '经营性用房' },
  { value: 'Auxiliary', label: '附属用房' },
] as const

const SUB_OPTIONS: Record<string, { value: string; label: string }[]> = {
  Teaching: [
    { value: 'TheoryClassroom', label: '理论教室' },
    { value: 'PracticeClassroom', label: '实践教室' },
    { value: 'SmartClassroom', label: '智慧教室' },
    { value: 'ExamClassroom', label: '考试专用教室' },
  ],
  Research: [
    { value: 'BasicLab', label: '基础实验室' },
    { value: 'ProfessionalLab', label: '专业实验室' },
    { value: 'KeyLab', label: '重点实验室' },
    { value: 'ResearchSupport', label: '科研辅助用房' },
  ],
  Administration: [
    { value: 'AdminDeptOffice', label: '职能部门办公室' },
    { value: 'CollegeOffice', label: '院系办公用房' },
    { value: 'MeetingReception', label: '会议接待用房' },
    { value: 'PublicServiceOffice', label: '公共办公服务区' },
  ],
  LifeService: [
    { value: 'StudentDorm', label: '学生宿舍' },
    { value: 'StaffTurnover', label: '教职工周转房' },
    { value: 'DiningService', label: '餐饮服务用房' },
    { value: 'PublicServiceLife', label: '公共服务用房' },
  ],
  Commercial: [
    { value: 'CampusCommercial', label: '校园商业用房' },
    { value: 'IndustryCoop', label: '校企合作用房' },
    { value: 'ExternalLease', label: '对外租赁用房' },
  ],
  Auxiliary: [
    { value: 'LogisticsSupport', label: '后勤保障用房' },
    { value: 'SecurityEmergency', label: '安防应急用房' },
    { value: 'OtherAuxiliary', label: '其他附属用房' },
  ],
}

function subOptionsFor(mainCategory: any) {
  const key = String(mainCategory || '')
  return SUB_OPTIONS[key] || []
}

const floorOptions = computed(() => {
  const n = Number((selectedProject.value as any)?.floorCount || 0)
  if (!Number.isFinite(n) || n <= 0) return [] as number[]
  return Array.from({ length: n }, (_, i) => i + 1)
})

watch(selectedProject, (p) => {
  const projName = String((p as any)?.name || '').trim()

  // 1) 若项目已有“房间划分（可选）”生成的 roomFunctionPlan，则优先同步并锁定建筑名称
  const raw = (((p as any)?.roomFunctionPlan || []) as any[])
  const fromProject = raw.map((i) => {
    const next: any = {
      ...i,
      buildingName: projName || String(i.buildingName || ''),
    }

    // 若 roomNo 形如 "3-305"，则尝试解析楼层=3，便于下拉框显示
    if (!next.floor && typeof next.roomNo === 'string') {
      const m = next.roomNo.match(/^(\d+)[-－](.+)$/)
      if (m) {
        next.floor = String(m[1])
        next.roomNo = String(m[2])
      }
    }

    return next
  })

  planList.value = fromProject

  // 2) 添加区默认建筑名称=项目名称；房间号与面积可手动填，也可来自上面同步
  addForm.buildingName = projName
  addForm.floor = ''
  addForm.roomNo = ''
  addForm.area = null
  addForm.mainCategory = ''
  addForm.subCategory = ''
}, { immediate: true })

function openDialog(projectId: string) {
  selectedProjectId.value = projectId
}

function closeDialog() {
  selectedProjectId.value = null
}

function addPlan() {
  if (!isEditable.value) return
  const buildingName = String((selectedProject.value as any)?.name || addForm.buildingName || '').trim()
  const roomNo = addForm.roomNo.trim()
  const area = addForm.area === null ? 0 : Number(addForm.area)

  if (!buildingName) {
    alert('项目名称为空，无法同步建筑名称')
    return
  }
  if (!roomNo) {
    alert('请输入房间号')
    return
  }
  if (!Number.isFinite(area) || area < 0) {
    alert('请输入正确的面积')
    return
  }

  const floorPrefix = (addForm.floor || '').trim()
  const finalRoomNo = floorPrefix ? `${floorPrefix}-${roomNo}` : roomNo

  planList.value.unshift({
    id: `ROOMPLAN-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    buildingName,
    roomNo: finalRoomNo,
    area,
    mainCategory: addForm.mainCategory || '',
    subCategory: addForm.subCategory || '',
    notes: addForm.notes || '',
  } as any)

  addForm.floor = ''
  addForm.roomNo = ''
  addForm.area = null
  addForm.mainCategory = ''
  addForm.subCategory = ''
  addForm.notes = ''
}

function removePlan(id: string) {
  if (!isEditable.value) return
  planList.value = planList.value.filter(x => x.id !== id)
}

async function savePlan() {
  const p = selectedProject.value
  if (!p) return
  if (!isEditable.value) return

  saving.value = true
  try {
    await fixationService.patchAudit({
      op: 'updateProject',
      projectId: p.id,
      updates: { roomFunctionPlan: planList.value },
    })
    alert('已保存')
  } catch (e) {
    console.error(e)
    alert('保存失败')
  } finally {
    saving.value = false
  }
}

async function confirmAndSync() {
  const p = selectedProject.value
  if (!p) return
  if (!isEditable.value) return

  saving.value = true
  try {
    // 1) 写回项目房间功能计划
    await fixationService.patchAudit({
      op: 'updateProject',
      projectId: p.id,
      updates: { roomFunctionPlan: planList.value },
    })

    // 2) 同步到存量房间台账（fixation-stock.json）
    // 规则：按 buildingName + roomNo 匹配，更新或新增，并写入 functionMain/functionSub
    await fixationService.syncRoomFunctions(p.id, planList.value)

    alert('确认成功：已同步到房间台账（mock）。')
    closeDialog()
  } catch (e) {
    console.error(e)
    alert('确认失败')
  } finally {
    saving.value = false
  }
}

async function confirmPartition() {
  const p = selectedProject.value
  if (!p) return
  if (!isEditable.value) return

  try {
    await fixationService.patchAudit({
      op: 'updateProject',
      projectId: p.id,
      updates: { roomFunctionPlanConfirmed: true },
    })
    alert('划分已确认')
  } catch (e) {
    console.error(e)
    alert('确认失败')
  }
}
</script>

<style scoped src="./FixRoomFunctionView.css"></style>
