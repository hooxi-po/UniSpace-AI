<template>
  <div class="page">
    <div class="header">
      <h2 class="title">
        <FileSpreadsheet :size="22" />
        存量房产导入（Excel）
      </h2>
      <p class="subtitle">支持导入楼宇与房间台账。导入策略：仅新增，重复跳过。</p>
    </div>

    <div class="card">
      <div class="tabs">
        <button
          :class="['tab', { active: tab === 'buildings' }]"
          @click="switchTab('buildings')"
        >
          楼宇导入
        </button>
        <button
          :class="['tab', { active: tab === 'rooms' }]"
          @click="switchTab('rooms')"
        >
          房间导入
        </button>
      </div>

      <div class="uploadSection">
        <div class="uploadRow">
          <label class="uploadLabel">
            <Upload :size="16" />
            选择 Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              class="hidden"
              @change="handleFileChange"
            />
          </label>

          <div v-if="fileName" class="fileName">{{ fileName }}</div>

          <button class="btnReset" @click="resetAll">
            <Trash2 :size="16" /> 重置
          </button>
        </div>

        <div class="templateHint">
          <div class="hintTitle">
            <Info :size="16" />
            {{ templateHint[tab].title }}
          </div>
          <div class="hintCols">
            <div v-for="c in templateHint[tab].cols" :key="c" class="hintCol">{{ c }}</div>
          </div>
          <div class="hintSub">提示：你可以使用英文表头（如 BuildingCode/RoomNo），也可用中文表头（如 楼宇编码/房间号）。</div>
        </div>

        <div class="actions">
          <div class="storageKey">当前落库：楼宇 {{ STORAGE_KEYS.BUILDINGS }} / 房间 {{ STORAGE_KEYS.ROOMS }}</div>
          <button
            class="btnImport"
            :disabled="!canImport"
            @click="doImport"
          >
            <CheckCircle2 :size="16" /> 确认导入
          </button>
        </div>
      </div>
    </div>

    <div v-if="errors.length > 0" class="errorBox">
      <div class="errorTitle">
        <AlertCircle :size="18" />
        校验错误（{{ errors.length }}）
      </div>
      <div class="errorList">
        <div v-for="(e, idx) in errors.slice(0, 100)" :key="`${e.rowIndex}-${idx}`" class="errorItem">
          第 {{ e.rowIndex }} 行：{{ e.message }}
        </div>
        <div v-if="errors.length > 100" class="errorMore">仅展示前 100 条错误</div>
      </div>
    </div>

    <div class="previewCard">
      <div class="previewHeader">
        <div class="previewTitle">数据预览</div>
        <div class="previewCount">共 {{ previewRows.length }} 行（展示前 50 行）</div>
      </div>
      <div class="previewBody">
        <div v-if="previewRows.length === 0" class="previewEmpty">请先选择 Excel 文件并解析。</div>
        <table v-else class="previewTable">
          <thead>
            <tr>
              <th v-for="k in Object.keys(previewRows[0] as any)" :key="k">{{ k }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in (previewRows as any[]).slice(0, 50)" :key="idx">
              <td v-for="k in Object.keys(previewRows[0] as any)" :key="k">{{ String((r as any)[k] ?? '') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="note">说明：本模块仅做 Excel 导入与本地落库（JSON）。重复数据将跳过，不覆盖。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Trash2, Info } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

type ImportTab = 'buildings' | 'rooms'
type ImportMode = 'new_only'

type BuildingRow = {
  code: string
  name: string

  contractor?: string
  contractAmount?: number
  auditAmount?: number
  value?: number
  fundSource?: 'Fiscal' | 'SelfRaised' | 'Mixed'

  location?: string
  completionDate?: string
  floorCount?: number

  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string

  projectManager?: string
  supervisor?: string
}

type RoomRow = {
  buildingCode?: string
  buildingName: string
  roomNo: string
  floor?: number
  area?: number
  type?: string
  status?: string
  department?: string
}

type RowError = {
  rowIndex: number // 1-based data row (excluding header)
  message: string
}

const STORAGE_KEYS = {
  BUILDINGS: 'fixation-stock-buildings',
  ROOMS: 'fixation-stock-rooms',
}

function normalizeHeader(h: any) {
  return String(h ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function parseNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseDateYMD(v: any): string | undefined {
  if (!v) return undefined
  if (v instanceof Date) {
    const d = v
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const y = m[1]
    const mm = String(Number(m[2])).padStart(2, '0')
    const dd = String(Number(m[3])).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }
  return undefined
}

const tab = ref<ImportTab>('buildings')
const importMode = ref<ImportMode>('new_only')

const fileName = ref('')
const sheetNames = ref<string[]>([])
const selectedSheet = ref('')
const rawRows = ref<any[]>([])

const buildingRows = ref<BuildingRow[]>([])
const roomRows = ref<RoomRow[]>([])
const errors = ref<RowError[]>([])

function resetAll() {
  fileName.value = ''
  sheetNames.value = []
  selectedSheet.value = ''
  rawRows.value = []
  buildingRows.value = []
  roomRows.value = []
  errors.value = []
}

function switchTab(newTab: ImportTab) {
  tab.value = newTab
  buildingRows.value = []
  roomRows.value = []
  errors.value = []
}

const templateHint = computed(() => ({
  buildings: {
    title: '楼宇导入模板（推荐表头）',
    cols: [
      '楼宇编码(必填) / BuildingCode',
      '楼宇名称(必填) / BuildingName',
      '建设地点 / Location',
      '合同金额(元) / ContractAmount (或 Value)',
      '竣工日期(YYYY-MM-DD) / CompletionDate',
      '楼层数 / FloorCount',
    ],
  },
  rooms: {
    title: '房间导入模板（推荐表头）',
    cols: [
      '楼宇编码(可选) / BuildingCode',
      '楼宇名称(必填) / BuildingName',
      '房间号(必填) / RoomNo',
      '楼层 / Floor',
      '面积(㎡) / Area',
      '房间类型(Admin/Teaching/Lab/Student/Commercial/Logistics) / Type',
      '状态(Empty/Occupied) / Status',
      '使用部门 / Department',
    ],
  },
}))

function parseCurrentSheet(rows: any[]) {
  const nextErrors: RowError[] = []

  if (!rows || rows.length === 0) {
    buildingRows.value = []
    roomRows.value = []
    errors.value = [{ rowIndex: 0, message: 'Sheet 为空或无法解析。' }]
    return
  }

  const normalized = rows.map(r => {
    const out: Record<string, any> = {}
    Object.entries(r || {}).forEach(([k, v]) => {
      out[normalizeHeader(k)] = v
    })
    return out
  })

  const bAlias: Record<string, keyof BuildingRow> = {
    buildingcode: 'code',
    code: 'code',
    楼宇编码: 'code' as any,
    楼栋编码: 'code' as any,
    编码: 'code' as any,
    buildingname: 'name',
    name: 'name',
    楼宇名称: 'name' as any,
    楼栋名称: 'name' as any,
    建筑名称: 'name' as any,

    contractor: 'contractor',
    承建单位: 'contractor' as any,
    承建商: 'contractor' as any,

    contractamount: 'contractAmount',
    合同金额: 'contractAmount' as any,
    价值: 'contractAmount' as any,
    金额: 'contractAmount' as any,
    value: 'contractAmount' as any,

    auditamount: 'auditAmount',
    审计金额: 'auditAmount' as any,

    fundsource: 'fundSource',
    资金来源: 'fundSource' as any,

    location: 'location',
    建设地点: 'location' as any,
    地点: 'location' as any,
    地址: 'location' as any,
    completiondate: 'completionDate',
    竣工日期: 'completionDate' as any,
    完工日期: 'completionDate' as any,
    floorcount: 'floorCount',
    楼层数: 'floorCount' as any,
    层数: 'floorCount' as any,

    plannedstartdate: 'plannedStartDate',
    计划开工日期: 'plannedStartDate' as any,
    plannedenddate: 'plannedEndDate',
    计划竣工日期: 'plannedEndDate' as any,
    actualstartdate: 'actualStartDate',
    实际开工日期: 'actualStartDate' as any,
    actualenddate: 'actualEndDate',
    实际竣工日期: 'actualEndDate' as any,

    projectmanager: 'projectManager',
    项目负责人: 'projectManager' as any,
    supervisor: 'supervisor',
    监理单位: 'supervisor' as any,
  }

  const rAlias: Record<string, keyof RoomRow> = {
    buildingcode: 'buildingCode',
    楼宇编码: 'buildingCode' as any,
    楼栋编码: 'buildingCode' as any,
    buildingname: 'buildingName',
    楼宇名称: 'buildingName' as any,
    楼栋名称: 'buildingName' as any,
    roomno: 'roomNo',
    房间号: 'roomNo' as any,
    房号: 'roomNo' as any,
    floor: 'floor',
    楼层: 'floor' as any,
    area: 'area',
    面积: 'area' as any,
    '面积㎡': 'area' as any,
    type: 'type',
    房间类型: 'type' as any,
    用途: 'type' as any,
    status: 'status',
    状态: 'status' as any,
    department: 'department',
    使用部门: 'department' as any,
    部门: 'department' as any,
  }

  if (tab.value === 'buildings') {
    const out: BuildingRow[] = normalized.map((r, idx) => {
      const mapped: any = {}
      Object.entries(r).forEach(([k, v]) => {
        const key = bAlias[k] || (bAlias[normalizeHeader(k)] as any)
        if (key) mapped[key] = v
      })
      const code = String(mapped.code || '').trim()
      const name = String(mapped.name || '').trim()

      if (!code) nextErrors.push({ rowIndex: idx + 1, message: '楼宇编码为空' })
      if (!name) nextErrors.push({ rowIndex: idx + 1, message: '楼宇名称为空' })

      const completionDate = parseDateYMD(mapped.completionDate)
      if (mapped.completionDate && !completionDate) {
        nextErrors.push({ rowIndex: idx + 1, message: '竣工日期格式不合法（建议 YYYY-MM-DD）' })
      }

      return {
        code,
        name,
        contractor: mapped.contractor ? String(mapped.contractor).trim() : undefined,
        contractAmount: parseNumber(mapped.contractAmount),
        auditAmount: parseNumber(mapped.auditAmount),
        fundSource: (mapped.fundSource as any) || 'Fiscal',
        location: mapped.location ? String(mapped.location).trim() : undefined,
        completionDate,
        floorCount: parseNumber(mapped.floorCount),
        plannedStartDate: mapped.plannedStartDate || '',
        plannedEndDate: mapped.plannedEndDate || '',
        actualStartDate: mapped.actualStartDate || undefined,
        actualEndDate: mapped.actualEndDate || undefined,
        projectManager: mapped.projectManager ? String(mapped.projectManager).trim() : '',
        supervisor: mapped.supervisor ? String(mapped.supervisor).trim() : '',
      }
    })

    const seen = new Set<string>()
    out.forEach((r, idx) => {
      if (!r.code) return
      if (seen.has(r.code)) {
        nextErrors.push({ rowIndex: idx + 1, message: `Excel 内楼宇编码重复：${r.code}` })
      }
      seen.add(r.code)
    })

    buildingRows.value = out
    roomRows.value = []
    errors.value = nextErrors
    return
  }

  const out: RoomRow[] = normalized.map((r, idx) => {
    const mapped: any = {}
    Object.entries(r).forEach(([k, v]) => {
      const key = rAlias[k] || (rAlias[normalizeHeader(k)] as any)
      if (key) mapped[key] = v
    })

    const buildingName = String(mapped.buildingName || '').trim()
    const buildingCode = mapped.buildingCode ? String(mapped.buildingCode).trim() : undefined
    const roomNo = String(mapped.roomNo || '').trim()

    if (!buildingName) nextErrors.push({ rowIndex: idx + 1, message: '楼宇名称为空' })
    if (!roomNo) nextErrors.push({ rowIndex: idx + 1, message: '房间号为空' })

    const floor = parseNumber(mapped.floor)
    const area = parseNumber(mapped.area)

    return {
      buildingCode,
      buildingName,
      roomNo,
      floor: floor !== undefined ? Number(floor) : undefined,
      area: area !== undefined ? Number(area) : undefined,
      type: mapped.type ? String(mapped.type).trim() : undefined,
      status: mapped.status ? String(mapped.status).trim() : undefined,
      department: mapped.department ? String(mapped.department).trim() : undefined,
    }
  })

  const key = (r: RoomRow) => `${r.buildingCode || r.buildingName}::${r.roomNo}`
  const seen = new Set<string>()
  out.forEach((r, idx) => {
    if (!r.roomNo) return
    const k = key(r)
    if (seen.has(k)) nextErrors.push({ rowIndex: idx + 1, message: `Excel 内房间重复：${k}` })
    seen.add(k)
  })

  roomRows.value = out
  buildingRows.value = []
  errors.value = nextErrors
}

async function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  resetAll()
  fileName.value = file.name

  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })
  const names = workbook.SheetNames || []
  sheetNames.value = names

  const initialSheet = names[0] || ''
  selectedSheet.value = initialSheet

  if (!initialSheet) {
    errors.value = [{ rowIndex: 0, message: '未找到可用 Sheet。' }]
    return
  }

  const sheet = workbook.Sheets[initialSheet]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  rawRows.value = rows as any[]
  parseCurrentSheet(rows as any[])
}

const canImport = computed(() => {
  return errors.value.length === 0 && ((tab.value === 'buildings' && buildingRows.value.length > 0) || (tab.value === 'rooms' && roomRows.value.length > 0))
})

const previewRows = computed(() => (tab.value === 'buildings' ? buildingRows.value : roomRows.value))

async function doImport() {
  if (!canImport.value) return

  try {
    if (tab.value === 'buildings') {
      const toAdd = buildingRows.value
        .filter(r => r.code && r.name)
        .map(r => ({
          id: `BLD-${r.code}`,
          code: r.code,
          name: r.name,
          location: r.location || '-',
          value: r.value ?? 0,
          completionDate: r.completionDate || new Date().toISOString().split('T')[0],
          hasCadData: false,
          floorCount: r.floorCount,
          contractor: r.contractor || '未指定',
          contractAmount: Number(r.contractAmount ?? 0),
          auditAmount: r.auditAmount !== undefined ? Number(r.auditAmount) : undefined,
          auditReductionRate:
            r.auditAmount !== undefined && Number(r.contractAmount ?? 0) > 0
              ? Number((((Number(r.contractAmount ?? 0) - Number(r.auditAmount)) / Number(r.contractAmount ?? 0)) * 100).toFixed(2))
              : undefined,
          status: 'DisposalPending',
          fundSource: (r.fundSource || 'Fiscal') as any,
          plannedArea: undefined,
          roomCount: undefined,
          plannedStartDate: r.plannedStartDate || '',
          plannedEndDate: r.plannedEndDate || '',
          actualStartDate: r.actualStartDate || undefined,
          actualEndDate: r.actualEndDate || undefined,
          projectManager: r.projectManager || '',
          supervisor: r.supervisor || '',
          milestones: [
            {
              milestone: 'Approval',
              date: new Date().toISOString().split('T')[0],
              operator: '当前用户',
              notes: '存量楼宇导入',
            },
          ],
          attachments: [],
          splitItems: [],
          roomFunctionPlan: [],
          isOverdue: false,
          isArchived: false,
        }))
      const res = await $fetch<{ addedBuildings: any[] }>('/api/fixation/stock', {
        method: 'POST',
        body: { buildings: toAdd },
      })
      alert(`导入完成：新增楼宇 ${res.addedBuildings.length} 条（已存在跳过）。`)
    }

    if (tab.value === 'rooms') {
      const toAdd = roomRows.value
        .filter(r => r.buildingName && r.roomNo)
        .map(r => ({
          id: `RM-IMPORT-${r.buildingName}-${r.roomNo}`,
          buildingName: r.buildingName,
          buildingCode: r.buildingCode,
          roomNo: r.roomNo,
          floor: r.floor || (Number(String(r.roomNo).slice(0, 1)) || 1),
          area: r.area || 0,
          type: (r.type as any) || 'Admin',
          status: (r.status as any) || 'Empty',
          department: r.department || '',
        }))
      const res = await $fetch<{ addedRooms: any[] }>('/api/fixation/stock', {
        method: 'POST',
        body: { rooms: toAdd },
      })
      alert(`导入完成：新增房间 ${res.addedRooms.length} 条（已存在跳过）。`)
    }

    resetAll()
  } catch (e: any) {
    console.error(e)
    alert('导入失败')
  }
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
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
  display: flex;
  align-items: center;
  gap: 8px;
}

.subtitle {
  color: #646a73;
  font-size: 14px;
}

.card {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #dee0e3;
  font-size: 14px;
  color: #646a73;
  background: #fff;
}

.tab.active {
  border-color: #3370ff;
  color: #3370ff;
  background: #e1eaff;
}

.uploadSection {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.uploadRow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.uploadLabel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  background: #fff;
}

.uploadLabel:hover {
  background: #f2f3f5;
}

.hidden {
  display: none;
}

.fileName {
  font-size: 14px;
  color: #646a73;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btnReset {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.btnReset:hover {
  background: #f2f3f5;
}

.templateHint {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hintTitle {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hintCols {
  display: grid;
  gap: 4px;
}

.hintCol {
  font-size: 12px;
  color: #646a73;
}

.hintSub {
  font-size: 12px;
  color: #8f959e;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.storageKey {
  font-size: 12px;
  color: #8f959e;
}

.btnImport {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #3370ff;
  border: 1px solid #3370ff;
}

.btnImport:hover {
  background: #285cc9;
}

.btnImport:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  border-color: #e5e7eb;
  cursor: not-allowed;
}

.errorBox {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.errorTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #dc2626;
}

.errorList {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 14rem;
  overflow: auto;
}

.errorItem {
  font-size: 14px;
  color: #dc2626;
}

.errorMore {
  font-size: 14px;
  color: #dc2626;
}

.previewCard {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.previewHeader {
  padding: 16px;
  border-bottom: 1px solid #dee0e3;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.previewTitle {
  font-weight: 600;
  color: #1f2329;
}

.previewCount {
  font-size: 12px;
  color: #8f959e;
}

.previewBody {
  padding: 16px;
  overflow: auto;
}

.previewEmpty {
  text-align: center;
  color: #8f959e;
  padding: 40px 0;
}

.previewTable {
  min-width: 100%;
  font-size: 14px;
}

.previewTable th {
  padding: 8px 12px;
  text-align: left;
  background: #f5f6f7;
  color: #646a73;
  white-space: nowrap;
}

.previewTable td {
  padding: 8px 12px;
  white-space: nowrap;
  border-top: 1px solid #dee0e3;
}

.note {
  font-size: 12px;
  color: #8f959e;
}
</style>



