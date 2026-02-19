import { computed, reactive, ref } from 'vue'

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

export function useFixNewProjectView() {
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
    } catch (error) {
      console.error(error)
      alert('保存失败')
      return
    }

    alert('已保存')
    resetForm()
  }

  return {
    formData,
    buildingName,
    newAttachments,
    newSplitItems,
    newRoomPlans,
    roomForm,
    splitForm,
    uploadForm,
    floorOptions,
    auditReductionRateText,
    addRoom,
    removeRoom,
    onSplitAreaOrQty,
    addSplitItem,
    removeSplitItem,
    addAttachment,
    removeAttachment,
    formatMoney,
    resetForm,
    handleSubmit,
  }
}
