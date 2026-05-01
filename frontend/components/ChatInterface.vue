<template>
  <button
    v-if="showLauncher"
    @click="setOpen(true)"
    class="absolute bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-tech-blue bg-tech-blue/20 text-tech-blue shadow-[0_0_20px_rgba(30,144,255,0.4)] backdrop-blur-md transition-transform group hover:scale-110"
  >
    <Bot :size="24" />
    <span class="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-tech-cyan" />
  </button>

  <div
    v-if="isOpen"
    :class="wrapperClass"
  >
    <TechPanel
      :title="titleText"
      class="flex h-[500px] flex-col overflow-hidden"
      content-class="flex min-h-0 flex-1 flex-col p-3"
    >
      <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Controls -->
        <button
          @click="setOpen(false)"
          class="absolute top-1 right-1 z-50 text-tech-cyan opacity-50 hover:opacity-100"
        >
          <Minimize2 :size="16" />
        </button>

        <!-- Visualization of "Listening" -->
        <div class="mb-2 flex h-12 w-full shrink-0 items-center justify-center gap-1 border-b border-white/10">
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
        <div class="chat-scroll-area flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 pb-3 scrollbar-thin">
          <div v-if="!hasContext" class="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-100">
            {{ props.emptyHint || '当前未选中具体资产，AI 只能基于全局上下文回答。' }}
          </div>
          <div v-if="suggestionItems.length" class="flex flex-wrap gap-2">
            <button
              v-for="item in suggestionItems"
              :key="item"
              type="button"
              class="rounded-full border border-tech-cyan/30 bg-white/5 px-3 py-1 text-[11px] text-tech-cyan transition-colors hover:border-tech-cyan hover:text-white"
              @click="handleSuggestion(item)"
            >
              {{ item }}
            </button>
          </div>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
          >
            <div
              :class="[
                'max-w-[88%] rounded-xl p-3 text-xs font-mono leading-relaxed shadow-[0_8px_24px_rgba(2,6,23,0.18)]',
                msg.role === 'user'
                  ? 'border border-tech-blue/30 bg-slate-900/92 text-white'
                  : 'border border-white/10 bg-slate-950/94 text-gray-300'
              ]"
            >
              <template v-if="msg.role === 'model' && msg.parsedPayload">
                <div class="space-y-3">
                  <div v-if="readString(msg.parsedPayload.answer)" class="text-[13px] leading-6 text-slate-100">
                    {{ readString(msg.parsedPayload.answer) }}
                  </div>

                  <div v-if="readStringArray(msg.parsedPayload.confirmedFacts).length" class="space-y-1">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">已确认事实</div>
                    <ul class="space-y-1 text-[12px] text-slate-200">
                      <li v-for="item in readStringArray(msg.parsedPayload.confirmedFacts)" :key="item">• {{ item }}</li>
                    </ul>
                  </div>

                  <div v-if="readStringArray(msg.parsedPayload.inferences).length" class="space-y-1">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-amber-300/80">推断建议</div>
                    <ul class="space-y-1 text-[12px] text-slate-200">
                      <li v-for="item in readStringArray(msg.parsedPayload.inferences)" :key="item">• {{ item }}</li>
                    </ul>
                  </div>

                  <div v-if="readStringArray(msg.parsedPayload.missingInfo).length" class="space-y-1">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-rose-300/80">缺失信息</div>
                    <ul class="space-y-1 text-[12px] text-slate-200">
                      <li v-for="item in readStringArray(msg.parsedPayload.missingInfo)" :key="item">• {{ item }}</li>
                    </ul>
                  </div>

                  <div v-if="readStringArray(msg.parsedPayload.nextSteps).length" class="space-y-1">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">下一步动作</div>
                    <ul class="space-y-1 text-[12px] text-slate-200">
                      <li v-for="item in readStringArray(msg.parsedPayload.nextSteps)" :key="item">• {{ item }}</li>
                    </ul>
                  </div>

                  <div v-if="readSourceSummary(msg.parsedPayload.sourceSummary).length" class="space-y-1">
                    <div class="text-[11px] uppercase tracking-[0.18em] text-sky-300/80">数据来源</div>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="item in readSourceSummary(msg.parsedPayload.sourceSummary)"
                        :key="item"
                        class="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-slate-300"
                      >
                        {{ item }}
                      </span>
                    </div>
                  </div>

                  <div v-if="modelActionsOf(msg).length" class="flex flex-wrap gap-2 pt-1">
                    <button
                      v-for="action in modelActionsOf(msg)"
                      :key="`${action.type}:${action.label}`"
                      type="button"
                      class="rounded-lg border border-tech-cyan/30 bg-tech-cyan/10 px-3 py-2 text-[12px] text-tech-cyan transition-colors hover:border-tech-cyan hover:text-white"
                      @click="handleAction(action)"
                    >
                      {{ action.label }}
                    </button>
                  </div>
                </div>
              </template>
              <span v-else-if="msg.text">{{ msg.text }}</span>
              <span v-else-if="msg.isLoading" class="animate-pulse">_数据处理中...</span>
            </div>
          </div>
          <div ref="messagesEndRef" />
        </div>

        <!-- Input -->
        <div class="mt-3 shrink-0 border-t border-white/10 bg-[#040912] pt-3">
          <div class="relative rounded-xl bg-[#040912]">
            <textarea
              v-model="input"
              rows="2"
              @keydown="handleInputKeydown"
              placeholder="输入指令 / 查询..."
              class="chat-input w-full resize-none rounded-lg border border-tech-cyan/30 bg-[#020617] p-3 pr-10 text-sm font-mono text-white placeholder-gray-600 transition-all focus:outline-none focus:border-tech-cyan focus:shadow-[0_0_10px_rgba(0,242,255,0.2)]"
              autofocus
            />
            <button
              @click="handleSend"
              :disabled="isTyping || !input.trim()"
              class="absolute right-2 bottom-2 text-tech-cyan transition-colors hover:text-white disabled:opacity-30"
            >
              <Send :size="16" />
            </button>
          </div>
        </div>
      </div>
    </TechPanel>
  </div>
</template>

<script setup lang="ts">
import { Bot, Send, Minimize2 } from 'lucide-vue-next'
import type { ChatMessage } from '~/types'

type ChatAction = {
  type?: string
  label?: string
  payload?: Record<string, unknown>
}

type ResolvedChatAction = {
  type: string
  label: string
  payload?: Record<string, unknown>
}

const props = defineProps<{
  context?: Record<string, unknown> | null
  open?: boolean
  embedded?: boolean
  title?: string
  suggestions?: string[]
  emptyHint?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'action', value: ChatAction): void
}>()

const internalOpen = ref(false)
const input = ref('')
const messages = ref<ChatMessage[]>([
  { role: 'model', text: 'NOAH 已上线。全系统监控激活。请问有关地下管网的指令？' }
])
const isTyping = ref(false)
const messagesEndRef = ref<HTMLDivElement>()

const { streamChatResponse } = useGeminiChat()
const isControlled = computed(() => typeof props.open === 'boolean')
const isOpen = computed(() => (isControlled.value ? Boolean(props.open) : internalOpen.value))
const showLauncher = computed(() => !props.embedded && !isOpen.value)
const titleText = computed(() => props.title || 'AI 助手 // NOAH 核心')
const hasContext = computed(() => Boolean(props.context && Object.keys(props.context).length))
const suggestionItems = computed(() => props.suggestions || [
  '总结当前资产风险',
  '查看关联工单',
  '分析影响范围',
  '建议工单类型',
])
const wrapperClass = computed(() => {
  return props.embedded
    ? 'h-full w-full'
    : 'absolute right-4 bottom-4 z-40 w-96 transition-all duration-500 ease-in-out'
})

function setOpen(next: boolean) {
  if (!isControlled.value) {
    internalOpen.value = next
  }
  emit('update:open', next)
}

const scrollToBottom = () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

watch(messages, scrollToBottom, { deep: true })

function handleSuggestion(text: string) {
  if (isTyping.value) return
  input.value = text
  void handleSend()
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  void handleSend()
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .map(item => readString(item))
    .filter(Boolean)
}

function readSourceSummary(value: unknown) {
  if (!value || typeof value !== 'object') return [] as string[]
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== null && item !== undefined && String(item).trim() !== '')
    .map(([key, item]) => `${key}: ${String(item)}`)
}

function readActions(value: unknown) {
  if (!Array.isArray(value)) return [] as ResolvedChatAction[]
  return value
    .map<ResolvedChatAction | null>((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const type = readString(row.type)
      const label = readString(row.label)
      const payload = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : undefined
      if (!type || !label) return null
      return { type, label, payload }
    })
    .filter((item): item is ResolvedChatAction => Boolean(item))
}

function handleAction(action: ResolvedChatAction) {
  emit('action', action)
}

function modelActionsOf(msg: ChatMessage) {
  return readActions(msg.parsedPayload?.actions)
}

const handleSend = async () => {
  if (!input.value.trim() || isTyping.value) return

  const contextSnapshot = props.context && Object.keys(props.context).length ? props.context : undefined
  const userMsg: ChatMessage = { role: 'user', text: input.value, contextSnapshot }
  messages.value.push(userMsg)
  input.value = ''
  isTyping.value = true

  const modelMsgPlaceholder: ChatMessage = { role: 'model', text: '', isLoading: true }
  messages.value.push(modelMsgPlaceholder)

  let fullText = ''

  await streamChatResponse([...messages.value.slice(0, -1), userMsg], (chunk) => {
    if (chunk.text) {
      fullText += chunk.text
    }
    messages.value[messages.value.length - 1] = {
      role: 'model', 
      text: fullText, 
      isLoading: false,
      parsedPayload: chunk.parsedPayload || null,
    }
  }, contextSnapshot)

  isTyping.value = false
}
</script>

<style scoped>
.chat-input {
  color: #f8fafc;
  caret-color: #22d3ee;
  opacity: 1;
  appearance: none;
  -webkit-appearance: none;
  text-shadow: 0 0 0 #f8fafc;
  transform: translateZ(0);
}

.chat-input::placeholder {
  color: #6b7280;
}
</style>
