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
import { useFixApplyView } from './useFixApplyView'

const {
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
} = useFixApplyView()
</script>

<style scoped src="./FixApplyView.css"></style>
