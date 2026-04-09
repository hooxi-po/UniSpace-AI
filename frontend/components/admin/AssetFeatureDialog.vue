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
          </div>

          <div v-if="form.layer === 'buildings'" class="config-card">
            <div class="config-card__header">
              <div>
                <div class="config-card__title">建筑信息</div>
                <div class="config-card__desc">提供常用建筑类型、用途和楼层建议，可直接选择后微调</div>
              </div>
            </div>

            <div class="form-grid">
              <label class="field">
                <span class="field__label">建筑类型</span>
                <input
                  v-model.trim="form.building"
                  class="field__input"
                  type="text"
                  list="building-type-options"
                  :disabled="submitting"
                  placeholder="例如 school / dormitory"
                >
                <span class="field__hint">可选常用类型，也支持手填</span>
              </label>

              <label class="field">
                <span class="field__label">用途</span>
                <input
                  v-model.trim="form.amenity"
                  class="field__input"
                  type="text"
                  list="building-amenity-options"
                  :disabled="submitting"
                  placeholder="例如 office / library"
                >
                <span class="field__hint">常用用途已预置，兼容自定义值</span>
              </label>

              <label class="field">
                <span class="field__label">楼层</span>
                <input
                  v-model.trim="form.levels"
                  class="field__input"
                  type="text"
                  list="building-level-options"
                  :disabled="submitting"
                  placeholder="例如 6"
                >
                <span class="field__hint">建议值可选，留空则不写入</span>
                <span v-if="formErrors.levels" class="field__error">{{ formErrors.levels }}</span>
              </label>
            </div>
          </div>

          <div v-else class="config-card">
            <div class="config-card__header">
              <div>
                <div class="config-card__title">管道信息</div>
                <div class="config-card__desc">为道路类型提供常用选项，便于快速录入管道源数据</div>
              </div>
            </div>

            <div class="form-grid">
              <label class="field">
                <span class="field__label">道路类型（highway）</span>
                <input
                  v-model.trim="form.highway"
                  class="field__input"
                  type="text"
                  list="pipe-highway-options"
                  :disabled="submitting"
                  placeholder="例如 service / primary"
                >
                <span class="field__hint">支持 service / primary / residential 等常用值</span>
              </label>
            </div>
          </div>

          <div v-if="form.layer === 'buildings'" class="config-card">
            <div class="config-card__header">
              <div>
                <div class="config-card__title">模型配置</div>
                <div class="config-card__desc">启用后可直接在后台绑定 GLB 模型，并调整缩放与姿态</div>
              </div>
            </div>

            <div class="form-grid">
              <label class="field field--inline field--block">
                <span class="field__label">启用模型</span>
                <input
                  v-model="form.modelEnabled"
                  class="field__checkbox"
                  type="checkbox"
                  :disabled="submitting"
                >
                <span class="field__hint">关闭后会保留建筑面，不加载 3D 模型</span>
              </label>

              <label class="field">
                <span class="field__label">模型文件</span>
                <input
                  v-model.trim="form.modelUrl"
                  class="field__input"
                  type="text"
                  list="building-model-url-options"
                  :disabled="submitting || !form.modelEnabled"
                  placeholder="/models/residential_building.glb"
                >
                <span class="field__hint">提供常用 GLB 预设，也支持手填自定义路径</span>
                <span v-if="formErrors.modelUrl" class="field__error">{{ formErrors.modelUrl }}</span>
              </label>

              <label class="field">
                <span class="field__label">缩放模式</span>
                <select
                  v-model="form.modelScaleMode"
                  class="field__input"
                  :disabled="submitting || !form.modelEnabled"
                >
                  <option
                    v-for="option in modelScaleModeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <span class="field__hint">
                  {{ form.modelScaleMode === 'auto'
                    ? '按建筑底面自动适配，再叠加倍率'
                    : '直接使用固定缩放值，适合精确手调' }}
                </span>
              </label>

              <label class="field">
                <span class="field__label">缩放倍率</span>
                <input
                  v-model.trim="form.modelScale"
                  class="field__input"
                  type="text"
                  list="building-model-scale-options"
                  :disabled="submitting || !form.modelEnabled"
                  placeholder="例如 1 / 1.5 / 10"
                >
                <span class="field__hint">数值越大模型越大，必须大于 0</span>
                <span v-if="formErrors.modelScale" class="field__error">{{ formErrors.modelScale }}</span>
              </label>

              <label class="field">
                <span class="field__label">Heading</span>
                <input
                  v-model.trim="form.modelHeading"
                  class="field__input"
                  type="text"
                  list="building-model-heading-options"
                  :disabled="submitting || !form.modelEnabled"
                  placeholder="例如 0 / 90 / 180"
                >
                <span class="field__hint">绕垂直轴旋转，单位是度</span>
                <span v-if="formErrors.modelHeading" class="field__error">{{ formErrors.modelHeading }}</span>
              </label>

              <label class="field">
                <span class="field__label">Pitch</span>
                <input
                  v-model.trim="form.modelPitch"
                  class="field__input"
                  type="text"
                  list="building-model-pitch-options"
                  :disabled="submitting || !form.modelEnabled"
                  placeholder="例如 -15 / 0 / 15"
                >
                <span class="field__hint">前后俯仰角，单位是度</span>
                <span v-if="formErrors.modelPitch" class="field__error">{{ formErrors.modelPitch }}</span>
              </label>

              <label class="field">
                <span class="field__label">Roll</span>
                <input
                  v-model.trim="form.modelRoll"
                  class="field__input"
                  type="text"
                  list="building-model-roll-options"
                  :disabled="submitting || !form.modelEnabled"
                  placeholder="例如 -15 / 0 / 15"
                >
                <span class="field__hint">左右倾斜角，单位是度</span>
                <span v-if="formErrors.modelRoll" class="field__error">{{ formErrors.modelRoll }}</span>
              </label>
            </div>
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

          <datalist id="building-type-options">
            <option v-for="option in buildingTypeOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="building-amenity-options">
            <option v-for="option in amenityOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="building-level-options">
            <option v-for="option in buildingLevelOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="pipe-highway-options">
            <option value="service" />
            <option value="primary" />
            <option value="secondary" />
            <option value="tertiary" />
            <option value="residential" />
            <option value="footway" />
          </datalist>

          <datalist id="building-model-url-options">
            <option v-for="option in modelUrlOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="building-model-scale-options">
            <option v-for="option in modelScaleOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="building-model-heading-options">
            <option v-for="option in modelHeadingOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="building-model-pitch-options">
            <option v-for="option in modelPitchOptions" :key="option" :value="option" />
          </datalist>

          <datalist id="building-model-roll-options">
            <option v-for="option in modelRollOptions" :key="option" :value="option" />
          </datalist>
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
  buildingTypeOptions,
  amenityOptions,
  buildingLevelOptions,
  modelUrlOptions,
  modelScaleModeOptions,
  modelScaleOptions,
  modelHeadingOptions,
  modelPitchOptions,
  modelRollOptions,
  switchMode,
  formatJson,
  fillExampleGeometry,
  resetGeometry,
  clearGeometry,
  submit,
} = useAssetFeatureDialog(props, (payload) => emit('submit', payload))
</script>

<style scoped src="./AssetFeatureDialog.css"></style>
