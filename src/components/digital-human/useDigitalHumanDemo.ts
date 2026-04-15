import { computed, onBeforeUnmount, ref } from 'vue'
import {
  buildDemoReply,
  DIGITAL_HUMAN_SUGGESTIONS,
  RESPONSE_TIMING,
  SYSTEM_WELCOME,
  VOICE_PROMPTS,
  type DemoMessage,
  type DigitalHumanStatus
} from './demo-config'

const createMessage = (role: DemoMessage['role'], content: string): DemoMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  timestamp: Date.now()
})

export function useDigitalHumanDemo() {
  const isExpanded = ref(false)
  const inputText = ref('')
  const isRecording = ref(false)
  const status = ref<DigitalHumanStatus>('idle')
  const messages = ref<DemoMessage[]>([createMessage('system', SYSTEM_WELCOME)])

  const suggestions = computed(() => DIGITAL_HUMAN_SUGGESTIONS)
  const hasInput = computed(() => inputText.value.trim().length > 0)
  const isBusy = computed(() => status.value === 'thinking' || status.value === 'speaking')
  const latestAssistantText = computed(() => {
    const latestAssistantMessage = [...messages.value]
      .reverse()
      .find((message) => message.role === 'assistant' || message.role === 'system')

    return latestAssistantMessage?.content ?? SYSTEM_WELCOME
  })

  let voicePromptIndex = 0
  let activeTypingMessageId: string | null = null
  let activeTypingFullText = ''
  let flowTimers: number[] = []

  const clearFlowTimers = () => {
    flowTimers.forEach((timer) => window.clearTimeout(timer))
    flowTimers = []
  }

  const queueTimeout = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      flowTimers = flowTimers.filter((item) => item !== timer)
      callback()
    }, delay)

    flowTimers.push(timer)
  }

  const flushTypingMessage = () => {
    if (!activeTypingMessageId || !activeTypingFullText) {
      return
    }

    const targetMessage = messages.value.find((message) => message.id === activeTypingMessageId)
    if (targetMessage) {
      targetMessage.content = activeTypingFullText
    }

    activeTypingMessageId = null
    activeTypingFullText = ''
  }

  const resetToWelcome = () => {
    messages.value = [createMessage('system', SYSTEM_WELCOME)]
    inputText.value = ''
    isRecording.value = false
    status.value = 'idle'
  }

  const typeReply = (messageId: string, fullReply: string) => {
    activeTypingMessageId = messageId
    activeTypingFullText = fullReply

    let index = 0

    const tick = () => {
      const targetMessage = messages.value.find((message) => message.id === messageId)
      if (!targetMessage) {
        return
      }

      index += 1
      targetMessage.content = fullReply.slice(0, index)

      if (index < fullReply.length) {
        queueTimeout(tick, RESPONSE_TIMING.typingIntervalMs)
        return
      }

      activeTypingMessageId = null
      activeTypingFullText = ''

      queueTimeout(() => {
        status.value = 'idle'
      }, RESPONSE_TIMING.speakingTailMs)
    }

    tick()
  }

  const runReplyFlow = (question: string) => {
    const reply = buildDemoReply(question)

    status.value = 'thinking'

    queueTimeout(() => {
      const assistantMessage = createMessage('assistant', '')
      messages.value.push(assistantMessage)
      status.value = 'speaking'
      typeReply(assistantMessage.id, reply)
    }, RESPONSE_TIMING.thinkingMs)
  }

  const cancelCurrentFlow = () => {
    clearFlowTimers()
    flushTypingMessage()
    isRecording.value = false
    status.value = 'idle'
  }

  const sendText = (rawText: string) => {
    const question = rawText.trim()
    if (!question) {
      return
    }

    if (isBusy.value || isRecording.value) {
      cancelCurrentFlow()
    }

    isExpanded.value = true
    messages.value.push(createMessage('user', question))
    inputText.value = ''
    runReplyFlow(question)
  }

  const submitInput = () => {
    sendText(inputText.value)
  }

  const startVoiceInput = () => {
    if (isBusy.value || isRecording.value) {
      return
    }

    isExpanded.value = true
    clearFlowTimers()
    isRecording.value = true
    status.value = 'listening'
  }

  const stopVoiceInput = () => {
    if (!isRecording.value) {
      return
    }

    isRecording.value = false
    const prompt = VOICE_PROMPTS[voicePromptIndex % VOICE_PROMPTS.length]
    voicePromptIndex += 1
    sendText(prompt)
  }

  const expand = () => {
    isExpanded.value = true
  }

  const collapse = () => {
    cancelCurrentFlow()
    isExpanded.value = false
  }

  const clearConversation = () => {
    cancelCurrentFlow()
    resetToWelcome()
  }

  onBeforeUnmount(() => {
    clearFlowTimers()
    flushTypingMessage()
  })

  return {
    clearConversation,
    collapse,
    expand,
    hasInput,
    inputText,
    isBusy,
    isExpanded,
    isRecording,
    latestAssistantText,
    messages,
    sendText,
    startVoiceInput,
    status,
    stopVoiceInput,
    submitInput,
    suggestions
  }
}
