<template>
  <div class="page">
    <div class="card">
      <div class="header">
        <h3 class="title">录入新基建工程</h3>
      </div>

      <form class="body" @submit.prevent="handleSubmit">
        <section class="section">
          <div class="sectionTitle">
            <FileText :size="16" />
            <span>基本信息</span>
          </div>
          <div class="grid2">
            <div class="colSpan2">
              <label class="label">工程名称 <span class="required">*</span></label>
              <input v-model="formData.name" class="input" placeholder="例如：综合体育馆建设工程" required />
            </div>
            <div>
              <label class="label">承建单位</label>
              <input v-model="formData.contractor" class="input" placeholder="例如：福建建工集团" />
            </div>
            <div>
              <label class="label">监理单位</label>
              <input v-model="formData.supervisor" class="input" placeholder="例如：福建建设监理公司" />
            </div>
            <div>
              <label class="label">合同金额 (元) <span class="required">*</span></label>
              <input v-model="formData.contractAmount" class="input" type="number" min="0" placeholder="例如: 10000000" required />
            </div>
            <div>
              <label class="label">审计金额 (元)</label>
              <input v-model="formData.auditAmount" class="input" type="number" min="0" placeholder="例如: 9500000" />
              <div class="hint">审减率：{{ auditReductionRateText }}</div>
            </div>
            <div>
              <label class="label">资金来源</label>
              <select v-model="formData.fundSource" class="input">
                <option value="Fiscal">财政拨款</option>
                <option value="SelfRaised">自筹资金</option>
                <option value="Mixed">混合来源</option>
              </select>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="sectionTitle">
            <MapPin :size="16" />
            <span>建设信息</span>
          </div>
          <div class="grid2">
            <div class="colSpan2">
              <label class="label">建设地点</label>
              <input v-model="formData.location" class="input" placeholder="例如：旗山校区东侧" />
            </div>
            <div>
              <label class="label">规划建筑面积 (m²)</label>
              <input v-model="formData.plannedArea" class="input" type="number" min="0" placeholder="例如: 8500" />
            </div>
            <div>
              <label class="label">楼层</label>
              <input v-model="formData.floorCount" class="input" type="number" min="0" placeholder="例如: 6" />
            </div>
            <div>
              <label class="label">房间数</label>
              <input v-model="formData.roomCount" class="input" type="number" min="0" placeholder="例如: 120" />
            </div>
            <div>
              <label class="label">楼栋名称</label>
              <input v-model="buildingName" class="input" placeholder="例如：理科实验楼A座" />
            </div>
            <div>
              <label class="label">项目负责人</label>
              <input v-model="formData.projectManager" class="input" placeholder="例如：张工" />
            </div>
          </div>
        </section>

        <section class="section">
          <div class="sectionTitle">
            <Calendar :size="16" />
            <span>工期信息</span>
          </div>
          <div class="grid2">
            <div>
              <label class="label">计划开工日期</label>
              <input v-model="formData.plannedStartDate" class="input" type="date" />
            </div>
            <div>
              <label class="label">计划竣工日期</label>
              <input v-model="formData.plannedEndDate" class="input" type="date" />
            </div>
            <div>
              <label class="label">实际开工日期</label>
              <input v-model="formData.actualStartDate" class="input" type="date" />
            </div>
            <div>
              <label class="label">实际竣工日期</label>
              <input v-model="formData.actualEndDate" class="input" type="date" />
            </div>
          </div>
        </section>

        <section class="section">
          <div class="sectionTitle">
            <Building :size="16" />
            <span>房间划分（可选）</span>
          </div>
          <div class="panel">
            <div class="gridRoom">
              <select v-model="roomForm.floor" class="input" :disabled="floorOptions.length === 0">
                <option value="">选择楼层</option>
                <option v-for="f in floorOptions" :key="f" :value="String(f)">{{ f }}F</option>
              </select>
              <input v-model="roomForm.roomNo" class="input" placeholder="房间号" />
              <input v-model="roomForm.area" class="input" type="number" min="0" placeholder="面积(m²)" />
              <button type="button" class="btnPrimary" @click="addRoom"> <Plus :size="14" /> 添加房间</button>
            </div>

            <div v-if="newRoomPlans.length > 0" class="listWrap">
              <div class="listTitle">已添加房间（{{ newRoomPlans.length }}）</div>
              <div class="list">
                <div v-for="r in newRoomPlans" :key="r.id" class="listItem">
                  <div class="min0">
                    <div class="itemTitle">{{ r.buildingName }} | {{ r.roomNo }}</div>
                    <div class="itemSub">面积：{{ r.area }} m²</div>
                  </div>
                  <button type="button" class="iconDanger" title="移除" @click="removeRoom(r.id)">
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div class="hint2">
              说明：楼层下拉框会根据“楼层”数量自动生成；房间将保存到“房间功能划分”中，后续可在详情页继续完善分类。
            </div>
          </div>
        </section>

        <section class="section">
          <div class="sectionTitle">
            <Layers :size="16" />
            <span>资产划分（拆分）（可选）</span>
          </div>
          <div class="panel">
            <div class="gridSplitTop">
              <select v-model="splitForm.category" class="input">
                <option value="Building">房屋建筑物</option>
                <option value="Land">土地</option>
                <option value="Structure">构筑物</option>
                <option value="Equipment">设备</option>
                <option value="Greening">绿化</option>
                <option value="Other">其他</option>
              </select>
              <input v-model="splitForm.name" class="input" placeholder="资产名称" />
              <input v-model.number="splitForm.amount" class="input" type="number" min="0" placeholder="金额(元)" />
              <input
                :value="splitForm.category === 'Equipment' ? (splitForm.quantity ?? '') : (splitForm.area ?? '')"
                class="input"
                type="number"
                min="0"
                :placeholder="splitForm.category === 'Equipment' ? '数量' : '面积(m²)'"
                @input="onSplitAreaOrQty"
              />
            </div>

            <div class="gridSplitBottom">
              <input v-model.number="splitForm.depreciationYears" class="input" type="number" min="0" placeholder="折旧年限" />
              <select v-model="splitForm.depreciationMethod" class="input">
                <option value="StraightLine">年限平均法</option>
                <option value="Accelerated">加速折旧</option>
              </select>
              <button type="button" class="btnPrimary" @click="addSplitItem"> <Plus :size="14" /> 添加拆分项</button>
            </div>

            <div v-if="newSplitItems.length > 0" class="listWrap">
              <div class="listTitle">已添加拆分项（{{ newSplitItems.length }}）</div>
              <div class="list">
                <div v-for="item in newSplitItems" :key="item.id" class="listItem">
                  <div class="min0">
                    <div class="itemTitle">{{ item.name }}</div>
                    <div class="itemSub">类别：{{ item.category }} | 金额：¥{{ formatMoney(item.amount) }}</div>
                  </div>
                  <button type="button" class="iconDanger" title="移除" @click="removeSplitItem(item.id)">
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div class="hint2">
              说明：此处录入的拆分项会保存到项目的“资产拆分”中，后续可在详情页继续补充。
            </div>
          </div>
        </section>

        <section class="section">
          <div class="sectionTitle">
            <Paperclip :size="16" />
            <span>上传附件（模拟）</span>
          </div>
          <div class="panel">
            <div class="gridAtt">
              <select v-model="uploadForm.type" class="input">
                <option value="approval">立项批复</option>
                <option value="bidding">招标文件</option>
                <option value="contract">施工合同</option>
                <option value="change">变更签证</option>
                <option value="drawing">竣工图纸</option>
                <option value="acceptance">验收报告</option>
                <option value="audit">审计报告</option>
                <option value="other">其他</option>
              </select>
              <input v-model="uploadForm.name" class="input" placeholder="请输入附件名称，例如：施工合同.pdf" />
            </div>
            <div class="actionsEnd">
              <button type="button" class="btnPrimary" @click="addAttachment"> <Plus :size="14" /> 上传（模拟）</button>
            </div>

            <div v-if="newAttachments.length > 0" class="listWrap">
              <div class="listTitle">已添加附件（{{ newAttachments.length }}）</div>
              <div class="list">
                <div v-for="att in newAttachments" :key="att.id" class="listItem">
                  <div class="min0">
                    <div class="itemTitle">{{ att.name }}</div>
                    <div class="itemSub">类型：{{ att.type }} | 状态：待审核</div>
                  </div>
                  <button type="button" class="iconDanger" title="移除" @click="removeAttachment(att.id)">
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <div class="hint2">
              说明：此处为模拟上传。创建项目后，可在“表单信息”中对附件进行审核/驳回/批量通过。
            </div>
          </div>
        </section>

        <div class="footer">
          <button type="button" class="btn" @click="resetForm">取消</button>
          <button type="submit" class="btnPrimary" :disabled="!formData.name || !formData.contractAmount">确认录入</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Building,
  Calendar,
  FileText,
  Layers,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-vue-next'

type FundSource = 'Fiscal' | 'SelfRaised' | 'Mixed'
type AssetStatus = 'DisposalPending'
type ProjectMilestone = 'Approval'

type Attachment = {
  id: string
  name: string
  type:
    | 'approval'
    | 'bidding'
    | 'contract'
    | 'change'
    | 'drawing'
    | 'acceptance'
    | 'audit'
    | 'other'
  uploadDate: string
  uploadedByDept: string
  reviewStatus: 'Pending'
}

type RoomPlanItem = {
  id: string
  buildingName: string
  roomNo: string
  area: number
  mainCategory: string
  subCategory: string
}

type AssetCategory = 'Building' | 'Land' | 'Structure' | 'Equipment' | 'Greening' | 'Other'

type AssetSplitItem = {
  id: string
  category: AssetCategory
  name: string
  amount: number
  area?: number
  quantity?: number
  depreciationYears: number
  depreciationMethod: 'StraightLine' | 'Accelerated'
}

type Project = {
  id: string
  name: string
  contractor: string
  contractAmount: number
  auditAmount?: number
  auditReductionRate?: number
  status: AssetStatus
  completionDate: string
  hasCadData: boolean
  fundSource: FundSource
  location: string
  plannedArea?: number
  floorCount?: number
  roomCount?: number
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  projectManager: string
  supervisor: string
  milestones: { milestone: ProjectMilestone; date: string; operator: string; notes: string }[]
  attachments: Attachment[]
  splitItems: AssetSplitItem[]
  roomFunctionPlan: RoomPlanItem[]
  isOverdue: boolean
  isArchived: boolean
}

const formData = reactive({
  name: '',
  contractor: '',
  contractAmount: '',
  auditAmount: '',
  fundSource: 'Fiscal' as FundSource,
  location: '',
  plannedArea: '',
  plannedStartDate: '',
  plannedEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
  projectManager: '',
  supervisor: '',
  floorCount: '',
  roomCount: '',
})

const buildingName = ref('')

const newAttachments = ref<Attachment[]>([])
const newSplitItems = ref<AssetSplitItem[]>([])
const newRoomPlans = ref<RoomPlanItem[]>([])

const roomForm = reactive({
  floor: '',
  roomNo: '',
  area: '',
})

const splitForm = reactive<{
  category: AssetCategory
  name: string
  amount?: number
  area?: number
  quantity?: number
  depreciationYears: number
  depreciationMethod: 'StraightLine' | 'Accelerated'
}>({
  category: 'Building',
  name: '',
  amount: undefined,
  area: undefined,
  quantity: undefined,
  depreciationYears: 50,
  depreciationMethod: 'StraightLine',
})

const uploadForm = reactive<{ type: Attachment['type']; name: string }>({
  type: 'other',
  name: '',
})

const floorOptions = computed(() => {
  const n = Number(formData.floorCount || 0)
  if (!Number.isFinite(n) || n <= 0) return []
  return Array.from({ length: n }, (_, i) => i + 1)
})

const auditReductionRate = computed<number | undefined>(() => {
  const contract = Number(formData.contractAmount)
  const audit = Number(formData.auditAmount)
  if (!contract || !audit) return undefined
  const rate = ((contract - audit) / contract) * 100
  if (!Number.isFinite(rate)) return undefined
  return Number(rate.toFixed(2))
})

const auditReductionRateText = computed(() => {
  return auditReductionRate.value === undefined ? '-' : `${auditReductionRate.value.toFixed(2)}%`
})

function addRoom() {
  const b = buildingName.value.trim()
  const floor = (roomForm.floor || '').trim()
  const roomNo = (roomForm.roomNo || '').trim()
  const area = Number(roomForm.area)
  if (!b) {
    alert('请先填写楼栋名称')
    return
  }
  if (!floor) {
    alert('请选择楼层')
    return
  }
  if (!roomNo) {
    alert('请输入房间号')
    return
  }
  if (!Number.isFinite(area) || area <= 0) {
    alert('请输入正确的面积')
    return
  }

  newRoomPlans.value.push({
    id: `ROOM-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    buildingName: b,
    roomNo: `${floor}-${roomNo}`,
    area,
    mainCategory: '',
    subCategory: '',
  })

  roomForm.roomNo = ''
  roomForm.area = ''
}

function removeRoom(id: string) {
  newRoomPlans.value = newRoomPlans.value.filter(x => x.id !== id)
}

function onSplitAreaOrQty(e: Event) {
  const el = e.target as HTMLInputElement
  const raw = el.value
  const val = raw === '' ? undefined : Number(raw)
  if (splitForm.category === 'Equipment') {
    splitForm.quantity = val
    splitForm.area = undefined
  } else {
    splitForm.area = val
    splitForm.quantity = undefined
  }
}

function addSplitItem() {
  if (!splitForm.name || !splitForm.amount) {
    alert('请填写资产名称与金额')
    return
  }
  newSplitItems.value.push({
    id: `SPLIT-${Date.now()}`,
    category: splitForm.category,
    name: String(splitForm.name),
    amount: Number(splitForm.amount),
    area: splitForm.area !== undefined ? Number(splitForm.area) : undefined,
    quantity: splitForm.quantity !== undefined ? Number(splitForm.quantity) : undefined,
    depreciationYears: Number(splitForm.depreciationYears || 50),
    depreciationMethod: splitForm.depreciationMethod || 'StraightLine',
  })

  splitForm.category = 'Building'
  splitForm.name = ''
  splitForm.amount = undefined
  splitForm.area = undefined
  splitForm.quantity = undefined
  splitForm.depreciationYears = 50
  splitForm.depreciationMethod = 'StraightLine'
}

function removeSplitItem(id: string) {
  newSplitItems.value = newSplitItems.value.filter(x => x.id !== id)
}

function addAttachment() {
  const name = (uploadForm.name || '').trim()
  if (!name) {
    alert('请输入附件名称')
    return
  }

  newAttachments.value.push({
    id: `ATT-${Date.now()}`,
    name,
    type: uploadForm.type,
    uploadDate: new Date().toISOString().split('T')[0],
    uploadedByDept: '二级学院',
    reviewStatus: 'Pending',
  })

  uploadForm.name = ''
}

function removeAttachment(id: string) {
  newAttachments.value = newAttachments.value.filter(x => x.id !== id)
}

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString()
}

function resetForm() {
  formData.name = ''
  formData.contractor = ''
  formData.contractAmount = ''
  formData.auditAmount = ''
  formData.fundSource = 'Fiscal'
  formData.location = ''
  formData.plannedArea = ''
  formData.plannedStartDate = ''
  formData.plannedEndDate = ''
  formData.actualStartDate = ''
  formData.actualEndDate = ''
  formData.projectManager = ''
  formData.supervisor = ''
  formData.floorCount = ''
  formData.roomCount = ''

  buildingName.value = ''

  newAttachments.value = []
  newSplitItems.value = []
  newRoomPlans.value = []

  roomForm.floor = ''
  roomForm.roomNo = ''
  roomForm.area = ''

  splitForm.category = 'Building'
  splitForm.name = ''
  splitForm.amount = undefined
  splitForm.area = undefined
  splitForm.quantity = undefined
  splitForm.depreciationYears = 50
  splitForm.depreciationMethod = 'StraightLine'

  uploadForm.type = 'other'
  uploadForm.name = ''
}

async function handleSubmit() {
  if (!formData.name || !formData.contractAmount) return

  const contractAmount = Number(formData.contractAmount)
  const auditAmount = formData.auditAmount ? Number(formData.auditAmount) : undefined

  const reduction =
    auditAmount !== undefined && contractAmount > 0
      ? Number((((contractAmount - auditAmount) / contractAmount) * 100).toFixed(2))
      : undefined

  const id = `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

  const project: Project = {
    id,
    name: formData.name,
    contractor: formData.contractor || '未指定',
    contractAmount,
    auditAmount,
    auditReductionRate: reduction,
    status: 'DisposalPending',
    completionDate: formData.plannedEndDate || new Date().toISOString().split('T')[0],
    hasCadData: false,
    fundSource: formData.fundSource,
    location: formData.location,
    plannedArea: formData.plannedArea ? Number(formData.plannedArea) : undefined,
    floorCount: formData.floorCount ? Number(formData.floorCount) : undefined,
    roomCount: formData.roomCount ? Number(formData.roomCount) : undefined,
    plannedStartDate: formData.plannedStartDate,
    plannedEndDate: formData.plannedEndDate,
    actualStartDate: formData.actualStartDate || undefined,
    actualEndDate: formData.actualEndDate || undefined,
    projectManager: formData.projectManager,
    supervisor: formData.supervisor,
    milestones: [
      {
        milestone: 'Approval',
        date: new Date().toISOString().split('T')[0],
        operator: '当前用户',
        notes: '项目立项',
      },
    ],
    attachments: newAttachments.value,
    splitItems: newSplitItems.value,
    roomFunctionPlan: newRoomPlans.value,
    isOverdue: false,
    isArchived: false,
  }

  try {
    await $fetch('/api/fixation/projects', {
      method: 'POST',
      body: project,
    })
  } catch (e: any) {
    console.error(e)
    alert('保存失败')
    return
  }

  alert('已保存')
  resetForm()
}
</script>

<style scoped>
.page {
  padding: 16px;
}

.card {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
}

.header {
  padding: 16px 16px 0;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2329;
}

.body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sectionTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #1f2329;
}

.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.colSpan2 {
  grid-column: span 2;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #646a73;
  margin-bottom: 6px;
}

.required {
  color: #e11d48;
}

.input {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  outline: none;
}

.input:focus {
  border-color: #3370ff;
}

.hint {
  font-size: 12px;
  color: #8f959e;
  margin-top: 6px;
}

.panel {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gridRoom {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.gridSplitTop {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr 1fr;
  gap: 12px;
}

.gridSplitBottom {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
}

.gridAtt {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
}

.actionsEnd {
  display: flex;
  justify-content: flex-end;
}

.btn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
}

.btnPrimary {
  border: 1px solid #3370ff;
  background: #3370ff;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnPrimary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.listWrap {
  padding-top: 6px;
}

.listTitle {
  font-size: 12px;
  color: #646a73;
  margin-bottom: 8px;
}

.list {
  display: grid;
  gap: 8px;
}

.listItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid #dee0e3;
  border-radius: 10px;
  background: #f9fafb;
}

.min0 {
  min-width: 0;
}

.itemTitle {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itemSub {
  font-size: 12px;
  color: #8f959e;
  margin-top: 4px;
}

.iconDanger {
  border: none;
  background: transparent;
  color: #dc2626;
  padding: 4px;
}

.hint2 {
  font-size: 12px;
  color: #8f959e;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

@media (max-width: 900px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
  .colSpan2 {
    grid-column: span 1;
  }
  .gridRoom {
    grid-template-columns: 1fr;
  }
  .gridSplitTop {
    grid-template-columns: 1fr;
  }
  .gridSplitBottom {
    grid-template-columns: 1fr;
  }
  .gridAtt {
    grid-template-columns: 1fr;
  }
}
</style>
