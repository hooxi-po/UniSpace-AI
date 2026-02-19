import { computed, reactive, ref } from 'vue'
import type { AssetCategory, AssetSplitItem, Attachment, Project } from '~/server/utils/fixation-audit-db'
import { useFixationAudit } from '~/composables/useFixationAudit'

export function useFixApplyView() {
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
    return !!p && (p.status === 'DisposalPending' || p.status === 'PendingReview')
  }

  const filtered = computed(() => {
    const q = searchTerm.value.trim().toLowerCase()
    const list = (projects.value || []) as Project[]
    return list.filter(p => {
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q)
        || p.id.toLowerCase().includes(q)
        || p.contractor.toLowerCase().includes(q)
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
    if (selectedProject.value?.id === p.id) {
      selectedProject.value = { ...selectedProject.value, status: 'PendingReview' }
    }
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
      depreciationMethod: (splitForm.depreciationMethod || 'StraightLine') as AssetSplitItem['depreciationMethod'],
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
    const next = nextType.trim() || String(att.type)
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

  return {
    flowSteps,
    searchTerm,
    selectedProject,
    detailTab,
    splitForm,
    uploadForm,
    splitSum,
    filtered,
    getAssetCategoryLabel,
    getAssetStatusLabel,
    getAssetStatusBadgeClass,
    isEditable,
    openDetail,
    closeDetail,
    startApply,
    onSplitAreaOrQty,
    addSplit,
    removeSplitItem,
    addAtt,
    getAttachmentTypeLabel,
    formatMoney,
    downloadAtt,
    resetAtt,
    editAtt,
    removeAtt,
  }
}
