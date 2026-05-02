<template>
  <label class="switch" @click.stop>
    <input
      type="checkbox"
      :checked="checked"
      :disabled="disabled"
      @change="onInputChange"
    >
    <span />
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{
  checked: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
}>()

function onInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('toggle', target.checked)
}
</script>

<style scoped>
.switch {
  position: relative;
  display: inline-flex;
  width: 34px;
  height: 20px;
  align-items: center;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch span {
  position: relative;
  display: block;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: #d6d9dd;
  transition: all .2s ease;
}

.switch span::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform .2s ease;
}

.switch input:checked + span {
  background: #1664ff;
}

.switch input:checked + span::after {
  transform: translateX(14px);
}

.switch input:disabled + span {
  opacity: .55;
}
</style>

