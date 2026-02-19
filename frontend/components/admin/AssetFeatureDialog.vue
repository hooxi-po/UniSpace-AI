<template>
  <div v-if="open" class="dialog">
    <div class="dialog__mask" @click="$emit('close')" />
    <div class="dialog__panel" @click.stop>
      <div class="dialog__header">
        <div>
          <div class="dialog__title">{{ title }}</div>
          <div class="dialog__subtitle">推荐先用表单模式，复杂场景再切高级 JSON</div>
        </div>
        <button class="btn btn--text" type="button" @click="$emit('close')">关闭</button>
      </div>

      <div class="dialog__mode-tabs">
        <button
          type="button"
          :class="['mode-tab', { 'mode-tab--active': editorMode === 'form' }]"
          :disabled="submitting"
          @click="switchMode('form')"
        >
          表单模式（推荐）
        </button>
        <button
          type="button"
          :class="['mode-tab', { 'mode-tab--active': editorMode === 'json' }]"
          :disabled="submitting"
          @click="switchMode('json')"
        >
          高级 JSON
        </button>
      </div>

      <div class="dialog__body">
        <div class="tips">
          <span>图层：{{ form.layer }}</span>
          <span>字段要求：id / layer / geometry</span>
          <span>上手建议：先填基础信息，再生成几何</span>
        </div>

        <template v-if="editorMode === 'form'">
          <div class="form-grid">
            <label class="field">
              <span class="field__label">ID</span>
              <input
                v-model.trim="form.id"
                class="field__input"
                type="text"
                :disabled="submitting || mode === 'edit'"
                placeholder="例如 building_001"
              >
              <span v-if="mode === 'edit'" class="field__hint">编辑模式下 ID 不可修改</span>
              <span v-if="formErrors.id" class="field__error">{{ formErrors.id }}</span>
            </label>

            <label class="field">
              <span class="field__label">图层</span>
              <select v-model="form.layer" class="field__input" :disabled="submitting">
                <option value="buildings">buildings</option>
                <option value="pipes">pipes</option>
              </select>
            </label>

            <label class="field field--inline">
              <span class="field__label">可见性</span>
              <input v-model="form.visible" class="field__checkbox" type="checkbox" :disabled="submitting">
            </label>

            <label class="field">
              <span class="field__label">名称</span>
              <input
                v-model.trim="form.name"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 1号教学楼 / 北区主管"
              >
            </label>

            <label v-if="form.layer === 'buildings'" class="field">
              <span class="field__label">建筑类型</span>
              <input
                v-model.trim="form.building"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 school / dormitory"
              >
            </label>

            <label v-if="form.layer === 'buildings'" class="field">
              <span class="field__label">用途</span>
              <input
                v-model.trim="form.amenity"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 office / library"
              >
            </label>

            <label v-if="form.layer === 'pipes'" class="field">
              <span class="field__label">道路类型（highway）</span>
              <input
                v-model.trim="form.highway"
                class="field__input"
                type="text"
                :disabled="submitting"
                placeholder="例如 service / primary"
              >
            </label>
          </div>

          <div class="geometry-card">
            <div class="geometry-card__header">
              <div>
                <div class="geometry-card__title">几何信息</div>
                <div class="geometry-card__desc">先选几何类型，再填坐标 JSON 数组</div>
              </div>
              <div class="geometry-card__actions">
                <button class="btn btn--small" type="button" :disabled="submitting" @click="fillExampleGeometry">填入示例</button>
                <button class="btn btn--small" type="button" :disabled="submitting" @click="resetGeometry">重置默认</button>
                <button class="btn btn--small" type="button" :disabled="submitting" @click="clearGeometry">清空</button>
              </div>
            </div>

            <label class="field">
              <span class="field__label">几何类型</span>
              <select v-model="form.geometryType" class="field__input" :disabled="submitting">
                <option v-for="type in geometryTypeOptions" :key="type" :value="type">{{ type }}</option>
              </select>
              <span v-if="formErrors.geometryType" class="field__error">{{ formErrors.geometryType }}</span>
            </label>

            <label class="field field--block">
              <span class="field__label">坐标（JSON）</span>
              <textarea
                v-model="form.coordinatesText"
                class="editor"
                spellcheck="false"
                :disabled="submitting"
              />
              <span v-if="formErrors.coordinates" class="field__error">{{ formErrors.coordinates }}</span>
            </label>
          </div>
        </template>

        <template v-else>
          <textarea v-model="payloadText" class="editor" spellcheck="false" :disabled="submitting" />
        </template>

        <div v-if="localError || apiError" class="error">{{ localError || apiError }}</div>
      </div>

      <div class="dialog__footer">
        <button
          v-if="editorMode === 'json'"
          class="btn"
          type="button"
          :disabled="submitting"
          @click="formatJson"
        >
          格式化 JSON
        </button>
        <button class="btn" type="button" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="btn btn--primary" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中...' : mode === 'create' ? '确认新增' : '确认保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetLayer, GeoFeaturePayload } from '~/services/geo-features'
import { useAssetFeatureDialog } from '~/composables/admin/useAssetFeatureDialog'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  layer: AssetLayer
  payload: GeoFeaturePayload | null
  submitting?: boolean
  apiError?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: GeoFeaturePayload): void
}>()

const {
  editorMode,
  payloadText,
  localError,
  form,
  title,
  geometryTypeOptions,
  formErrors,
  switchMode,
  formatJson,
  fillExampleGeometry,
  resetGeometry,
  clearGeometry,
  submit,
} = useAssetFeatureDialog(props, (payload) => emit('submit', payload))
</script>

<style scoped src="./AssetFeatureDialog.css"></style>
