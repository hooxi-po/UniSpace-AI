import type { ChatMessage } from '~/types.ts'

export const useGeminiChat = () => {
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
