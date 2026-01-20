<template>
  <button 
    v-if="!isOpen"
    @click="isOpen = true"
    class="absolute bottom-6 right-6 w-14 h-14 bg-tech-blue/20 backdrop-blur-md border border-tech-blue rounded-full flex items-center justify-center text-tech-blue shadow-[0_0_20px_rgba(30,144,255,0.4)] hover:scale-110 transition-transform z-50 group"
  >
    <Bot :size="24" />
    <span class="absolute -top-1 -right-1 w-3 h-3 bg-tech-cyan rounded-full animate-ping" />
  </button>

  <div v-else class="absolute right-4 bottom-4 w-96 z-40 transition-all duration-500 ease-in-out">
    <TechPanel title="AI 助手 // NOAH 核心" class="h-[500px] flex flex-col">
      <!-- Controls -->
      <button 
        @click="isOpen = false"
        class="absolute top-4 right-4 text-tech-cyan opacity-50 hover:opacity-100 z-50"
      >
        <Minimize2 :size="16" />
      </button>

      <!-- Visualization of "Listening" -->
      <div class="h-12 w-full border-b border-white/10 flex items-center justify-center gap-1 mb-2">
        <div 
          v-for="i in 5"
          :key="i"
          :class="['w-1 bg-tech-cyan transition-all duration-100', isTyping ? 'animate-pulse' : '']"
          :style="{ 
            height: isTyping ? `${Math.random() * 20 + 10}px` : '4px',
            animationDelay: `${i * 0.1}s` 
          }"
        />
      </div>

      <!-- Messages -->
      <div class="flex-grow overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
        <div 
          v-for="(msg, idx) in messages" 
          :key="idx" 
          :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <div 
            :class="[
              'max-w-[85%] p-3 text-xs font-mono leading-relaxed',
              msg.role === 'user' 
                ? 'bg-tech-blue/20 border border-tech-blue/30 text-white rounded-tl-lg rounded-bl-lg rounded-br-lg' 
                : 'bg-white/5 border-l-2 border-tech-cyan text-gray-300'
            ]"
          >
            <span v-if="msg.text">{{ msg.text }}</span>
            <span v-else-if="msg.isLoading" class="animate-pulse">_数据处理中...</span>
          </div>
        </div>
        <div ref="messagesEndRef" />
      </div>

      <!-- Input -->
      <div class="relative">
        <input
          v-model="input"
          type="text"
          @keydown.enter="handleSend"
          placeholder="输入指令 / 查询..."
          class="w-full bg-black/50 border border-tech-cyan/30 p-3 pr-10 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-tech-cyan focus:shadow-[0_0_10px_rgba(0,242,255,0.2)] transition-all"
          autofocus
        />
        <button 
          @click="handleSend"
          :disabled="isTyping || !input.trim()"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-tech-cyan disabled:opacity-30 hover:text-white transition-colors"
        >
          <Send :size="16" />
        </button>
      </div>
    </TechPanel>
  </div>
</template>

<script setup lang="ts">
import { Bot, Send, Minimize2 } from 'lucide-vue-next'
import type { ChatMessage } from '~/types'

const isOpen = ref(false)
const input = ref('')
const messages = ref<ChatMessage[]>([
  { role: 'model', text: 'NOAH 已上线。全系统监控激活。请问有关地下管网的指令？' }
])
const isTyping = ref(false)
const messagesEndRef = ref<HTMLDivElement>()

const { streamChatResponse } = useGeminiChat()

const scrollToBottom = () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

watch(messages, scrollToBottom, { deep: true })

const handleSend = async () => {
  if (!input.value.trim() || isTyping.value) return

  const userMsg: ChatMessage = { role: 'user', text: input.value }
  messages.value.push(userMsg)
  input.value = ''
  isTyping.value = true

  const modelMsgPlaceholder: ChatMessage = { role: 'model', text: '', isLoading: true }
  messages.value.push(modelMsgPlaceholder)

  let fullText = ''
  
  await streamChatResponse([...messages.value.slice(0, -1), userMsg], (chunk) => {
    fullText += chunk
    messages.value[messages.value.length - 1] = { 
      role: 'model', 
      text: fullText, 
      isLoading: false 
    }
  })

  isTyping.value = false
}
</script>
