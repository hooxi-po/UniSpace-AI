<template>
  <div class="page">
    <div class="header">
      <h2 class="title">转固申请</h2>
      <p class="subtitle">
        展示所有状态项目。仅“待处置”可在本页面维护拆分/附件并发起转固申请；“待审核 / 待归档 / 已归档”仅可查看进度。
      </p>
    </div>

    <div class="searchCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索项目名称/编号/承建单位..." />
      </div>
      <div class="searchHint">共 {{ filtered.length }} 项（待处置可操作，其余仅查看进度）</div>
    </div>

    <div class="tableCard">
      <table class="table">
        <thead>
          <tr>
            <th>项目编号</th>
            <th>项目名称</th>
            <th>承建单位</th>
            <th>当前状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.id" class="row">
            <td class="mono">{{ p.id }}</td>
            <td class="name">{{ p.name }}</td>
            <td class="muted">{{ p.contractor }}</td>
            <td>
              <span :class="getAssetStatusBadgeClass(p.status)">{{ getAssetStatusLabel(p.status) }}</span>
            </td>
            <td>
              <div class="ops">
                <button class="link" @click="openDetail(p)">
                  <Eye :size="14" /> 查看详情
                </button>

                <button
                  class="btnPrimary"
                  :disabled="p.status !== 'DisposalPending'"
                  :title="p.status !== 'DisposalPending' ? '仅待处置项目可发起（其余状态仅查看进度）' : undefined"
                  @click="startApply(p)"
                >
                  发起转固申请 <ArrowRight :size="14" />
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="filtered.length === 0">
            <td class="empty" colspan="5">暂无符合条件的项目（待处置）。</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="selectedProject"
      class="modalMask"
      @click="closeDetail"
    >
      <div class="modal" @click.stop>
        <div class="modalHeader">
          <div>
            <h3 class="modalTitle">{{ selectedProject.name }}</h3>
            <div class="modalSub">项目编号：{{ selectedProject.id }}</div>
          </div>
          <button class="closeBtn" @click="closeDetail">关闭</button>
        </div>

        <div class="modalTabs">
          <button :class="['tab', { active: detailTab === 'flow' }]" @click="detailTab = 'flow'">
            <Eye :size="14" /> 详情
          </button>
          <button :class="['tab', { active: detailTab === 'split' }]" @click="detailTab = 'split'">
            <Layers :size="14" /> 资产拆分
          </button>
          <button :class="['tab', { active: detailTab === 'attachments' }]" @click="detailTab = 'attachments'">
            <Paperclip :size="14" /> 附件
          </button>
        </div>

        <div class="modalBody">
          <div v-if="detailTab === 'flow'" class="flow">
            <div class="flowGrid">
              <div v-for="st in flowSteps" :key="st" class="flowItem">
                <div class="flowLabel">{{ getAssetStatusLabel(st) }}</div>
                <div class="flowValue" :class="{ current: st === selectedProject.status }">
                  {{ st === selectedProject.status ? '当前' : '—' }}
                </div>
              </div>
            </div>
            <div class="flowHint">
              本页面用于“转固申请”环节的项目查看与发起；审核动作后续可在“转固审核”模块实现。
            </div>
          </div>

          <div v-else-if="detailTab === 'split'" class="split">
            <div class="sectionTitle">
              <Layers :size="16" /> 已拆分资产项
            </div>

            <div v-if="(selectedProject.splitItems || []).length > 0" class="splitTableWrap">
              <table class="splitTable">
                <thead>
                  <tr>
                    <th>资产类别</th>
                    <th>名称</th>
                    <th class="right">金额</th>
                    <th class="right">面积/数量</th>
                    <th class="center">折旧年限</th>
                    <th>卡片号</th>
                    <th class="center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in (selectedProject.splitItems || [])" :key="item.id">
                    <td>{{ getAssetCategoryLabel(item.category) }}</td>
                    <td class="name">{{ item.name }}</td>
                    <td class="right">¥{{ formatMoney(item.amount) }}</td>
                    <td class="right">
                      {{ item.area ? `${item.area} m²` : item.quantity ? `${item.quantity} 台/套` : '-' }}
                    </td>
                    <td class="center">{{ item.depreciationYears }} 年</td>
                    <td class="linkish">{{ item.assetCardNo || '待生成' }}</td>
                    <td class="center">
                      <button
                        class="iconDanger"
                        :disabled="!isEditable(selectedProject)"
                        title="删除"
                        @click="removeSplitItem(item.id)"
                      >
                        <Trash2 :size="16" />
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2">合计</td>
                    <td class="right">¥{{ formatMoney(splitSum) }}</td>
                    <td colspan="4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div v-else class="emptyBox">暂未拆分</div>

            <div class="sectionTitle">新增拆分项</div>
            <div class="panel">
              <div class="gridTop">
                <select v-model="splitForm.category" class="input" :disabled="!isEditable(selectedProject)">
                  <option value="Building">房屋建筑物</option>
                  <option value="Land">土地</option>
                  <option value="Structure">构筑物</option>
                  <option value="Equipment">设备</option>
                  <option value="Greening">绿化</option>
                  <option value="Other">其他</option>
                </select>
                <input v-model="splitForm.name" class="input" :disabled="!isEditable(selectedProject)" placeholder="资产名称" />
                <input v-model.number="splitForm.amount" class="input" :disabled="!isEditable(selectedProject)" type="number" min="0" placeholder="金额(元)" />
                <input
                  class="input"
                  :disabled="!isEditable(selectedProject)"
                  type="number"
                  min="0"
                  :placeholder="splitForm.category === 'Equipment' ? '数量' : '面积(m²)'"
                  :value="splitForm.category === 'Equipment' ? (splitForm.quantity ?? '') : (splitForm.area ?? '')"
                  @input="onSplitAreaOrQty"
                />
              </div>
              <div class="gridBottom">
                <input
                  v-model.number="splitForm.depreciationYears"
                  class="input"
                  :disabled="!isEditable(selectedProject)"
                  type="number"
                  min="0"
                  placeholder="折旧年限"
                />
                <select v-model="splitForm.depreciationMethod" class="input" :disabled="!isEditable(selectedProject)">
                  <option value="StraightLine">年限平均法</option>
                  <option value="Accelerated">加速折旧</option>
                </select>
                <button class="btnPrimary" type="button" :disabled="!isEditable(selectedProject)" @click="addSplit">
                  <Plus :size="14" /> 添加拆分项
                </button>
              </div>
            </div>
          </div>

          <div v-else class="attachments">
            <div class="sectionTitle">
              <Paperclip :size="16" /> 上传附件（模拟）
            </div>
            <div class="panel">
              <div class="gridAtt">
                <select v-model="uploadForm.type" class="input" :disabled="!isEditable(selectedProject)">
                  <option value="approval">立项批复</option>
                  <option value="bidding">招标文件</option>
                  <option value="contract">施工合同</option>
                  <option value="change">变更签证</option>
                  <option value="drawing">竣工图纸</option>
                  <option value="acceptance">验收报告</option>
                  <option value="audit">审计报告</option>
                  <option value="other">其他</option>
                </select>
                <input v-model="uploadForm.name" class="input" :disabled="!isEditable(selectedProject)" placeholder="请输入附件名称，例如：施工合同.pdf" />
              </div>
              <div class="actionsEnd">
                <button class="btnPrimary" type="button" :disabled="!isEditable(selectedProject)" @click="addAtt">
                  <Plus :size="14" /> 上传（模拟）
                </button>
              </div>
            </div>

            <div class="sectionTitle">附件列表</div>
            <div class="attList">
              <div v-for="att in (selectedProject.attachments || [])" :key="att.id" class="attItem">
                <div class="attLeft">
                  <div class="attName">
                    {{ att.name }}
                    <span :class="['attBadge', att.reviewStatus === 'Approved' ? 'ok' : att.reviewStatus === 'Rejected' ? 'bad' : 'wait']">
                      {{ att.reviewStatus === 'Approved' ? '已通过' : att.reviewStatus === 'Rejected' ? '已驳回' : '待审核' }}
                    </span>
                  </div>
                  <div class="attSub">{{ getAttachmentTypeLabel(att.type) }} | {{ att.uploadDate }} | 上传部门：{{ att.uploadedByDept || '-' }}</div>
                  <div v-if="att.reviewedAt || att.reviewNote" class="attReview">
                    审核：{{ att.reviewedBy || '-' }}{{ att.reviewedAt ? ` | ${new Date(att.reviewedAt).toLocaleString('zh-CN')}` : '' }}{{ att.reviewNote ? ` | ${att.reviewNote}` : '' }}
                  </div>
                </div>

                <div class="attOps">
                  <button class="icon" type="button" title="下载（模拟）" @click="downloadAtt(att)">
                    <Download :size="16" />
                  </button>

                  <button
                    v-if="att.reviewStatus === 'Rejected'"
                    class="btn"
                    type="button"
                    :disabled="!isEditable(selectedProject)"
                    @click="resetAtt(att.id)"
                  >
                    <RefreshCw :size="14" /> 重新上传
                  </button>

                  <button
                    v-if="att.reviewStatus === 'Rejected'"
                    class="btn"
                    type="button"
                    :disabled="!isEditable(selectedProject)"
                    @click="editAtt(att)"
                  >
                    <Edit :size="14" /> 编辑
                  </button>

                  <button
                    v-if="att.reviewStatus === 'Rejected'"
                    class="btnDanger"
                    type="button"
                    :disabled="!isEditable(selectedProject)"
                    @click="removeAtt(att.id)"
                  >
                    <Trash2 :size="14" /> 删除
                  </button>
                </div>
              </div>

              <div v-if="(selectedProject.attachments || []).length === 0" class="emptyBox">暂无附件</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ArrowRight,
  Download,
  Edit,
  Eye,
  Layers,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-vue-next'
import type { AssetCategory, AssetSplitItem, Attachment, Project } from '~/server/utils/fixation-audit-db'
import { useFixationAudit } from '~/composables/useFixationAudit'

const {
  projects,
  updateStatus,
  addAttachment,
  updateAttachment,
  deleteAttachment,
  addSplitItem,
  deleteSplitItem,
  getAssetCategoryLabel,
  getAssetStatusLabel,
  getAssetStatusBadgeClass,
} = useFixationAudit()

const flowSteps = ['DisposalPending', 'PendingReview', 'PendingArchive', 'Archived'] as const

const searchTerm = ref('')
const selectedProject = ref<Project | null>(null)
const detailTab = ref<'flow' | 'split' | 'attachments'>('flow')

function isEditable(p: Project | null) {
  return !!p && p.status === 'DisposalPending'
}

const filtered = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  const list = (projects.value || []) as Project[]
  return list.filter(p => {
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.contractor.toLowerCase().includes(q)
    )
  })
})

function openDetail(p: Project) {
  selectedProject.value = p
  detailTab.value = 'flow'
}

function closeDetail() {
  selectedProject.value = null
}

async function startApply(p: Project) {
  if (p.status !== 'DisposalPending') return
  await updateStatus(p.id, 'PendingReview')
  if (selectedProject.value?.id === p.id) selectedProject.value = { ...selectedProject.value, status: 'PendingReview' }
}

const splitForm = reactive<Partial<AssetSplitItem>>({
  category: 'Building',
  depreciationMethod: 'StraightLine',
  depreciationYears: 50,
})

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

const splitSum = computed(() => {
  const p = selectedProject.value
  return (p?.splitItems || []).reduce((acc, i) => acc + (i.amount || 0), 0)
})

async function addSplit() {
  const p = selectedProject.value
  if (!isEditable(p) || !p) return

  if (!splitForm.name || !splitForm.amount) {
    alert('请填写资产名称与金额')
    return
  }

  const item: AssetSplitItem = {
    id: `SPLIT-${Date.now()}`,
    category: (splitForm.category || 'Building') as AssetCategory,
    name: String(splitForm.name),
    amount: Number(splitForm.amount),
    area: splitForm.area !== undefined ? Number(splitForm.area) : undefined,
    quantity: splitForm.quantity !== undefined ? Number(splitForm.quantity) : undefined,
    depreciationYears: Number(splitForm.depreciationYears || 50),
    depreciationMethod: (splitForm.depreciationMethod || 'StraightLine') as any,
  }

  const next = await addSplitItem(p.id, item)
  selectedProject.value = next

  splitForm.category = 'Building'
  splitForm.name = undefined
  splitForm.amount = undefined
  splitForm.area = undefined
  splitForm.quantity = undefined
  splitForm.depreciationYears = 50
  splitForm.depreciationMethod = 'StraightLine'
}

async function removeSplitItem(itemId: string) {
  const p = selectedProject.value
  if (!isEditable(p) || !p) return
  const next = await deleteSplitItem(p.id, itemId)
  selectedProject.value = next
}

const uploadForm = reactive<{ type: Attachment['type']; name: string }>({
  type: 'other',
  name: '',
})

async function addAtt() {
  const p = selectedProject.value
  if (!isEditable(p) || !p) return
  const name = (uploadForm.name || '').trim()
  if (!name) {
    alert('请输入附件名称')
    return
  }

  const att: Attachment = {
    id: `ATT-${Date.now()}`,
    name,
    type: uploadForm.type,
    uploadDate: new Date().toISOString().split('T')[0],
    uploadedByDept: '二级学院',
    reviewStatus: 'Pending',
  }

  const next = await addAttachment(p.id, att)
  selectedProject.value = next
  uploadForm.name = ''
}

function getAttachmentTypeLabel(t: Attachment['type']) {
  switch (t) {
    case 'approval':
      return '立项批复'
    case 'bidding':
      return '招标文件'
    case 'contract':
      return '施工合同'
    case 'change':
      return '变更签证'
    case 'drawing':
      return '竣工图纸'
    case 'acceptance':
      return '验收报告'
    case 'audit':
      return '审计报告'
    default:
      return '其他'
  }
}

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString('zh-CN')
}

function downloadAtt(att: Attachment) {
  const safeName = (att.name || 'attachment').replace(/[\\/:*?"<>|]/g, '_')
  const filename = safeName.endsWith('.txt') ? safeName : `${safeName}.txt`
  const content = [
    '【附件下载（模拟）】',
    `项目：${selectedProject.value?.name || '-'} (${selectedProject.value?.id || '-'})`,
    `附件：${att.name}`,
    `类型：${att.type}`,
    `上传部门：${att.uploadedByDept || '-'}`,
    `审核状态：${att.reviewStatus || 'Pending'}`,
    `下载时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function resetAtt(attId: string) {
  const p = selectedProject.value
  if (!isEditable(p) || !p) return
  const next = await updateAttachment(p.id, attId, {
    reviewStatus: 'Pending',
    reviewedBy: undefined,
    reviewedAt: undefined,
  })
  selectedProject.value = next
}

async function editAtt(att: Attachment) {
  const p = selectedProject.value
  if (!isEditable(p) || !p) return

  const nextName = prompt('请输入新的附件名称', att.name)
  if (nextName === null) return
  const name = nextName.trim()
  if (!name) {
    alert('附件名称不能为空')
    return
  }

  const nextType = prompt('请输入新的附件类型（例如：contract / acceptance / audit / other）', String(att.type))
  if (nextType === null) return
  const next = (nextType.trim() || String(att.type)) as any
  const type = (
    ['approval', 'bidding', 'contract', 'change', 'drawing', 'acceptance', 'audit', 'other'].includes(next)
      ? next
      : att.type
  ) as Attachment['type']

  const updated = await updateAttachment(p.id, att.id, {
    name,
    type,
    reviewStatus: 'Pending',
    reviewedBy: undefined,
    reviewedAt: undefined,
  })
  selectedProject.value = updated
}

async function removeAtt(attId: string) {
  const p = selectedProject.value
  if (!isEditable(p) || !p) return
  if (!confirm('确定要删除该附件吗？')) return
  const next = await deleteAttachment(p.id, attId)
  selectedProject.value = next
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  color: #646a73;
  font-size: 14px;
}

.searchCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.searchBox {
  position: relative;
  flex: 1;
}

.searchIcon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #8f959e;
}

.searchInput {
  width: 100%;
  padding: 10px 10px 10px 34px;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  font-size: 14px;
}

.searchHint {
  color: #646a73;
  font-size: 14px;
}

.tableCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table thead {
  background: #f8fafc;
  color: #646a73;
}

.table th {
  text-align: left;
  padding: 12px 14px;
  font-weight: 600;
}

.table td {
  padding: 12px 14px;
  border-top: 1px solid #eef0f2;
}

.row:hover {
  background: #f8fafc;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: #646a73;
}

.name {
  font-weight: 600;
  color: #1f2329;
}

.muted {
  color: #646a73;
}

.ops {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.link {
  background: transparent;
  border: none;
  padding: 0;
  color: #3370ff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: 1px solid #3370ff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnPrimary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badgePending {
  background: #f1f5f9;
  color: #334155;
}

.badgeReview {
  background: #fff7ed;
  color: #c2410c;
}

.badgeArchive {
  background: #eff6ff;
  color: #1d4ed8;
}

.badgeDone {
  background: #ecfdf5;
  color: #047857;
}

.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  width: 100%;
  max-width: 980px;
  max-height: 90vh;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modalHeader {
  padding: 12px 14px;
  border-bottom: 1px solid #eef0f2;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.modalTitle {
  font-weight: 700;
  color: #1f2329;
}

.modalSub {
  font-size: 12px;
  color: #646a73;
  margin-top: 2px;
}

.closeBtn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
}

.modalTabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid #eef0f2;
}

.tab {
  border: none;
  background: transparent;
  color: #646a73;
  padding: 8px 10px;
  border-bottom: 2px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab.active {
  color: #3370ff;
  border-bottom-color: #3370ff;
  font-weight: 600;
}

.modalBody {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.flowGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.flowItem {
  border: 1px solid #eef0f2;
  border-radius: 12px;
  padding: 10px;
}

.flowLabel {
  font-size: 12px;
  color: #646a73;
}

.flowValue {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2329;
}

.flowValue.current {
  color: #3370ff;
}

.flowHint {
  margin-top: 12px;
  color: #646a73;
  font-size: 14px;
}

.sectionTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2329;
  font-weight: 600;
}

.splitTableWrap {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.splitTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.splitTable thead {
  background: #f5f6f7;
  color: #646a73;
}

.splitTable th,
.splitTable td {
  padding: 10px 12px;
  border-top: 1px solid #eef0f2;
}

.splitTable th {
  text-align: left;
}

.right {
  text-align: right;
}

.center {
  text-align: center;
}

.linkish {
  color: #3370ff;
}

.iconDanger {
  border: none;
  background: transparent;
  color: #dc2626;
  padding: 4px;
}

.iconDanger:disabled {
  opacity: 0.4;
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

.gridTop {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr 1fr;
  gap: 10px;
}

.gridBottom {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
}

.gridAtt {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 10px;
}

.actionsEnd {
  display: flex;
  justify-content: flex-end;
}

.input {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
}

.attList {
  display: grid;
  gap: 10px;
}

.attItem {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.attLeft {
  min-width: 0;
}

.attName {
  font-weight: 600;
  color: #1f2329;
  display: flex;
  align-items: center;
  gap: 8px;
}

.attBadge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.attBadge.wait {
  background: #fff7ed;
  color: #c2410c;
}

.attBadge.ok {
  background: #ecfdf5;
  color: #047857;
}

.attBadge.bad {
  background: #fef2f2;
  color: #dc2626;
}

.attSub {
  margin-top: 6px;
  font-size: 12px;
  color: #8f959e;
}

.attReview {
  margin-top: 6px;
  font-size: 12px;
  color: #646a73;
}

.attOps {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.icon {
  border: none;
  background: transparent;
  color: #646a73;
  padding: 6px;
}

.btn {
  border: 1px solid #dee0e3;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnDanger {
  border: 1px solid #ef4444;
  background: #fff;
  color: #ef4444;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.emptyBox {
  padding: 16px;
  text-align: center;
  color: #8f959e;
  background: #f9fafb;
  border-radius: 12px;
}

@media (max-width: 900px) {
  .searchCard {
    flex-direction: column;
    align-items: stretch;
  }
  .flowGrid {
    grid-template-columns: 1fr;
  }
  .gridTop,
  .gridBottom,
  .gridAtt {
    grid-template-columns: 1fr;
  }
  .attItem {
    flex-direction: column;
  }
}
</style>