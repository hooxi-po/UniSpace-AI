<template>
  <div class="page">
    <div class="header">
      <div>
        <h2 class="title">数据分析</h2>
        <p class="subtitle">公用房申请、分配及台账使用情况的实时统计与多维分析。</p>
      </div>
      <button class="btnPrimary" @click="fetchData">
        <RefreshCw :size="14" :class="{ spinning: loading }" /> 刷新数据
      </button>
    </div>

    <!-- 顶部统计卡片 -->
    <div class="statsGrid">
      <div class="statCard">
        <div class="statIcon bgAmber"><Clock :size="20" /></div>
        <div class="statInfo">
          <div class="statValue">{{ stats.pendingApproval }}</div>
          <div class="statLabel">待审批申请</div>
        </div>
      </div>
      <div class="statCard">
        <div class="statIcon bgGreen"><Home :size="20" /></div>
        <div class="statInfo">
          <div class="statValue">{{ stats.availableRooms }}</div>
          <div class="statLabel">可分配房源</div>
          <div class="statSub">{{ stats.totalAvailableArea.toFixed(1) }} m²</div>
        </div>
      </div>
      <div class="statCard">
        <div class="statIcon bgBlue"><Calendar :size="20" /></div>
        <div class="statInfo">
          <div class="statValue">{{ stats.expiringBorrows }}</div>
          <div class="statLabel">即将到期借用</div>
          <div class="statSub">30天内到期</div>
        </div>
      </div>
      <div class="statCard">
        <div class="statIcon bgIndigo"><BarChart3 :size="20" /></div>
        <div class="statInfo">
          <div class="statValue">{{ occupancyRate }}%</div>
          <div class="statLabel">房源占用率</div>
        </div>
      </div>
    </div>

    <div class="mainCharts">
      <!-- 申请状态分布 -->
      <div class="chartCard">
        <div class="cardHeader">
          <h3 class="cardTitle"><PieChart :size="18" /> 申请状态分布</h3>
        </div>
        <div class="chartContent">
          <div class="distList">
            <div class="distItem">
              <div class="distLabel">待审批</div>
              <div class="distBarWrap">
                <div class="distBar bgAmber" :style="{ width: getPercent(stats.pendingApproval, stats.totalRequests) + '%' }"></div>
                <span class="distValue">{{ stats.pendingApproval }}</span>
              </div>
            </div>
            <div class="distItem">
              <div class="distLabel">已批准</div>
              <div class="distBarWrap">
                <div class="distBar bgBlue" :style="{ width: getPercent(stats.approved, stats.totalRequests) + '%' }"></div>
                <span class="distValue">{{ stats.approved }}</span>
              </div>
            </div>
            <div class="distItem">
              <div class="distLabel">已驳回</div>
              <div class="distBarWrap">
                <div class="distBar bgRed" :style="{ width: getPercent(stats.rejected, stats.totalRequests) + '%' }"></div>
                <span class="distValue">{{ stats.rejected }}</span>
              </div>
            </div>
          </div>
          <div class="chartFooter">共计 {{ stats.totalRequests }} 项申请</div>
        </div>
      </div>

      <!-- 房源状态分布 -->
      <div class="chartCard">
        <div class="cardHeader">
          <h3 class="cardTitle"><Home :size="18" /> 房源状态分布</h3>
        </div>
        <div class="chartContent">
          <div class="distList">
            <div class="distItem">
              <div class="distLabel">可分配</div>
              <div class="distBarWrap">
                <div class="distBar bgGreen" :style="{ width: getPercent(stats.availableRooms, stats.totalRooms) + '%' }"></div>
                <span class="distValue">{{ stats.availableRooms }}</span>
              </div>
            </div>
            <div class="distItem">
              <div class="distLabel">已占用</div>
              <div class="distBarWrap">
                <div class="distBar bgIndigo" :style="{ width: getPercent(stats.occupiedRooms, stats.totalRooms) + '%' }"></div>
                <span class="distValue">{{ stats.occupiedRooms }}</span>
              </div>
            </div>
          </div>
          <div class="chartFooter">共计 {{ stats.totalRooms }} 间房间</div>
        </div>
      </div>

      <!-- 楼栋房源分布详情 -->
      <div class="chartCard fullWidth">
        <div class="cardHeader">
          <h3 class="cardTitle"><Building :size="18" /> 楼栋房源分布</h3>
        </div>
        <div class="chartContent">
          <div class="tableWrap">
            <table class="table">
              <thead>
                <tr>
                  <th>楼栋名称</th>
                  <th>房间总数</th>
                  <th>可分配房间</th>
                  <th>可用比例</th>
                  <th>分布情况</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in buildingDistribution" :key="b.name">
                  <td class="fontBold">{{ b.name }}</td>
                  <td>{{ b.total }}</td>
                  <td>{{ b.available }}</td>
                  <td>{{ getPercent(b.available, b.total) }}%</td>
                  <td class="barCell">
                    <div class="miniBar">
                      <div class="miniBarFill bgGreen" :style="{ width: getPercent(b.available, b.total) + '%' }"></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  RefreshCw, Clock, Home, Calendar, BarChart3, PieChart, Building 
} from 'lucide-vue-next'
import { useAllocationAnalysis } from '~/composables/useAllocationAnalysis'

const { loading, stats, buildingDistribution, fetchData } = useAllocationAnalysis()

const occupancyRate = computed(() => {
  if (stats.value.totalRooms === 0) return 0
  return ((stats.value.occupiedRooms / stats.value.totalRooms) * 100).toFixed(1)
})

function getPercent(val: number, total: number) {
  if (total === 0) return 0
  return ((val / total) * 100).toFixed(1)
}
</script>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.subtitle {
  color: #646a73;
  font-size: 14px;
  margin-top: 4px;
}

.btnPrimary {
  background: #3370ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.statsGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.statCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.statIcon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bgAmber { background: #fff7ed; color: #c2410c; }
.bgGreen { background: #ecfdf5; color: #047857; }
.bgBlue { background: #eff6ff; color: #1d4ed8; }
.bgIndigo { background: #e0e7ff; color: #4338ca; }
.bgRed { background: #fef2f2; color: #dc2626; }

.statValue {
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.statLabel {
  font-size: 12px;
  color: #8f959e;
  margin-top: 2px;
}

.statSub {
  font-size: 11px;
  color: #646a73;
  margin-top: 2px;
}

.mainCharts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chartCard {
  background: #fff;
  border: 1px solid #dee0e3;
  border-radius: 12px;
  overflow: hidden;
}

.fullWidth {
  grid-column: 1 / -1;
}

.cardHeader {
  padding: 16px;
  border-bottom: 1px solid #eef0f2;
}

.cardTitle {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2329;
}

.chartContent {
  padding: 20px;
}

.distList {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.distItem {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.distLabel {
  font-size: 13px;
  color: #646a73;
}

.distBarWrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.distBar {
  height: 12px;
  border-radius: 6px;
  min-width: 4px;
  transition: width 0.5s ease-out;
}

.distValue {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  min-width: 30px;
}

.chartFooter {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px dashed #dee0e3;
  font-size: 12px;
  color: #8f959e;
  text-align: right;
}

.tableWrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: 12px;
  background: #f8fafc;
  font-size: 13px;
  color: #646a73;
}

.table td {
  padding: 12px;
  border-top: 1px solid #eef0f2;
  font-size: 14px;
  color: #1f2329;
}

.fontBold { font-weight: 600; }

.barCell {
  width: 200px;
}

.miniBar {
  width: 100%;
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.miniBarFill {
  height: 100%;
  transition: width 0.5s ease-out;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1200px) {
  .statsGrid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .mainCharts { grid-template-columns: 1fr; }
  .statsGrid { grid-template-columns: 1fr; }
}
</style>
