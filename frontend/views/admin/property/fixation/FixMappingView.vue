<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">高基表映射</h2>
        <p class="desc">对“待归档 / 已归档”的项目进行高基表字段映射，确保数据准确上报。</p>
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
            <th>当前状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProjects" :key="p.id" class="row">
            <td class="mono">{{ p.id }}</td>
            <td class="name">{{ p.name }}</td>
            <td>
              <span :class="getAssetStatusBadgeClass(p.status)">{{ getAssetStatusLabel(p.status) }}</span>
            </td>
            <td>
              <button class="link" type="button" @click="openMapping(p.id)">
                <CheckCircle2 :size="14" />
                映射
              </button>
            </td>
          </tr>

          <tr v-if="!loading && filteredProjects.length === 0">
            <td class="empty" colspan="4">暂无“待归档 / 已归档”的项目需要进行高基表映射。</td>
          </tr>
          <tr v-if="loading">
            <td class="empty" colspan="4">加载中...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedProject" class="mask" @click="closeMapping">
      <div class="modal" @click.stop>
        <div class="modalHeader">
          <div>
            <div class="modalTitle">高基表映射：{{ selectedProject.name }}</div>
            <div class="modalSub">{{ selectedProject.id }}</div>
          </div>
          <button class="iconBtn" type="button" @click="closeMapping">
            <X :size="18" />
          </button>
        </div>

        <div class="modalBody">
          <div class="panel">
            <div class="panelTitle">高基表字段映射</div>

            <div v-if="!isEditable" class="readonlyTip">
              <AlertCircle :size="16" />
              <div>
                <div class="readonlyTitle">只读模式</div>
                <div class="readonlyDesc">当前仅支持在“待归档 / 已归档”阶段维护高基表映射。</div>
              </div>
            </div>

            <div class="grid">
              <div class="field">
                <label>资产编号</label>
                <input v-model="form.assetCode" :readonly="!isEditable" :class="inputClass" placeholder="高基表资产编号" />
              </div>
              <div class="field">
                <label>资产名称</label>
                <input v-model="form.assetName" :readonly="!isEditable" :class="inputClass" placeholder="高基表资产名称" />
              </div>
              <div class="field">
                <label>使用部门</label>
                <input v-model="form.department" :readonly="!isEditable" :class="inputClass" placeholder="资产使用部门" />
              </div>
              <div class="field">
                <label>使用年限</label>
                <input
                  v-model.number="form.serviceLife"
                  type="number"
                  :readonly="!isEditable"
                  :class="inputClass"
                  placeholder="资产使用年限"
                />
              </div>
              <div class="field">
                <label>原值</label>
                <input
                  v-model.number="form.originalValue"
                  type="number"
                  :readonly="!isEditable"
                  :class="inputClass"
                  placeholder="资产原值"
                />
              </div>
              <div class="field">
                <label>残值率</label>
                <input
                  v-model.number="form.residualRate"
                  type="number"
                  step="0.01"
                  :readonly="!isEditable"
                  :class="inputClass"
                  placeholder="0.05"
                />
              </div>
            </div>

            <div class="actions">
              <button class="btnPrimary" type="button" :disabled="!isEditable || saving" @click="save">
                <Save :size="14" />
                {{ saving ? '保存中...' : '保存映射信息' }}
              </button>
            </div>
          </div>

          <div class="hint">
            <AlertCircle :size="14" />
            <span>高基表映射信息将用于资产年报上报，请确保信息准确无误。</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { AlertCircle, CheckCircle2, Save, Search, X } from 'lucide-vue-next'
import { useFixationAudit } from '~/composables/useFixationAudit'
import { reportsService } from '~/services/reports'
import type { Project } from '~/server/utils/fixation-audit-db'

type GaojibiaoForm = {
  assetCode: string
  assetName: string
  department: string
  serviceLife: number | null
  originalValue: number | null
  residualRate: number | null
}

const {
  projects,
  loading,
  updateStatus,
  getAssetStatusLabel,
  getAssetStatusBadgeClass,
} = useFixationAudit()

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

const form = reactive<GaojibiaoForm>({
  assetCode: '',
  assetName: '',
  department: '',
  serviceLife: null,
  originalValue: null,
  residualRate: null,
})

const inputClass = computed(() => {
  return isEditable.value ? 'input' : 'input inputReadonly'
})

watch(selectedProject, (p) => {
  const data = (p as any)?.gaojibiaoData || {}
  form.assetCode = data.assetCode || ''
  form.assetName = data.assetName || ''
  form.department = data.department || ''
  form.serviceLife = typeof data.serviceLife === 'number' ? data.serviceLife : (data.serviceLife ? Number(data.serviceLife) : null)
  form.originalValue = typeof data.originalValue === 'number' ? data.originalValue : (data.originalValue ? Number(data.originalValue) : null)
  form.residualRate = typeof data.residualRate === 'number' ? data.residualRate : (data.residualRate ? Number(data.residualRate) : null)
}, { immediate: true })

function openMapping(projectId: string) {
  selectedProjectId.value = projectId
}

function closeMapping() {
  selectedProjectId.value = null
}

async function save() {
  const p = selectedProject.value as Project | null
  if (!p) return
  if (!isEditable.value) return

  saving.value = true
  try {
    const gaojibiaoData = {
      assetCode: form.assetCode || undefined,
      assetName: form.assetName || undefined,
      department: form.department || undefined,
      serviceLife: form.serviceLife === null ? undefined : Number(form.serviceLife),
      originalValue: form.originalValue === null ? undefined : Number(form.originalValue),
      residualRate: form.residualRate === null ? undefined : Number(form.residualRate),
    }

    // 1) 同步到转固项目（mock DB：fixation-audit.json）
    await updateStatus(p.id, p.status)
    // 使用 patch updateProject 写入 gaojibiaoData（复用已有 /api/fixation/audit PATCH）
    // updateStatus 内部也是 patch，但这里只是触发 updateItem；真正写入通过 patchAudit 由 composable 暴露的 updateStatus 不包含额外字段
    // 因此这里直接调用后端 patch：通过 useFixationAudit 暂未暴露 updateProject，使用 $fetch 调用
    await $fetch('/api/fixation/audit', {
      method: 'PATCH',
      body: { op: 'updateProject', projectId: p.id, updates: { gaojibiaoData } },
    })

    // 2) 同步到“报表统计中心-教育部高基表”（mock JSON：reports-gaojibiao.json）
    await reportsService.upsertGaojibiaoRow({
      projectId: p.id,
      projectName: p.name,
      ...gaojibiaoData,
    })

    alert('高基表映射数据已保存，并已同步到报表统计中心（mock）。')
    closeMapping()
  } catch (e) {
    console.error(e)
    alert('保存失败，请稍后重试')
  } finally {
    saving.value = false
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

.title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.desc {
  margin-top: 6px;
  color: #646a73;
  font-size: 14px;
}

.toolbar {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.search {
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

.count {
  color: #646a73;
  font-size: 14px;
}

.card {
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

.empty {
  padding: 24px;
  text-align: center;
  color: #8f959e;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 16px;
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

.iconBtn {
  border: none;
  background: transparent;
  color: #646a73;
  padding: 4px;
}

.modalBody {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel {
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 12px;
  background: #f9fafb;
}

.panelTitle {
  font-weight: 700;
  color: #1f2329;
  margin-bottom: 12px;
}

.readonlyTip {
  display: flex;
  gap: 10px;
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  color: #92400e;
}

.readonlyTitle {
  font-weight: 700;
}

.readonlyDesc {
  font-size: 12px;
  margin-top: 2px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field label {
  display: block;
  font-size: 12px;
  color: #646a73;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  border: 1px solid #dee0e3;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  background: #fff;
}

.inputReadonly {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: 1px solid #3370ff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btnPrimary:disabled {
  opacity: 0.5;
}

.hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8f959e;
  font-size: 12px;
}

@media (max-width: 900px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
