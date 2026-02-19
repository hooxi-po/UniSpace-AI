import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'

type ImportTab = 'buildings' | 'rooms'

type BuildingRow = {
  code: string
  projectName: string
  contractor?: string
  supervisor?: string
  contractAmount?: number
  auditAmount?: number
  fundSource?: 'Fiscal' | 'SelfRaised' | 'Mixed'
  location?: string
  plannedArea?: number
  floorCount?: number
  roomCount?: number
  buildingName?: string
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  projectManager?: string
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
  rowIndex: number
  message: string
}

export function useFixStockImportView() {
  const STORAGE_KEYS = {
    BUILDINGS: 'fixation-stock-buildings',
    ROOMS: 'fixation-stock-rooms',
  }

  function normalizeHeader(h: unknown) {
    return String(h ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  }

  function parseNumber(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  function parseDateYMD(v: unknown): string | undefined {
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
  const fileName = ref('')
  const sheetNames = ref<string[]>([])
  const selectedSheet = ref('')
  const rawRows = ref<Array<Record<string, unknown>>>([])

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
        '工程名称(必填) / ProjectName',
        '承建单位 / Contractor',
        '监理单位 / Supervisor',
        '合同金额(元)(必填) / ContractAmount',
        '审计金额(元) / AuditAmount',
        '资金来源(Fiscal/SelfRaised/Mixed) / FundSource',
        '建设地点 / Location',
        '规划建筑面积(m²) / PlannedArea',
        '楼层 / FloorCount',
        '房间数 / RoomCount',
        '楼栋名称 / BuildingName',
        '项目负责人 / ProjectManager',
        '计划开工日期(YYYY-MM-DD) / PlannedStartDate',
        '计划竣工日期(YYYY-MM-DD) / PlannedEndDate',
        '实际开工日期(YYYY-MM-DD) / ActualStartDate',
        '实际竣工日期(YYYY-MM-DD) / ActualEndDate',
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

  function parseCurrentSheet(rows: Array<Record<string, unknown>>) {
    const nextErrors: RowError[] = []

    if (!rows || rows.length === 0) {
      buildingRows.value = []
      roomRows.value = []
      errors.value = [{ rowIndex: 0, message: 'Sheet 为空或无法解析。' }]
      return
    }

    const normalized = rows.map(r => {
      const out: Record<string, unknown> = {}
      Object.entries(r || {}).forEach(([k, v]) => {
        out[normalizeHeader(k)] = v
      })
      return out
    })

    const bAlias: Record<string, keyof BuildingRow> = {
      buildingcode: 'code',
      code: 'code',
      楼宇编码: 'code',
      楼栋编码: 'code',
      编码: 'code',
      projectname: 'projectName',
      工程名称: 'projectName',
      项目名称: 'projectName',
      name: 'projectName',
      contractor: 'contractor',
      承建单位: 'contractor',
      承建商: 'contractor',
      supervisor: 'supervisor',
      监理单位: 'supervisor',
      contractamount: 'contractAmount',
      合同金额: 'contractAmount',
      金额: 'contractAmount',
      auditamount: 'auditAmount',
      审计金额: 'auditAmount',
      fundsource: 'fundSource',
      资金来源: 'fundSource',
      location: 'location',
      建设地点: 'location',
      地点: 'location',
      地址: 'location',
      plannedarea: 'plannedArea',
      规划建筑面积: 'plannedArea',
      '规划建筑面积(m²)': 'plannedArea',
      floorcount: 'floorCount',
      楼层: 'floorCount',
      楼层数: 'floorCount',
      层数: 'floorCount',
      roomcount: 'roomCount',
      房间数: 'roomCount',
      buildingname: 'buildingName',
      楼栋名称: 'buildingName',
      楼宇名称: 'buildingName',
      projectmanager: 'projectManager',
      项目负责人: 'projectManager',
      plannedstartdate: 'plannedStartDate',
      计划开工日期: 'plannedStartDate',
      plannedenddate: 'plannedEndDate',
      计划竣工日期: 'plannedEndDate',
      actualstartdate: 'actualStartDate',
      实际开工日期: 'actualStartDate',
      actualenddate: 'actualEndDate',
      实际竣工日期: 'actualEndDate',
    }

    const rAlias: Record<string, keyof RoomRow> = {
      buildingcode: 'buildingCode',
      楼宇编码: 'buildingCode',
      楼栋编码: 'buildingCode',
      buildingname: 'buildingName',
      楼宇名称: 'buildingName',
      楼栋名称: 'buildingName',
      roomno: 'roomNo',
      房间号: 'roomNo',
      房号: 'roomNo',
      floor: 'floor',
      楼层: 'floor',
      area: 'area',
      面积: 'area',
      '面积㎡': 'area',
      type: 'type',
      房间类型: 'type',
      用途: 'type',
      status: 'status',
      状态: 'status',
      department: 'department',
      使用部门: 'department',
      部门: 'department',
    }

    if (tab.value === 'buildings') {
      const out: BuildingRow[] = normalized.map((r, idx) => {
        const mapped: Partial<Record<keyof BuildingRow, unknown>> = {}
        Object.entries(r).forEach(([k, v]) => {
          const key = bAlias[k] || bAlias[normalizeHeader(k)]
          if (key) mapped[key] = v
        })

        const code = String(mapped.code || '').trim()
        const projectName = String(mapped.projectName || '').trim()

        if (!code) nextErrors.push({ rowIndex: idx + 1, message: '楼宇编码为空' })
        if (!projectName) nextErrors.push({ rowIndex: idx + 1, message: '工程名称为空' })

        const plannedStartDate = parseDateYMD(mapped.plannedStartDate) || ''
        const plannedEndDate = parseDateYMD(mapped.plannedEndDate) || ''
        const actualStartDate = parseDateYMD(mapped.actualStartDate)
        const actualEndDate = parseDateYMD(mapped.actualEndDate)

        if (mapped.plannedStartDate && !parseDateYMD(mapped.plannedStartDate)) {
          nextErrors.push({ rowIndex: idx + 1, message: '计划开工日期格式不合法（建议 YYYY-MM-DD）' })
        }
        if (mapped.plannedEndDate && !parseDateYMD(mapped.plannedEndDate)) {
          nextErrors.push({ rowIndex: idx + 1, message: '计划竣工日期格式不合法（建议 YYYY-MM-DD）' })
        }
        if (mapped.actualStartDate && !parseDateYMD(mapped.actualStartDate)) {
          nextErrors.push({ rowIndex: idx + 1, message: '实际开工日期格式不合法（建议 YYYY-MM-DD）' })
        }
        if (mapped.actualEndDate && !parseDateYMD(mapped.actualEndDate)) {
          nextErrors.push({ rowIndex: idx + 1, message: '实际竣工日期格式不合法（建议 YYYY-MM-DD）' })
        }

        return {
          code,
          projectName,
          contractor: mapped.contractor ? String(mapped.contractor).trim() : undefined,
          supervisor: mapped.supervisor ? String(mapped.supervisor).trim() : undefined,
          contractAmount: parseNumber(mapped.contractAmount),
          auditAmount: parseNumber(mapped.auditAmount),
          fundSource: (mapped.fundSource as BuildingRow['fundSource']) || 'Fiscal',
          location: mapped.location ? String(mapped.location).trim() : undefined,
          plannedArea: parseNumber(mapped.plannedArea),
          floorCount: parseNumber(mapped.floorCount),
          roomCount: parseNumber(mapped.roomCount),
          buildingName: mapped.buildingName ? String(mapped.buildingName).trim() : undefined,
          projectManager: mapped.projectManager ? String(mapped.projectManager).trim() : undefined,
          plannedStartDate,
          plannedEndDate,
          actualStartDate,
          actualEndDate,
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
      const mapped: Partial<Record<keyof RoomRow, unknown>> = {}
      Object.entries(r).forEach(([k, v]) => {
        const key = rAlias[k] || rAlias[normalizeHeader(k)]
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
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>
    rawRows.value = rows
    parseCurrentSheet(rows)
  }

  const canImport = computed(() => {
    return errors.value.length === 0 && (
      (tab.value === 'buildings' && buildingRows.value.length > 0)
      || (tab.value === 'rooms' && roomRows.value.length > 0)
    )
  })

  const previewRows = computed(() => (tab.value === 'buildings' ? buildingRows.value : roomRows.value))

  async function doImport() {
    if (!canImport.value) return

    try {
      if (tab.value === 'buildings') {
        const toAdd = buildingRows.value
          .filter(r => r.code && r.projectName)
          .map(r => {
            const contractAmount = Number(r.contractAmount ?? 0)
            const auditAmount = r.auditAmount !== undefined ? Number(r.auditAmount) : undefined
            const auditReductionRate =
              auditAmount !== undefined && contractAmount > 0
                ? Number((((contractAmount - auditAmount) / contractAmount) * 100).toFixed(2))
                : undefined

            return {
              id: `STOCK-BLD-${r.code}`,
              name: r.projectName,
              contractor: r.contractor || '未指定',
              contractAmount,
              auditAmount,
              auditReductionRate,
              status: 'PendingReview',
              completionDate: r.plannedEndDate || new Date().toISOString().split('T')[0],
              hasCadData: false,
              fundSource: r.fundSource || 'Fiscal',
              location: r.location || '-',
              plannedArea: r.plannedArea !== undefined ? Number(r.plannedArea) : undefined,
              floorCount: r.floorCount !== undefined ? Number(r.floorCount) : undefined,
              roomCount: r.roomCount !== undefined ? Number(r.roomCount) : undefined,
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
              source: 'stock',
            }
          })

        const res = await $fetch<{ addedBuildings: unknown[] }>('/api/fixation/stock', {
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
            type: r.type || 'Admin',
            status: r.status || 'Empty',
            department: r.department || '',
          }))
        const res = await $fetch<{ addedRooms: unknown[] }>('/api/fixation/stock', {
          method: 'POST',
          body: { rooms: toAdd },
        })
        alert(`导入完成：新增房间 ${res.addedRooms.length} 条（已存在跳过）。`)
      }

      resetAll()
    } catch (error) {
      console.error(error)
      alert('导入失败')
    }
  }

  return {
    STORAGE_KEYS,
    tab,
    fileName,
    errors,
    templateHint,
    canImport,
    previewRows,
    switchTab,
    handleFileChange,
    resetAll,
    doImport,
  }
}
