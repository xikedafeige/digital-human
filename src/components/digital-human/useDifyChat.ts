import { ref } from 'vue'
import { buildDifyStopMessageUrl, DIGITAL_HUMAN_RUNTIME_CONFIG } from './runtime-config'

const DIFY_USER_STORAGE_KEY = 'digital-human:dify-user'

const createAbortError = () => new DOMException('Dify chat aborted', 'AbortError')

interface DifyStreamPayload {
  event?: string
  answer?: string
  task_id?: string
  conversation_id?: string
  message_id?: string
  message?: string
  error?: string
  [key: string]: unknown
}

interface DifyChatHandlers {
  onText?: (text: string, chunk: string) => void
  onConversationId?: (conversationId: string) => void
  onTaskId?: (taskId: string) => void
}

interface DifyChatOptions extends DifyChatHandlers {
  conversationId?: string
  signal?: AbortSignal
}

export interface DifyChatResult {
  text: string
  conversationId: string
  taskId: string
  messageId: string
}

const buildSessionUserId = () => {
  const prefix = DIGITAL_HUMAN_RUNTIME_CONFIG.difyUserPrefix

  if (typeof window === 'undefined') {
    return `${prefix}-server`
  }

  try {
    const storedUserId = window.sessionStorage.getItem(DIFY_USER_STORAGE_KEY)
    if (storedUserId) {
      return storedUserId
    }

    const generatedUserId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `${prefix}-${crypto.randomUUID()}`
        : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    window.sessionStorage.setItem(DIFY_USER_STORAGE_KEY, generatedUserId)
    return generatedUserId
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

const extractSseMessages = (buffer: string) => {
  const normalizedBuffer = buffer.replace(/\r\n/g, '\n')
  const chunks = normalizedBuffer.split('\n\n')
  const pendingBuffer = chunks.pop() ?? ''
  const events: string[] = []

  chunks.forEach((chunk) => {
    const dataLines = chunk
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())

    const payload = dataLines.join('\n').trim()
    if (payload) {
      events.push(payload)
    }
  })

  return {
    events,
    pendingBuffer,
  }
}

export function useDifyChat() {
  const errorMessage = ref('')
  const isStreaming = ref(false)

  const run = async (question: string, options: DifyChatOptions = {}): Promise<DifyChatResult> => {
    const normalizedQuestion = question.trim()

    if (!normalizedQuestion) {
      throw new Error('Dify question is empty')
    }

    if (!DIGITAL_HUMAN_RUNTIME_CONFIG.difyApiKey) {
      throw new Error('Missing Dify API key')
    }

    if (options.signal?.aborted) {
      throw createAbortError()
    }

    const userId = buildSessionUserId()
    const requestController = new AbortController()
    let timeoutId: number | null = null
    let didTimeout = false

    const handleAbort = () => requestController.abort()
    options.signal?.addEventListener('abort', handleAbort, { once: true })

    isStreaming.value = true
    errorMessage.value = ''

    if (DIGITAL_HUMAN_RUNTIME_CONFIG.difyTimeoutMs > 0) {
      timeoutId = window.setTimeout(() => {
        didTimeout = true
        requestController.abort()
      }, DIGITAL_HUMAN_RUNTIME_CONFIG.difyTimeoutMs)
    }

    let accumulatedText = ''
    let latestConversationId = options.conversationId?.trim() ?? ''
    let latestTaskId = ''
    let latestMessageId = ''

    try {
      const requestBody: Record<string, unknown> = {
        query: normalizedQuestion,
        inputs: {},
        user: userId,
        response_mode: 'streaming',
      }

      if (latestConversationId) {
        requestBody.conversation_id = latestConversationId
      }

      const response = await fetch(DIGITAL_HUMAN_RUNTIME_CONFIG.difyChatMessagesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DIGITAL_HUMAN_RUNTIME_CONFIG.difyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: requestController.signal,
      })

      if (!response.ok) {
        const responseText = await response.text().catch(() => '')
        throw new Error(responseText || `HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Dify streaming response is empty')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const applyPayload = (payload: DifyStreamPayload) => {
        if (typeof payload.task_id === 'string' && payload.task_id) {
          latestTaskId = payload.task_id
          options.onTaskId?.(payload.task_id)
        }

        if (typeof payload.conversation_id === 'string' && payload.conversation_id) {
          latestConversationId = payload.conversation_id
          options.onConversationId?.(payload.conversation_id)
        }

        if (typeof payload.message_id === 'string' && payload.message_id) {
          latestMessageId = payload.message_id
        }

        const eventType = typeof payload.event === 'string' ? payload.event : ''

        if (eventType === 'error') {
          throw new Error(payload.message || payload.error || 'Dify chat returned an error')
        }

        if (eventType === 'message_replace' && typeof payload.answer === 'string') {
          accumulatedText = payload.answer
          options.onText?.(accumulatedText, payload.answer)
          return
        }

        if ((eventType === 'message' || eventType === 'agent_message') && typeof payload.answer === 'string') {
          accumulatedText += payload.answer
          options.onText?.(accumulatedText, payload.answer)
          return
        }

        if (eventType === 'message_end' && !accumulatedText && typeof payload.answer === 'string') {
          accumulatedText = payload.answer
          options.onText?.(accumulatedText, payload.answer)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        const { events, pendingBuffer } = extractSseMessages(buffer)
        buffer = pendingBuffer

        events.forEach((rawEvent) => {
          if (rawEvent === '[DONE]' || rawEvent === 'ping') {
            return
          }

          let payload: DifyStreamPayload
          try {
            payload = JSON.parse(rawEvent) as DifyStreamPayload
          } catch {
            return
          }

          applyPayload(payload)
        })
      }

      buffer += decoder.decode()

      const { events } = extractSseMessages(`${buffer}\n\n`)
      events.forEach((rawEvent) => {
        if (rawEvent === '[DONE]' || rawEvent === 'ping') {
          return
        }

        let payload: DifyStreamPayload
        try {
          payload = JSON.parse(rawEvent) as DifyStreamPayload
        } catch {
          return
        }

        applyPayload(payload)
      })

      const finalText = accumulatedText.trim()
      if (!finalText) {
        throw new Error('Dify chat returned an empty answer')
      }

      return {
        text: finalText,
        conversationId: latestConversationId,
        taskId: latestTaskId,
        messageId: latestMessageId,
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        errorMessage.value = didTimeout
          ? 'Dify chat request timed out'
          : error instanceof Error
            ? error.message
            : String(error)
      }

      if (didTimeout) {
        throw new Error('Dify chat request timed out')
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw createAbortError()
      }

      throw error
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }

      options.signal?.removeEventListener('abort', handleAbort)
      isStreaming.value = false
    }
  }

  const stop = async (taskId: string) => {
    if (!taskId || !DIGITAL_HUMAN_RUNTIME_CONFIG.difyApiKey) {
      return
    }

    try {
      await fetch(buildDifyStopMessageUrl(taskId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DIGITAL_HUMAN_RUNTIME_CONFIG.difyApiKey}`,
          'Content-Type': 'application/json',
        },
        // The stop API must receive the same user identifier as the chat request.
        body: JSON.stringify({
          user: buildSessionUserId(),
        }),
      })
    } catch {
      // Ignore stop errors so local cancellation still succeeds.
    }
  }

  return {
    errorMessage,
    isStreaming,
    run,
    stop,
  }
}
