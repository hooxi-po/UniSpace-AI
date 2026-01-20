<template>
  <Transition name="slide-right">
    <aside v-if="showRightSidebar" class="right-sidebar">
      <button class="collapse-btn" @click="toggleRightSidebar">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <div class="sidebar-header">
        <h3>智能决策与信息中心</h3>
      </div>
      <div class="sidebar-content">
        <section class="widget-section ai-section" :style="{ height: chatHeight + 'px' }">
          <div class="widget-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span>AI智能助手</span>
          </div>
          <div class="ai-assistant">
            <div class="chat-messages" ref="chatContainer">
              <div v-for="(msg, idx) in chatMessages" :key="idx" :class="['message', msg.role]">
                <div class="avatar">
                  <svg v-if="msg.role === 'user'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
                </div>
                <div class="content">{{ msg.content }}</div>
              </div>
              <div v-if="isTyping" class="message ai">
                <div class="avatar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg></div>
                <div class="content typing"><span></span><span></span><span></span></div>
              </div>
            </div>
            <div class="input-group">
              <input v-model="userInput" type="text" placeholder="请输入问题..." @keyup.enter="sendMessage">
              <button @click="sendMessage" :disabled="!userInput.trim()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
          <div class="resize-handle" @mousedown="startResize"><div class="handle-bar"></div></div>
        </section>
        <section class="widget-section">
          <div class="widget-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
            <span>实时监测</span>
          </div>
          <div class="details-content">
            <div class="charts">
              <div class="chart">
                <p>实时流量 <span class="value">{{ flowRate.toFixed(1) }} m³/h</span></p>
                <svg viewBox="0 0 110 50" class="chart-svg">
                  <text x="2" y="8" class="axis-label">40</text>
                  <text x="2" y="28" class="axis-label">25</text>
                  <text x="2" y="48" class="axis-label">10</text>
                  <line x1="15" y1="5" x2="108" y2="5" class="grid-line" />
                  <line x1="15" y1="25" x2="108" y2="25" class="grid-line" />
                  <line x1="15" y1="45" x2="108" y2="45" class="grid-line" />
                  <polyline fill="none" stroke="#00bfff" stroke-width="1.5" :points="flowChartPoints" />
                </svg>
              </div>
              <div class="chart">
                <p>水压监测 <span class="value">{{ realtimePressure.value.toFixed(2) }} MPa</span></p>
                <svg viewBox="0 0 110 50" class="chart-svg">
                  <text x="2" y="8" class="axis-label">0.6</text>
                  <text x="2" y="28" class="axis-label">0.4</text>
                  <text x="2" y="48" class="axis-label">0.2</text>
                  <line x1="15" y1="5" x2="108" y2="5" class="grid-line" />
                  <line x1="15" y1="25" x2="108" y2="25" class="grid-line" />
                  <line x1="15" y1="45" x2="108" y2="45" class="grid-line" />
                  <polyline fill="none" stroke="#00bfff" stroke-width="1.5" :points="pressureChartPoints" />
                </svg>
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  </Transition>
  <Transition name="fade">
    <button v-if="!showRightSidebar" class="expand-button right" @click="toggleRightSidebar">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMapState } from '../../composables/useMapState'
import PipeStatsChart from './charts/PipeStatsChart.vue'
import AlertList from './charts/AlertList.vue'

const { showRightSidebar, toggleRightSidebar, realtimePressure } = useMapState()

const userInput = ref('')
const isTyping = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const chatMessages = ref([
  { role: 'user', content: '地下供水管网泄漏如何处置?' },
  { role: 'ai', content: '建议：1. 立即关闭阀门V-102；2. 通知维修队前往抢修，确定具体爆管点。' }
])

const chatHeight = ref(280)
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = chatHeight.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  const delta = e.clientY - startY.value
  chatHeight.value = Math.min(Math.max(startHeight.value + delta, 150), 500)
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

const flowData = ref<number[]>([25, 28, 24, 30, 27, 32, 29, 35, 31, 28])
const pressureData = ref<number[]>([0.45, 0.48, 0.44, 0.46, 0.42, 0.47, 0.45, 0.43, 0.46, 0.44])
const flowRate = ref(28.5)

const flowChartPoints = computed(() => flowData.value.map((v, i) => `${18 + i * 10},${45 - (v - 10) * 1.33}`).join(' '))
const pressureChartPoints = computed(() => pressureData.value.map((v, i) => `${18 + i * 10},${45 - (v - 0.2) * 100}`).join(' '))

let dataInterval: ReturnType<typeof setInterval>
onMounted(() => {
  dataInterval = setInterval(() => {
    const newFlow = 25 + Math.random() * 15
    flowData.value = [...flowData.value.slice(1), newFlow]
    flowRate.value = newFlow
    const newPressure = 0.4 + Math.random() * 0.15
    pressureData.value = [...pressureData.value.slice(1), newPressure]
  }, 2000)
})
onUnmounted(() => clearInterval(dataInterval))

const aiResponses: Record<string, string> = {
  '泄漏': '检测到关键词"泄漏"。建议：1. 立即关闭最近阀门；2. 派遣维修人员；3. 启动应急预案。',
  '压力': '当前管网压力正常。建议持续监测。',
  '流量': '当前流量处于正常范围。',
  '报警': '系统当前无活跃报警。所有监测点运行正常。',
  'default': '收到您的问题，正在分析中...建议您提供更多细节以便给出准确建议。'
}

const sendMessage = async () => {
  const msg = userInput.value.trim()
  if (!msg) return
  chatMessages.value.push({ role: 'user', content: msg })
  userInput.value = ''
  isTyping.value = true
  await nextTick()
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  setTimeout(() => {
    let response = aiResponses['default']
    for (const key of Object.keys(aiResponses)) {
      if (msg.includes(key)) { response = aiResponses[key]; break }
    }
    chatMessages.value.push({ role: 'ai', content: response })
    isTyping.value = false
    nextTick(() => { if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight })
  }, 1000 + Math.random() * 500)
}
</script>

<style scoped>
.slide-right-enter-active, .slide-right-leave-active { transition: all 0.3s ease; }
.slide-right-enter-from, .slide-right-leave-to { opacity: 0; transform: translateX(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.expand-button { position: fixed; top: 50%; right: 20px; transform: translateY(-50%); background: rgba(10, 22, 41, 0.9); border: 1px solid rgba(0, 191, 255, 0.5); border-radius: 8px; color: #00bfff; padding: 12px; cursor: pointer; z-index: 1000; }
.expand-button:hover { background: rgba(0, 191, 255, 0.2); }
.right-sidebar { position: fixed; top: 0; right: 0; width: 25%; min-width: 320px; height: 100vh; background: rgba(10, 22, 41, 0.95); border-left: 1px solid rgba(0, 191, 255, 0.3); color: white; z-index: 999; backdrop-filter: blur(12px); display: flex; flex-direction: column; }
.collapse-btn { position: absolute; left: 0; top: 50%; transform: translate(-100%, -50%); background: rgba(10, 22, 41, 0.95); border: 1px solid rgba(0, 191, 255, 0.5); border-right: none; border-radius: 4px 0 0 4px; color: #00bfff; padding: 20px 6px; cursor: pointer; z-index: 1000; }
.collapse-btn:hover { background: rgba(0, 191, 255, 0.2); }
.sidebar-header { padding: 16px; border-bottom: 1px solid rgba(0, 191, 255, 0.2); text-align: center; padding-top: 30px; background: rgba(10, 22, 41, 0.8); }
.sidebar-header h3 { margin: 0; font-size: 20px; color: #fff; text-shadow: 0 0 5px rgba(0, 191, 255, 0.7); }
.sidebar-content { padding: 16px; overflow-y: auto; flex-grow: 1; }
.widget-section { background: rgba(15, 32, 58, 0.6); border: 1px solid rgba(0, 191, 255, 0.2); border-radius: 8px; margin-bottom: 16px; padding: 12px; }
.ai-section { display: flex; flex-direction: column; position: relative; min-height: 150px; max-height: 500px; }
.widget-header { display: flex; align-items: center; font-weight: bold; margin-bottom: 12px; color: #00bfff; font-size: 16px; }
.widget-header svg { margin-right: 10px; }
.ai-assistant { font-size: 14px; display: flex; flex-direction: column; flex: 1; min-height: 0; }
.chat-messages { flex: 1; overflow-y: auto; margin-bottom: 12px; min-height: 0; }
.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 2px; }
.chat-messages::-webkit-scrollbar-thumb { background: rgba(0, 191, 255, 0.4); border-radius: 2px; }
.message { display: flex; margin-bottom: 12px; }
.message.user { flex-direction: row-reverse; }
.message .avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.message.user .avatar { background: #007bff; margin-left: 8px; }
.message.ai .avatar { background: #333; margin-right: 8px; }
.message .content { padding: 10px 14px; border-radius: 12px; max-width: 80%; }
.message.user .content { background: #007bff; border-radius: 12px 12px 0 12px; }
.message.ai .content { background: rgba(0, 0, 0, 0.3); border-radius: 12px 12px 12px 0; }
.typing { display: flex; gap: 4px; padding: 12px 16px !important; }
.typing span { width: 8px; height: 8px; background: #00bfff; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
.typing span:nth-child(1) { animation-delay: -0.32s; }
.typing span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
.input-group { display: flex; border: 1px solid rgba(0, 191, 255, 0.4); border-radius: 20px; background: #0a1629; flex-shrink: 0; }
.input-group input { flex-grow: 1; background: transparent; border: none; color: white; padding: 10px 15px; outline: none; }
.input-group button { background: #007bff; border: none; color: white; padding: 0 15px; border-radius: 0 20px 20px 0; cursor: pointer; display: flex; align-items: center; }
.input-group button:disabled { opacity: 0.5; cursor: not-allowed; }
.resize-handle { position: absolute; bottom: 0; left: 0; right: 0; height: 8px; cursor: ns-resize; display: flex; justify-content: center; align-items: center; }
.handle-bar { width: 40px; height: 3px; background: rgba(0, 191, 255, 0.4); border-radius: 2px; }
.resize-handle:hover .handle-bar { background: rgba(0, 191, 255, 0.8); }
.details-content { padding: 8px; }
.charts { display: flex; flex-direction: column; gap: 16px; }
.chart { text-align: center; }
.chart p { margin: 0 0 8px; font-size: 13px; color: #ccc; text-align: left; display: flex; justify-content: space-between; }
.chart .value { color: #00bfff; font-weight: bold; }
.chart-svg { width: 100%; height: 50px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
.axis-label { font-size: 6px; fill: #888; }
.grid-line { stroke: rgba(255, 255, 255, 0.1); stroke-width: 0.5; stroke-dasharray: 2, 2; }
</style>
