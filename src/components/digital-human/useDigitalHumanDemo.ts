import { computed, onBeforeUnmount, ref } from 'vue'
import {
  buildDemoReply,
  buildMockSpeechResult,
  DIGITAL_HUMAN_SUGGESTIONS,
  RESPONSE_TIMING,
  SYSTEM_WELCOME,
} from './demo-config'
import type { AvatarState, DemoMessage, SpeechSynthesisResult } from './avatar-types'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useSpeechSynthesis } from './useSpeechSynthesis'

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

  let activeFlowId = 0
  let activeTypingMessageId: string | null = null
  let flowTimers: number[] = []
  let activeReplyFlowId = 0
  let typingCompleted = false
  let speechCompleted = false
  let activeTtsController: AbortController | null = null
  const speechRecognition = useSpeechRecognition({
    onPartial: (text) => {
      inputText.value = text
    },
    onSegment: (text) => {
      inputText.value = text
    },
    onError: () => {},
  })
  const speechSynthesisClient = useSpeechSynthesis()

  const setSpeechResult = (nextSpeechResult: SpeechSynthesisResult | null) => {
    if (speechResult.value && speechResult.value.audioUrl !== nextSpeechResult?.audioUrl) {
      speechSynthesisClient.revoke(speechResult.value)
    }

    speechResult.value = nextSpeechResult
  }

  const cancelPendingSpeechSynthesis = () => {
    if (!activeTtsController) {
      return
    }

    activeTtsController.abort()
    activeTtsController = null
  }

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

  const stopTypingMessage = () => {
    if (!activeTypingMessageId) {
      return
    }

    const targetMessage = messages.value.find((message) => message.id === activeTypingMessageId)
    if (targetMessage) {
      targetMessage.pending = false
    }

    activeTypingMessageId = null
  }

  const clearActiveReplyState = () => {
    activeReplyFlowId = 0
    typingCompleted = false
    speechCompleted = false
  }

  const resetToWelcome = () => {
    messages.value = [createMessage('system', SYSTEM_WELCOME, { source: 'system' })]
    inputText.value = ''
    isRecording.value = false
    status.value = 'idle'
    cancelPendingSpeechSynthesis()
    setSpeechResult(null)
    clearActiveReplyState()
  }

  const scheduleIdleTransition = (flowId: number) => {
    queueTimeout(() => {
      if (flowId !== activeFlowId || activeReplyFlowId !== flowId) {
        return
      }

      status.value = 'idle'
      setSpeechResult(null)
      clearActiveReplyState()
    }, RESPONSE_TIMING.speakingTailMs)
  }

  const tryFinishReplyFlow = (flowId: number) => {
    if (flowId !== activeFlowId || activeReplyFlowId !== flowId) {
      return
    }

    if (!typingCompleted || !speechCompleted) {
      return
    }

    scheduleIdleTransition(flowId)
  }

  const typeReply = (flowId: number, messageId: string, fullReply: string, durationMs: number) => {
    activeTypingMessageId = messageId
    activeReplyFlowId = flowId
    typingCompleted = false

    let index = 0
    const intervalMs = Math.max(
      16,
      Math.floor(Math.max(RESPONSE_TIMING.typingIntervalMs, durationMs / Math.max(fullReply.length, 1)))
    )

    const tick = () => {
      if (flowId !== activeFlowId) {
        return
      }

      const targetMessage = messages.value.find((message) => message.id === messageId)
      if (!targetMessage) {
        activeTypingMessageId = null
        return
      }

      index += 1
      targetMessage.content = fullReply.slice(0, index)
      targetMessage.pending = index < fullReply.length

      if (index < fullReply.length) {
        queueTimeout(tick, intervalMs)
        return
      }

      activeTypingMessageId = null
      targetMessage.content = fullReply
      targetMessage.pending = false
      typingCompleted = true
      tryFinishReplyFlow(flowId)
    }

    tick()
  }

  const cancelCurrentFlow = () => {
    activeFlowId += 1
    clearFlowTimers()
    stopTypingMessage()
    clearActiveReplyState()
    cancelPendingSpeechSynthesis()
    isRecording.value = false
    setSpeechResult(null)
    status.value = 'idle'
  }

  const runReplyFlow = (question: string, source: DemoMessage['source']) => {
    const reply = buildDemoReply(question)
    const assistantMessage = createMessage('assistant', '正在思考中...', {
      pending: true,
      source,
    })
    const flowId = activeFlowId + 1

    activeFlowId = flowId
    clearActiveReplyState()
    messages.value.push(assistantMessage)
    status.value = 'thinking'

    queueTimeout(async () => {
      if (flowId !== activeFlowId) {
        return
      }

      cancelPendingSpeechSynthesis()

      const ttsController = new AbortController()
      activeTtsController = ttsController

      let synthesized: SpeechSynthesisResult

      try {
        synthesized = await speechSynthesisClient.synthesize(reply, {
          signal: ttsController.signal,
        })
      } catch {
        if (activeTtsController === ttsController) {
          activeTtsController = null
        }

        if (ttsController.signal.aborted || flowId !== activeFlowId) {
          return
        }

        synthesized = buildMockSpeechResult(reply)
      }

      if (activeTtsController === ttsController) {
        activeTtsController = null
      }

      if (flowId !== activeFlowId) {
        speechSynthesisClient.revoke(synthesized)
        return
      }

      setSpeechResult(synthesized)
      speechToken.value += 1
      status.value = 'speaking'
      speechCompleted = false
      typeReply(flowId, assistantMessage.id, reply, synthesized.durationMs)
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

  const startVoiceInput = async () => {
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
    inputText.value = ''

    try {
      await speechRecognition.start()
    } catch {
      isRecording.value = false
      status.value = 'idle'
    }
  }

  const stopVoiceInput = async () => {
    if (!isRecording.value) {
      return
    }

    isRecording.value = false
    status.value = 'idle'

    const recognizedText = await speechRecognition.stop()
    const fallbackText = inputText.value.trim()
    const question = recognizedText || fallbackText

    if (question) {
      sendText(question, 'voice')
      return
    }

    inputText.value = ''
  }

  const handleSpeechComplete = () => {
    if (status.value !== 'speaking' || activeReplyFlowId !== activeFlowId) {
      setSpeechResult(null)
      return
    }

    speechCompleted = true
    tryFinishReplyFlow(activeFlowId)
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
    stopTypingMessage()
    cancelPendingSpeechSynthesis()
    setSpeechResult(null)
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
