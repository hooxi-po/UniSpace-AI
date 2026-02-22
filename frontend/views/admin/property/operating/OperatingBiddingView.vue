<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2 class="page__title">招商竞投</h2>
        <p class="page__subtitle">展示处于“公开招租”的房源，并支持参与竞标</p>
      </div>
    </div>

    <div class="filterCard">
      <div class="searchBox">
        <Search :size="16" class="searchIcon" />
        <input v-model="searchTerm" class="searchInput" placeholder="搜索房源名称..." />
      </div>

      <div class="countHint">公开招租：{{ filteredSpaces.length }} 处</div>
    </div>

    <div v-if="loading" class="loading">
      <RefreshCw :size="24" class="spinning" />
      <span>加载中...</span>
    </div>

    <div v-else class="propertyGrid">
      <div v-for="space in filteredSpaces" :key="space.id" class="propertyCard">
        <div class="propertyCard__header">
          <h3 class="propertyCard__title">{{ space.name }}</h3>
          <span class="badge badge--info">公开招租</span>
        </div>

        <div class="propertyCard__body">
          <div class="propertyCard__info">
            <span class="propertyCard__label">面积</span>
            <span class="propertyCard__value">{{ space.area }} m²</span>
          </div>
          <div v-if="space.monthlyRent" class="propertyCard__info">
            <span class="propertyCard__label">参考月租金</span>
            <span class="propertyCard__value propertyCard__value--primary">¥{{ space.monthlyRent.toLocaleString() }}</span>
          </div>
          <div class="propertyCard__info">
            <span class="propertyCard__label">竞标数</span>
            <span class="propertyCard__value">{{ (space.bids || []).length }} 条</span>
          </div>
        </div>

        <div class="propertyCard__actions">
          <button class="btn" @click="openBidDialog(space)">参与竞标</button>
        </div>
      </div>

      <div v-if="filteredSpaces.length === 0" class="empty">暂无“公开招租”的房源</div>
    </div>

    <!-- 参与竞标弹窗 -->
    <div v-if="activeSpace" class="modalMask" @click="closeBidDialog">
      <div class="modal modal--wide" @click.stop>
        <div class="modal__header">
          <div>
            <h3 class="modal__title">参与竞标 - {{ activeSpace.name }}</h3>
            <div class="modal__subtitle">提交竞标后，将显示在该房源竞标列表中（Mock 接口，已预留后端对接位置）</div>
          </div>
          <button class="modal__close" @click="closeBidDialog"><X :size="20" /></button>
        </div>

        <div class="modal__body">
          <div class="grid">
            <div class="form">
              <label class="field">
                <span class="field__label">竞标单位</span>
                <input v-model="form.company" class="input" placeholder="请输入单位名称" />
              </label>

              <label class="field">
                <span class="field__label">联系人</span>
                <input v-model="form.contactPerson" class="input" placeholder="请输入联系人" />
              </label>

              <label class="field">
                <span class="field__label">联系电话（可选）</span>
                <input v-model="form.contactPhone" class="input" placeholder="请输入联系电话" />
              </label>

              <label class="field">
                <span class="field__label">当前最高价</span>
                <div class="bid-hint">¥{{ maxBidAmount.toLocaleString() }}</div>
              </label>

              <label class="field">
                <span class="field__label">您的竞标金额（元）</span>
                <input v-model.number="form.amount" class="input" type="number" :min="maxBidAmount + 1" placeholder="请输入金额" />
                <div class="bid-hint">需高于当前最高价（至少 ¥{{ (maxBidAmount + 1).toLocaleString() }}）</div>
              </label>

              <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

              <div class="actions">
                <button class="btn btn--ghost" :disabled="submitting" @click="closeBidDialog">取消</button>
                <button class="btn btn--primary" :disabled="submitting" @click="submitBid">
                  <span v-if="submitting">提交中...</span>
                  <span v-else>确认提交</span>
                </button>
              </div>
            </div>

            <div class="bids">
              <div class="bids__header">
                <div class="bids__title">当前竞标列表</div>
                <button class="btn btn--mini" :disabled="bidsLoading" @click="reloadBids">
                  <RefreshCw :size="14" :class="bidsLoading ? 'spinning' : ''" />
                  刷新
                </button>
              </div>

              <div v-if="bidsLoading" class="hint">加载竞标列表中...</div>
              <div v-else-if="bids.length === 0" class="hint">暂无竞标数据</div>
              <table v-else class="bidTable">
                <thead>
                  <tr>
                    <th>竞标单位</th>
                    <th>联系人</th>
                    <th>金额 (元)</th>
                    <th>日期</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="bid in bids" :key="bid.id">
                    <td>{{ bid.company }}</td>
                    <td>{{ bid.contactPerson }}</td>
                    <td class="font-bold">¥{{ bid.amount.toLocaleString() }}</td>
                    <td>{{ bid.bidDate }}</td>
                    <td>
                      <span :class="['badge', bid.status === 'Winner' ? 'badge--success' : 'badge--gray']">
                        {{ bid.status === 'Winner' ? '中标' : '有效' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RefreshCw, Search, X } from 'lucide-vue-next'
import { useOperatingProperties } from '~/composables/property/useOperatingProperties'
import { createOperatingBid, getOperatingBids } from '~/services/operating-bidding'
import type { OperatingSpaceItem } from '~/services/operating'
import type { OperatingBidItem } from '~/types/operating-bidding'

const { spaces, loading } = useOperatingProperties()

const searchTerm = ref('')

const filteredSpaces = computed(() => {
  let result = spaces.value.filter(s => s.status === '公开招租')

  if (searchTerm.value.trim()) {
    const q = searchTerm.value.toLowerCase()
    result = result.filter(s => s.name.toLowerCase().includes(q))
  }

  return result
})

const activeSpace = ref<OperatingSpaceItem | null>(null)

const form = reactive({
  company: '',
  contactPerson: '',
  contactPhone: '',
  amount: 0,
})

const submitting = ref(false)
const errorMsg = ref('')

const bidsLoading = ref(false)
const bids = ref<OperatingBidItem[]>([])

const maxBidAmount = computed(() => {
  if (bids.value.length === 0) return 0
  return bids.value.reduce((max, b) => Math.max(max, b.amount || 0), 0)
})

function resetForm() {
  form.company = ''
  form.contactPerson = ''
  form.contactPhone = ''
  form.amount = 0
  errorMsg.value = ''
}

async function openBidDialog(space: OperatingSpaceItem) {
  activeSpace.value = space
  resetForm()
  await reloadBids()
}

function closeBidDialog() {
  activeSpace.value = null
  bids.value = []
  bidsLoading.value = false
  submitting.value = false
  errorMsg.value = ''
}

async function reloadBids() {
  if (!activeSpace.value) return

  bidsLoading.value = true
  try {
    const resp = await getOperatingBids(activeSpace.value.id)
    bids.value = resp.bids
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '加载竞标列表失败'
  } finally {
    bidsLoading.value = false
  }
}

function validate() {
  if (!activeSpace.value) return '未选择房源'
  if (!form.company.trim()) return '请填写竞标单位'
  if (!form.contactPerson.trim()) return '请填写联系人'
  if (!Number.isFinite(form.amount) || form.amount <= 0) return '请填写正确的竞标金额'
  return ''
}

async function submitBid() {
  const err = validate()
  if (err) {
    errorMsg.value = err
    return
  }
  if (!activeSpace.value) return

  submitting.value = true
  errorMsg.value = ''

  try {
    await createOperatingBid({
      spaceId: activeSpace.value.id,
      company: form.company,
      contactPerson: form.contactPerson,
      contactPhone: form.contactPhone || undefined,
      amount: Number(form.amount),
    })

    await reloadBids()
    resetForm()
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '提交竞标失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page__title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}

.page__subtitle {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}

.filterCard {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
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
  color: var(--muted);
}

.searchInput {
  width: 100%;
  padding: 8px 12px 8px 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.countHint {
  font-size: 13px;
  color: var(--muted);
}

.propertyGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.loading,
.empty {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.propertyCard {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  transition: all 0.2s;
}

.propertyCard:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: var(--primary);
}

.propertyCard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.propertyCard__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.propertyCard__body {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.propertyCard__info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.propertyCard__label {
  color: var(--muted);
}

.propertyCard__value {
  color: var(--text);
  font-weight: 500;
}

.propertyCard__value--primary {
  color: var(--primary);
}

.propertyCard__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge--info {
  background: #eff6ff;
  color: #3b82f6;
}

.badge--success {
  background: #eefdf3;
  color: #16a34a;
}

.badge--gray {
  background: #f1f2f3;
  color: var(--muted);
}

.modalMask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal--wide {
  max-width: 920px;
}

.modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.modal__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.modal__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.modal__close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: 4px;
}

.modal__body {
  padding: 20px;
  max-height: 75vh;
  overflow-y: auto;
}

.grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
}

.form {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 14px;
}

.field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.field__label {
  font-size: 12px;
  color: var(--muted);
}

.input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border);
  background: #fff;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: var(--primary);
  color: var(--primary);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.btn--primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: #fff;
}

.btn--ghost {
  background: transparent;
}

.btn--mini {
  padding: 6px 10px;
  font-size: 12px;
}

.error {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
}

.bids {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 14px;
}

.bids__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.bids__title {
  font-size: 13px;
  font-weight: 700;
}

.hint {
  font-size: 13px;
  color: var(--muted);
  padding: 18px 0;
}

.bid-hint {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.bidTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.bidTable th,
.bidTable td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.bidTable th {
  color: var(--muted);
  font-weight: 500;
  background: #f8fafc;
}

.font-bold {
  font-weight: 700;
}

@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>

