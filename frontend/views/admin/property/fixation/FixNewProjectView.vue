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
import { useFixNewProjectView } from './useFixNewProjectView'

const {
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
} = useFixNewProjectView()
</script>

<style scoped src="./FixNewProjectView.css"></style>
