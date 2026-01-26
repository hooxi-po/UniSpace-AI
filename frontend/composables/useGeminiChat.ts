import type { ChatMessage } from '~/types.ts'

/**
 * Gemini AI 聊天功能的组合式函数
 * 提供流式聊天响应功能，支持实时接收 AI 回复
 */
export const useGeminiChat = () => {
  /**
   * 流式获取聊天响应
   * @param history - 聊天历史记录
   * @param onChunk - 接收到文本块时的回调函数
   * @throws 当 API 请求失败或响应体不可用时抛出错误
   */
  const streamChatResponse = async (
    history: ChatMessage[],
    onChunk: (text: string) => void
  ) => {
    try {
      const lastUserMsg = history[history.length - 1]
      if (lastUserMsg.role !== 'user') return

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: lastUserMsg.text,
          history: history.slice(0, -1)
        }),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                onChunk(parsed.text)
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Communication uplink failed:', error)
      onChunk('\n[!] 网络错误：与中央 AI 核心的连接中断。')
    }
  }

  return {
    streamChatResponse
  }
}
