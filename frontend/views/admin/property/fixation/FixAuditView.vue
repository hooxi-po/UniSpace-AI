<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">转固审核</h2>
        <p class="desc">仅展示“待审核”项目。本模块审核对象为项目附件：支持批量通过，以及对单个附件进行审核通过/驳回。</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="search">
        <Search class="searchIcon" :size="16" />
        <input
          v-model="searchTerm"
          class="searchInput"
          placeholder="搜索项目名称/编号/承建单位..."
        />
      </div>
      <div class="count">共 {{ filteredProjects.length }} 项待审核</div>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>项目编号</th>
            <th>项目名称</th>
            <th>承建单位</th>
            <th>当前状态</th>
            <th>待审核附件</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProjects" :key="p.id">
            <td class="mono">{{ p.id }}</td>
            <td class="name">{{ p.name }}</td>
            <td class="muted">{{ p.contractor }}</td>
            <td>
              <span :class="getAssetStatusBadgeClass(p.status)">
                {{ getAssetStatusLabel(p.status) }}
              </span>
            </td>
            <td>
              <span :class="pendingCount(p) > 0 ? 'pending' : 'muted'">{{ pendingCount(p) }}</span>
            </td>
            <td>
              <button class="link" type="button" @click="openAudit(p.id)">
                <FileCheck :size="14" />
                附件审核
              </button>
            </td>
          </tr>

          <tr v-if="!loading && filteredProjects.length === 0">
            <td class="empty" colspan="6">暂无待审核的项目。</td>
          </tr>
          <tr v-if="loading">
            <td class="empty" colspan="6">加载中...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedProject" class="mask" @click="closeAudit">
      <div class="modal" @click.stop>
        <div class="modalHeader">
          <div>
            <div class="modalTitle">附件审核：{{ selectedProject.name }}</div>
            <div class="modalSub">项目编号：{{ selectedProject.id }}</div>
          </div>
          <button class="iconBtn" type="button" @click="closeAudit">
            <X :size="18" />
          </button>
        </div>

        <div class="modalBody">
          <div class="modalToolbar">
            <div class="muted">
              待审核附件：<span class="pendingStrong">{{ currentPendingAttachments.length }}</span>
            </div>
            <button
              class="btnGreen"
              type="button"
              :disabled="currentPendingAttachments.length === 0"
              @click="approveAllPending"
            >
              <Check :size="14" />
              批量通过
            </button>
          </div>

          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>附件名称</th>
                  <th>类型</th>
                  <th>上传部门</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in selectedProject.attachments" :key="a.id">
                  <td class="name">{{ a.name }}</td>
                  <td class="muted">{{ attachmentTypeLabel(a.type) }}</td>
                  <td class="muted">{{ a.uploadedByDept || '-' }}</td>
                  <td>
                    <span :class="statusPillClass(a.reviewStatus)">
                      {{ a.reviewStatus === 'Approved' ? '已通过' : a.reviewStatus === 'Rejected' ? '已驳回' : '待审核' }}
                    </span>
                  </td>
                  <td>
                    <div class="actions">
                      <button class="iconBtn" type="button" title="下载附件（模拟）" @click="handleDownload(selectedProject, a)">
                        <Download :size="16" />
                      </button>

                      <button
                        class="btnSmallGreen"
                        type="button"
                        :disabled="a.reviewStatus !== 'Pending'"
                        @click="reviewOne(a.id, 'Approved')"
                      >
                        通过
                      </button>
                      <button
                        class="btnSmallRed"
                        type="button"
                        :disabled="a.reviewStatus !== 'Pending'"
                        @click="reviewOne(a.id, 'Rejected')"
                      >
                        驳回
                      </button>
                    </div>
                  </td>
                </tr>

                <tr v-if="selectedProject.attachments.length === 0">
                  <td class="empty" colspan="5">该项目暂无附件。</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            <div class="hint">
              <XCircle :size="14" />
              <span>说明：所有待审核附件处理完成后，可将项目推进至“待归档”阶段。</span>
            </div>
            <button
              class="btnBlue"
              type="button"
              :disabled="currentPendingAttachments.length > 0"
              @click="goPendingArchive"
            >
              进入待归档
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>  
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Download, FileCheck, Search, X, XCircle } from 'lucide-vue-next'
import { useFixationAudit } from '~/composables/useFixationAudit'
import type { Attachment } from '~/server/utils/fixation-audit-db'

function downloadTextFile(filename: string, content: string) {
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

const {
  projects,
  loading,
  updateStatus,
  updateAttachment,
  getAssetStatusLabel,
  getAssetStatusBadgeClass,
} = useFixationAudit()

const searchTerm = ref('')
const selectedProjectId = ref<string | null>(null)

const filteredProjects = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  return projects.value
    .filter(p => p.status === 'PendingReview')
    .filter(p => {
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.contractor.toLowerCase().includes(q)
      )
    })
})

const selectedProject = computed(() => {
  if (!selectedProjectId.value) return null
  return projects.value.find(p => p.id === selectedProjectId.value) || null
})

const currentPendingAttachments = computed(() => {
  if (!selectedProject.value) return [] as Attachment[]
  return selectedProject.value.attachments.filter(a => (a.reviewStatus || 'Pending') === 'Pending')
})

function pendingCount(p: any) {
  return (p.attachments || []).filter((a: any) => (a.reviewStatus || 'Pending') === 'Pending').length
}

function openAudit(projectId: string) {
  selectedProjectId.value = projectId
}

function closeAudit() {
  selectedProjectId.value = null
}

function statusPillClass(status: Attachment['reviewStatus']) {
  if (status === 'Approved') return 'pill pillGreen'
  if (status === 'Rejected') return 'pill pillRed'
  return 'pill pillAmber'
}

function attachmentTypeLabel(type: Attachment['type']) {
  const map: Record<string, string> = {
    approval: '立项批复',
    bidding: '招投标文件',
    contract: '合同协议',
    change: '变更签证',
    drawing: '竣工图纸',
    acceptance: '验收报告',
    audit: '审计报告',
    other: '其他附件',
  }
  return map[type] || String(type)
}

async function reviewOne(attachmentId: string, status: 'Approved' | 'Rejected') {
  if (!selectedProject.value) return
  await updateAttachment(selectedProject.value.id, attachmentId, {
    reviewStatus: status,
    reviewedBy: '系统审核',
    reviewedAt: new Date().toISOString(),
    reviewNote: status === 'Approved' ? '审核通过' : '审核驳回',
  })
}

async function approveAllPending() {
  if (!selectedProject.value) return
  const pending = (selectedProject.value.attachments || []).filter(a => (a.reviewStatus || 'Pending') === 'Pending')
  if (pending.length === 0) return

  for (const a of pending) {
    await updateAttachment(selectedProject.value.id, a.id, {
      reviewStatus: 'Approved',
      reviewedBy: '系统审核',
      reviewedAt: new Date().toISOString(),
      reviewNote: a.reviewNote || '批量通过',
    })
  }
}

async function goPendingArchive() {
  if (!selectedProject.value) return
  if (currentPendingAttachments.value.length > 0) return
  await updateStatus(selectedProject.value.id, 'PendingArchive')
  closeAudit()
}

function handleDownload(project: any, attachment: Attachment) {
  const safeName = (attachment.name || 'attachment').replace(/[\\/:*?"<>|]/g, '_')
  const filename = safeName.endsWith('.txt') ? safeName : `${safeName}.txt`
  const content = [
    '【附件下载（模拟）】',
    `项目：${project.name} (${project.id})`,
    `附件：${attachment.name}`,
    `类型：${attachmentTypeLabel(attachment.type)}`,
    `上传部门：${attachment.uploadedByDept || '-'}`,
    `审核状态：${attachment.reviewStatus || 'Pending'}`,
    `下载时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n')

  downloadTextFile(filename, content)
}
</script>

<style scoped src="./FixAuditView.css"></style>
