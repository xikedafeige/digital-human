import { computed, onBeforeUnmount, ref } from 'vue'
import {
  buildDemoReply,
  buildMockSpeechResult,
  DIGITAL_HUMAN_SUGGESTIONS,
  RESPONSE_TIMING,
  SYSTEM_WELCOME,
  VOICE_PROMPTS,
} from './demo-config'
import type { AvatarState, DemoMessage, SpeechSynthesisResult } from './avatar-types'

const createMessage = (
  role: DemoMessage['role'],
  content: string,
  options: Partial<Pick<DemoMessage, 'pending' | 'source'>> = {}
): DemoMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  timestamp: Date.now(),
  pending: options.pending ?? false,
  source: options.source ?? (role === 'system' ? 'system' : 'text'),
})

export function useDigitalHumanDemo() {
  const isExpanded = ref(false)
  const inputText = ref('')
  const isRecording = ref(false)
  const status = ref<AvatarState>('idle')
  const messages = ref<DemoMessage[]>([createMessage('system', SYSTEM_WELCOME, { source: 'system' })])
  const speechResult = ref<SpeechSynthesisResult | null>(null)
  const speechToken = ref(0)

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
    if (!targetMessage) {
      activeTypingMessageId = null
      activeTypingFullText = ''
      return
    }

    targetMessage.content = activeTypingFullText
    targetMessage.pending = false
    activeTypingMessageId = null
    activeTypingFullText = ''
  }

  const resetToWelcome = () => {
    messages.value = [createMessage('system', SYSTEM_WELCOME, { source: 'system' })]
    inputText.value = ''
    isRecording.value = false
    status.value = 'idle'
    speechResult.value = null
  }

  const typeReply = (messageId: string, fullReply: string, durationMs: number) => {
    activeTypingMessageId = messageId
    activeTypingFullText = fullReply

    let index = 0
    const intervalMs = Math.max(
      16,
      Math.floor(Math.max(RESPONSE_TIMING.typingIntervalMs, durationMs / Math.max(fullReply.length, 1)))
    )

    const tick = () => {
      const targetMessage = messages.value.find((message) => message.id === messageId)
      if (!targetMessage) {
        activeTypingMessageId = null
        activeTypingFullText = ''
        return
      }

      index += 1
      targetMessage.content = fullReply.slice(0, index)
      targetMessage.pending = false

      if (index < fullReply.length) {
        queueTimeout(tick, intervalMs)
        return
      }

      activeTypingMessageId = null
      activeTypingFullText = ''
      targetMessage.content = fullReply
      targetMessage.pending = false
    }

    tick()
  }

  const cancelCurrentFlow = () => {
    clearFlowTimers()
    flushTypingMessage()
    isRecording.value = false
    speechResult.value = null
    status.value = 'idle'
  }

  const runReplyFlow = (question: string, source: DemoMessage['source']) => {
    const reply = buildDemoReply(question)
    const assistantMessage = createMessage('assistant', '正在思考中...', {
      pending: true,
      source,
    })

    messages.value.push(assistantMessage)
    status.value = 'thinking'

    queueTimeout(() => {
      const synthesized = buildMockSpeechResult(reply)
      speechResult.value = synthesized
      speechToken.value += 1
      status.value = 'speaking'
      typeReply(assistantMessage.id, reply, synthesized.durationMs)
    }, RESPONSE_TIMING.thinkingMs)
  }

  const sendText = (rawText: string, source: DemoMessage['source'] = 'text') => {
    const question = rawText.trim()
    if (!question) {
      return
    }

    if (isBusy.value || isRecording.value) {
      cancelCurrentFlow()
    }

    isExpanded.value = true
    messages.value.push(createMessage('user', question, { source }))
    inputText.value = ''
    runReplyFlow(question, source)
  }

  const submitInput = () => {
    sendText(inputText.value, 'text')
  }

  const startVoiceInput = () => {
    if (isRecording.value) {
      return
    }

    if (isBusy.value) {
      cancelCurrentFlow()
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
    status.value = 'idle'
    const prompt = VOICE_PROMPTS[voicePromptIndex % VOICE_PROMPTS.length]
    voicePromptIndex += 1
    sendText(prompt, 'voice')
  }

  const handleSpeechComplete = () => {
    clearFlowTimers()
    speechResult.value = null
    queueTimeout(() => {
      status.value = 'idle'
    }, RESPONSE_TIMING.speakingTailMs)
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
    handleSpeechComplete,
    hasInput,
    inputText,
    isBusy,
    isExpanded,
    isRecording,
    latestAssistantText,
    messages,
    sendText,
    speechResult,
    speechToken,
    startVoiceInput,
    status,
    stopVoiceInput,
    submitInput,
    suggestions,
  }
}
