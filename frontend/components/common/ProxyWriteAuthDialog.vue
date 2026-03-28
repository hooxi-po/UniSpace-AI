<template>
  <div v-if="open" class="proxy-auth" @keydown.esc="cancel">
    <div class="proxy-auth__mask" @click="cancel" />
    <div class="proxy-auth__panel" @click.stop>
      <div class="proxy-auth__title">写操作需要管理员凭证</div>
      <div class="proxy-auth__desc">
        当前请求命中了 Nuxt 写代理鉴权。输入后端写接口的管理员账号和密码后会自动重试本次操作。
      </div>

      <label class="proxy-auth__field">
        <span>管理员账号</span>
        <input
          v-model.trim="username"
          class="proxy-auth__input"
          type="text"
          autocomplete="username"
          placeholder="例如：admin"
        />
      </label>

      <label class="proxy-auth__field">
        <span>管理员密码</span>
        <input
          v-model="password"
          class="proxy-auth__input"
          type="password"
          autocomplete="current-password"
          placeholder="请输入密码"
        />
      </label>

      <div v-if="error" class="proxy-auth__error">{{ error }}</div>

      <div class="proxy-auth__footer">
        <button class="proxy-auth__btn" type="button" @click="cancel">取消</button>
        <button class="proxy-auth__btn proxy-auth__btn--primary" type="button" @click="submit">继续</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  PROXY_WRITE_AUTH_REQUEST_EVENT,
  cancelProxyWriteAuthorization,
  submitProxyWriteAuthorization,
} from '~/services/proxy-write-auth'

const open = ref(false)
const username = ref('')
const password = ref('')
const error = ref('')

function openDialog() {
  open.value = true
  password.value = ''
  error.value = ''
}

function handleRequest() {
  openDialog()
}

function cancel() {
  open.value = false
  password.value = ''
  error.value = ''
  cancelProxyWriteAuthorization()
}

function submit() {
  if (!username.value.trim()) {
    error.value = '请输入管理员账号'
    return
  }
  if (!password.value) {
    error.value = '请输入管理员密码'
    return
  }

  error.value = ''
  open.value = false
  submitProxyWriteAuthorization(username.value.trim(), password.value)
  password.value = ''
}

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener(PROXY_WRITE_AUTH_REQUEST_EVENT, handleRequest)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener(PROXY_WRITE_AUTH_REQUEST_EVENT, handleRequest)
  }
})
</script>

<style scoped>
.proxy-auth { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center; }
.proxy-auth__mask { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.28); }
.proxy-auth__panel {
  position: relative;
  width: min(420px, calc(100vw - 32px));
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.16);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.proxy-auth__title { font-size: 18px; font-weight: 700; color: #111827; }
.proxy-auth__desc { font-size: 13px; line-height: 1.6; color: #4b5563; }
.proxy-auth__field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #4b5563; }
.proxy-auth__input {
  height: 38px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  background: #fff;
  padding: 0 12px;
  font-size: 14px;
  color: #111827;
}
.proxy-auth__input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14); }
.proxy-auth__error {
  border-radius: 10px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  padding: 10px 12px;
}
.proxy-auth__footer { display: flex; justify-content: flex-end; gap: 8px; }
.proxy-auth__btn {
  height: 36px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
}
.proxy-auth__btn--primary { border-color: #6366f1; background: #6366f1; color: #fff; }
</style>
