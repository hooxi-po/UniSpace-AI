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

<style scoped src="./FixMappingView.css"></style>
