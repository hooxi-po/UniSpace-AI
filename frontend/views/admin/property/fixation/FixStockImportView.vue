<template>
  <div class="page">
    <div class="header">
      <h2 class="title">
        <FileSpreadsheet :size="22" />
        存量房产导入（Excel）
      </h2>
      <p class="subtitle">支持导入楼宇与房间台账。导入策略：仅新增，重复跳过。</p>
    </div>

    <div class="card">
      <div class="tabs">
        <button
          :class="['tab', { active: tab === 'buildings' }]"
          @click="switchTab('buildings')"
        >
          楼宇导入
        </button>
        <button
          :class="['tab', { active: tab === 'rooms' }]"
          @click="switchTab('rooms')"
        >
          房间导入
        </button>
      </div>

      <div class="uploadSection">
        <div class="uploadRow">
          <label class="uploadLabel">
            <Upload :size="16" />
            选择 Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              class="hidden"
              @change="handleFileChange"
            />
          </label>

          <div v-if="fileName" class="fileName">{{ fileName }}</div>

          <button class="btnReset" @click="resetAll">
            <Trash2 :size="16" /> 重置
          </button>
        </div>

        <div class="templateHint">
          <div class="hintTitle">
            <Info :size="16" />
            {{ templateHint[tab].title }}
          </div>
          <div class="hintCols">
            <div v-for="c in templateHint[tab].cols" :key="c" class="hintCol">{{ c }}</div>
          </div>
          <div class="hintSub">提示：你可以使用英文表头（如 BuildingCode/RoomNo），也可用中文表头（如 楼宇编码/房间号）。</div>
        </div>

        <div class="actions">
          <div class="storageKey">当前落库：楼宇 {{ STORAGE_KEYS.BUILDINGS }} / 房间 {{ STORAGE_KEYS.ROOMS }}</div>
          <button
            class="btnImport"
            :disabled="!canImport"
            @click="doImport"
          >
            <CheckCircle2 :size="16" /> 确认导入
          </button>
        </div>
      </div>
    </div>

    <div v-if="errors.length > 0" class="errorBox">
      <div class="errorTitle">
        <AlertCircle :size="18" />
        校验错误（{{ errors.length }}）
      </div>
      <div class="errorList">
        <div v-for="(e, idx) in errors.slice(0, 100)" :key="`${e.rowIndex}-${idx}`" class="errorItem">
          第 {{ e.rowIndex }} 行：{{ e.message }}
        </div>
        <div v-if="errors.length > 100" class="errorMore">仅展示前 100 条错误</div>
      </div>
    </div>

    <div class="previewCard">
      <div class="previewHeader">
        <div class="previewTitle">数据预览</div>
        <div class="previewCount">共 {{ previewRows.length }} 行（展示前 50 行）</div>
      </div>
      <div class="previewBody">
        <div v-if="previewRows.length === 0" class="previewEmpty">请先选择 Excel 文件并解析。</div>
        <table v-else class="previewTable">
          <thead>
            <tr>
              <th v-for="k in Object.keys(previewRows[0] as any)" :key="k">{{ k }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in (previewRows as any[]).slice(0, 50)" :key="idx">
              <td v-for="k in Object.keys(previewRows[0] as any)" :key="k">{{ String((r as any)[k] ?? '') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="note">说明：本模块仅做 Excel 导入与本地落库（JSON）。重复数据将跳过，不覆盖。</div>
  </div>
</template>

<script setup lang="ts">
import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Trash2, Info } from 'lucide-vue-next'
import { useFixStockImportView } from './useFixStockImportView'

const {
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
} = useFixStockImportView()
</script>

<style scoped src="./FixStockImportView.css"></style>


