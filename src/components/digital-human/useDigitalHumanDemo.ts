import { computed, onBeforeUnmount, ref } from 'vue'
import {
  buildDemoReply,
  buildMockSpeechResult,
  DIGITAL_HUMAN_SUGGESTIONS,
  RESPONSE_TIMING,
  SYSTEM_WELCOME,
} from './demo-config'
import type {
  AvatarState,
  DemoMessage,
  SpeechSynthesisResult,
} from './avatar-types'
import { markdownToPlainText, type ParsedReplyContent } from './message-content'
import { useDifyChat } from './useDifyChat'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useSpeechSynthesis } from './useSpeechSynthesis'

const THINKING_PLACEHOLDER = '思考中...'
type SpeechSegmentKind = 'lead' | 'tail'

const LEAD_SPEECH_MIN_CHARS = 100
const WHITESPACE_RE = /\s/

const buildFallbackReplyText = (question: string) =>
  `当前服务暂时不可用，先为你提供本地演示回复。\n\n${buildDemoReply(question)}`

const normalizeSpeechText = (value: string) => value.replace(/\r\n/g, '\n').trim()

const getLeadSpeechEndIndex = (value: string) => {
  const normalizedValue = normalizeSpeechText(value)

  if (!normalizedValue) {
    return -1
  }

  let effectiveCharCount = 0

  for (let index = 0; index < normalizedValue.length; index += 1) {
    if (WHITESPACE_RE.test(normalizedValue[index])) {
      continue
    }

    effectiveCharCount += 1

    if (effectiveCharCount >= LEAD_SPEECH_MIN_CHARS) {
      return index + 1
    }
  }

  return -1
}

const getTailSpeechText = (value: string, startIndex: number) =>
  normalizeSpeechText(startIndex > -1 ? value.slice(startIndex) : value)

const createMessage = (
  role: DemoMessage['role'],
  content: string,
  options: Partial<
    Pick<
      DemoMessage,
      | 'pending'
      | 'source'
      | 'engine'
      | 'conversationId'
      | 'thinkContent'
      | 'thinkCollapsed'
      | 'renderMode'
    >
  > = {},
): DemoMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  timestamp: Date.now(),
  pending: options.pending ?? false,
  source: options.source ?? (role === 'system' ? 'system' : 'text'),
  engine: options.engine,
  conversationId: options.conversationId,
  thinkContent: options.thinkContent,
  thinkCollapsed: options.thinkCollapsed ?? true,
  renderMode: options.renderMode ?? (role === 'user' ? 'plain' : 'markdown'),
})

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

export function useDigitalHumanDemo() {
  const isExpanded = ref(false)
  const inputText = ref('')
  const isRecording = ref(false)
  const isAwaitingVoiceRecognitionResult = ref(false)
  const showVoiceInterruptButton = ref(false)
  const status = ref<AvatarState>('idle')
  const messages = ref<DemoMessage[]>([
    createMessage('system', SYSTEM_WELCOME, {
      source: 'system',
      renderMode: 'markdown',
    }),
  ])
  const speechResult = ref<SpeechSynthesisResult | null>(null)
  const speechToken = ref(0)
  const conversationId = ref('')

  const suggestions = computed(() => DIGITAL_HUMAN_SUGGESTIONS)
  const hasInput = computed(() => inputText.value.trim().length > 0)
  const isBusy = computed(
    () => status.value === 'thinking' || status.value === 'speaking',
  )
  const latestAssistantText = computed(() => {
    const latestAssistantMessage = [...messages.value]
      .reverse()
      .find(
        (message) => message.role === 'assistant' || message.role === 'system',
      )

    return latestAssistantMessage?.content ?? SYSTEM_WELCOME
  })

  let activeFlowId = 0
  let activeSpeakingFlowId = 0
  let activeVoiceStopId = 0
  let currentAssistantMessageId = ''
  let flowTimers: number[] = []
  let activeTtsController: AbortController | null = null
  let activeDifyController: AbortController | null = null
  let activeDifyTaskId = ''
  let activeSpeechSegment: SpeechSegmentKind | null = null
  let flowStreamCompleted = false
  let leadSpeechStarted = false
  let leadSpeechCompleted = false
  let tailSpeechStarted = false
  let leadSpeechEndIndex = -1
  let latestSpeechText = ''

  const difyChatClient = useDifyChat()
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

  const getMessageById = (messageId: string) =>
    messages.value.find((message) => message.id === messageId) ?? null

  const getMessageEngine = (
    messageId: string,
    fallbackEngine: DemoMessage['engine'],
  ) => getMessageById(messageId)?.engine ?? fallbackEngine

  const clearVoiceInterruptState = () => {
    showVoiceInterruptButton.value = false
    isAwaitingVoiceRecognitionResult.value = false
  }

  const clearSpeechProgress = () => {
    activeSpeakingFlowId = 0
    currentAssistantMessageId = ''
    activeSpeechSegment = null
    flowStreamCompleted = false
    leadSpeechStarted = false
    leadSpeechCompleted = false
    tailSpeechStarted = false
    leadSpeechEndIndex = -1
    latestSpeechText = ''
  }

  const setSpeechResult = (nextSpeechResult: SpeechSynthesisResult | null) => {
    if (
      speechResult.value &&
      speechResult.value.audioUrl !== nextSpeechResult?.audioUrl
    ) {
      speechSynthesisClient.revoke(speechResult.value)
    }

    speechResult.value = nextSpeechResult
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

  const cancelPendingSpeechSynthesis = () => {
    if (!activeTtsController) {
      return
    }

    activeTtsController.abort()
    activeTtsController = null
  }

  const cancelPendingDify = () => {
    const taskId = activeDifyTaskId

    if (activeDifyController) {
      activeDifyController.abort()
      activeDifyController = null
    }

    activeDifyTaskId = ''

    if (taskId) {
      void difyChatClient.stop(taskId)
    }
  }

  const settlePendingMessages = () => {
    messages.value.forEach((message) => {
      if (message.pending) {
        message.pending = false
      }
    })
  }

  const finishFlowNow = (flowId: number) => {
    if (flowId !== activeFlowId) {
      return
    }

    status.value = 'idle'
    clearVoiceInterruptState()
    setSpeechResult(null)
    clearSpeechProgress()
  }

  const scheduleIdleTransition = (flowId: number) => {
    queueTimeout(() => {
      if (flowId !== activeFlowId || activeSpeakingFlowId !== flowId) {
        return
      }

      finishFlowNow(flowId)
    }, RESPONSE_TIMING.speakingTailMs)
  }

  const updateAssistantMessage = (
    messageId: string,
    content: ParsedReplyContent,
    options: Pick<DemoMessage, 'pending' | 'engine'> &
      Partial<Pick<DemoMessage, 'conversationId'>>,
  ) => {
    const targetMessage = getMessageById(messageId)
    if (!targetMessage) {
      return
    }

    const nextBodyContent =
      content.bodyMarkdown ||
      (content.thinkMarkdown ? '' : THINKING_PLACEHOLDER)

    targetMessage.content = nextBodyContent
    targetMessage.thinkContent = content.thinkMarkdown || ''
    targetMessage.pending = options.pending
    targetMessage.engine = options.engine
    targetMessage.conversationId =
      options.conversationId || targetMessage.conversationId
    targetMessage.renderMode = 'markdown'

    if (!content.hasThinkBlock || !content.thinkMarkdown) {
      targetMessage.thinkCollapsed = true
      return
    }

    targetMessage.thinkCollapsed = !content.thinkCompleted
      ? false
      : true
  }

  const startSpeechSegment = async (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
    segmentKind: SpeechSegmentKind,
  ) => {
    const normalizedSpeechText = normalizeSpeechText(speechText)
    const targetMessage = getMessageById(messageId)

    if (!targetMessage || !normalizedSpeechText) {
      return
    }

    cancelPendingSpeechSynthesis()
    activeSpeechSegment = segmentKind

    const ttsController = new AbortController()
    activeTtsController = ttsController

    let synthesized: SpeechSynthesisResult

    try {
      synthesized = await speechSynthesisClient.synthesize(normalizedSpeechText, {
        signal: ttsController.signal,
      })
    } catch (error) {
      if (activeTtsController === ttsController) {
        activeTtsController = null
      }

      if (
        ttsController.signal.aborted ||
        flowId !== activeFlowId ||
        isAbortError(error)
      ) {
        if (activeSpeechSegment === segmentKind) {
          activeSpeechSegment = null
        }

        return
      }

      synthesized = buildMockSpeechResult(normalizedSpeechText)
    }

    if (activeTtsController === ttsController) {
      activeTtsController = null
    }

    if (flowId !== activeFlowId || activeSpeechSegment !== segmentKind) {
      speechSynthesisClient.revoke(synthesized)
      return
    }

    const currentMessage = getMessageById(messageId)
    if (!currentMessage) {
      if (activeSpeechSegment === segmentKind) {
        activeSpeechSegment = null
      }

      speechSynthesisClient.revoke(synthesized)
      return
    }

    currentMessage.pending = flowStreamCompleted ? false : currentMessage.pending
    currentMessage.engine = engine
    currentMessage.conversationId =
      conversationId.value || currentMessage.conversationId

    activeSpeakingFlowId = flowId
    setSpeechResult(synthesized)
    speechToken.value += 1
    status.value = 'speaking'
  }

  const maybeStartLeadSpeech = (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
  ) => {
    if (flowId !== activeFlowId || leadSpeechStarted || flowStreamCompleted) {
      return
    }

    const normalizedSpeechText = normalizeSpeechText(speechText)
    latestSpeechText = normalizedSpeechText

    if (!normalizedSpeechText) {
      return
    }

    const nextLeadSpeechEndIndex = getLeadSpeechEndIndex(normalizedSpeechText)
    if (nextLeadSpeechEndIndex < 0) {
      return
    }

    const leadSpeechText = normalizeSpeechText(
      normalizedSpeechText.slice(0, nextLeadSpeechEndIndex),
    )

    if (!leadSpeechText) {
      return
    }

    leadSpeechStarted = true
    leadSpeechEndIndex = nextLeadSpeechEndIndex
    void startSpeechSegment(
      flowId,
      messageId,
      leadSpeechText,
      engine,
      'lead',
    )
  }

  const startTailSpeechIfReady = (
    flowId: number,
    messageId: string,
    engine: DemoMessage['engine'],
  ) => {
    if (
      flowId !== activeFlowId ||
      !flowStreamCompleted ||
      tailSpeechStarted ||
      activeSpeechSegment
    ) {
      return
    }

    const normalizedSpeechText = normalizeSpeechText(latestSpeechText)
    if (!normalizedSpeechText) {
      finishFlowNow(flowId)
      return
    }

    if (leadSpeechStarted && !leadSpeechCompleted) {
      return
    }

    const tailSpeechText = leadSpeechStarted
      ? getTailSpeechText(normalizedSpeechText, leadSpeechEndIndex)
      : normalizedSpeechText

    if (!tailSpeechText) {
      finishFlowNow(flowId)
      return
    }

    tailSpeechStarted = true
    void startSpeechSegment(flowId, messageId, tailSpeechText, engine, 'tail')
  }

  const finalizeSpeechFlow = (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
  ) => {
    if (flowId !== activeFlowId) {
      return
    }

    latestSpeechText = normalizeSpeechText(speechText)
    flowStreamCompleted = true
    startTailSpeechIfReady(flowId, messageId, engine)
  }

  const streamMarkdownReply = (
    flowId: number,
    messageId: string,
    fullReply: string,
    engine: DemoMessage['engine'],
    onProgress?: (markdownText: string) => void,
  ) =>
    new Promise<boolean>((resolve) => {
      const targetMessage = getMessageById(messageId)

      if (!targetMessage) {
        resolve(false)
        return
      }

      if (!fullReply) {
        targetMessage.content = ''
        targetMessage.thinkContent = ''
        targetMessage.thinkCollapsed = true
        targetMessage.pending = false
        resolve(true)
        return
      }

      let index = 0
      const intervalMs = Math.max(16, RESPONSE_TIMING.typingIntervalMs)

      const tick = () => {
        if (flowId !== activeFlowId) {
          resolve(false)
          return
        }

        const currentMessage = getMessageById(messageId)
        if (!currentMessage) {
          resolve(false)
          return
        }

        index += 1
        const isPending = index < fullReply.length

        currentMessage.content = fullReply.slice(0, index)
        currentMessage.thinkContent = ''
        currentMessage.thinkCollapsed = true
        currentMessage.pending = isPending
        currentMessage.engine = engine
        currentMessage.renderMode = 'markdown'
        onProgress?.(currentMessage.content)

        if (isPending) {
          queueTimeout(tick, intervalMs)
          return
        }

        currentMessage.content = fullReply
        currentMessage.pending = false
        onProgress?.(currentMessage.content)
        resolve(true)
      }

      tick()
    })

  const runFallbackReplyFlow = async (
    flowId: number,
    question: string,
    messageId: string,
  ) => {
    if (flowId !== activeFlowId) {
      return
    }

    setSpeechResult(null)
    status.value = 'thinking'

    const targetMessage = getMessageById(messageId)
    if (!targetMessage) {
      return
    }

    const fallbackReply = buildFallbackReplyText(question)
    targetMessage.engine = 'fallback'
    targetMessage.content = ''
    targetMessage.thinkContent = ''
    targetMessage.thinkCollapsed = true
    targetMessage.pending = true
    targetMessage.renderMode = 'markdown'

    const didCompleteStreaming = await streamMarkdownReply(
      flowId,
      messageId,
      fallbackReply,
      'fallback',
      (markdownText) => {
        maybeStartLeadSpeech(
          flowId,
          messageId,
          markdownToPlainText(markdownText),
          'fallback',
        )
      },
    )

    if (!didCompleteStreaming || flowId !== activeFlowId) {
      return
    }

    finalizeSpeechFlow(
      flowId,
      messageId,
      markdownToPlainText(fallbackReply),
      'fallback',
    )
  }

  const settleInterruptedAssistantMessage = () => {
    if (!currentAssistantMessageId) {
      return
    }

    const targetMessage = getMessageById(currentAssistantMessageId)
    if (!targetMessage) {
      return
    }

    const hasBodyContent =
      targetMessage.content.trim() &&
      targetMessage.content.trim() !== THINKING_PLACEHOLDER
    const hasThinkContent = Boolean(targetMessage.thinkContent?.trim())

    if (!hasBodyContent && !hasThinkContent) {
      messages.value = messages.value.filter(
        (message) => message.id !== currentAssistantMessageId,
      )
      return
    }

    if (!hasBodyContent && hasThinkContent) {
      targetMessage.content = ''
    }

    targetMessage.pending = false
  }

  const cancelCurrentFlow = () => {
    activeFlowId += 1
    activeVoiceStopId += 1
    clearFlowTimers()
    settlePendingMessages()
    cancelPendingDify()
    cancelPendingSpeechSynthesis()
    void speechRecognition.cancel()
    clearVoiceInterruptState()
    isRecording.value = false
    setSpeechResult(null)
    status.value = 'idle'
    clearSpeechProgress()
  }

  const interruptCurrentVoiceFlow = () => {
    if (!showVoiceInterruptButton.value && !isAwaitingVoiceRecognitionResult.value) {
      return
    }

    settleInterruptedAssistantMessage()
    inputText.value = ''
    cancelCurrentFlow()
  }

  const runReplyFlow = (question: string, source: DemoMessage['source']) => {
    const assistantMessage = createMessage('assistant', THINKING_PLACEHOLDER, {
      pending: true,
      source,
      engine: 'dify',
      renderMode: 'markdown',
      thinkCollapsed: true,
    })
    const flowId = activeFlowId + 1

    activeFlowId = flowId
    clearSpeechProgress()
    currentAssistantMessageId = assistantMessage.id
    setSpeechResult(null)
    messages.value.push(assistantMessage)
    status.value = 'thinking'
    showVoiceInterruptButton.value = source === 'voice'

    const assistantMessageId = assistantMessage.id
    const difyController = new AbortController()
    activeDifyController = difyController
    activeDifyTaskId = ''

    void (async () => {
      try {
        const result = await difyChatClient.run(question, {
          conversationId: conversationId.value,
          signal: difyController.signal,
          onTaskId: (taskId) => {
            if (flowId !== activeFlowId) {
              return
            }

            activeDifyTaskId = taskId
          },
          onConversationId: (nextConversationId) => {
            if (flowId !== activeFlowId) {
              return
            }

            conversationId.value = nextConversationId

            const targetMessage = getMessageById(assistantMessageId)
            if (targetMessage) {
              targetMessage.conversationId = nextConversationId
            }
          },
          onText: (content) => {
            if (flowId !== activeFlowId) {
              return
            }

            updateAssistantMessage(assistantMessageId, content, {
              pending: true,
              engine: 'dify',
              conversationId: conversationId.value,
            })
            maybeStartLeadSpeech(
              flowId,
              assistantMessageId,
              content.speechText,
              'dify',
            )
          },
        })

        if (activeDifyController === difyController) {
          activeDifyController = null
        }

        activeDifyTaskId = ''

        if (flowId !== activeFlowId) {
          return
        }

        conversationId.value = result.conversationId || conversationId.value

        if (!result.bodyMarkdown || !result.speechText) {
          await runFallbackReplyFlow(flowId, question, assistantMessageId)
          return
        }

        updateAssistantMessage(assistantMessageId, result, {
          pending: false,
          engine: 'dify',
          conversationId: conversationId.value,
        })

        finalizeSpeechFlow(
          flowId,
          assistantMessageId,
          result.speechText,
          'dify',
        )
      } catch (error) {
        const taskId = activeDifyTaskId

        if (activeDifyController === difyController) {
          activeDifyController = null
        }

        activeDifyTaskId = ''

        if (
          flowId !== activeFlowId ||
          difyController.signal.aborted ||
          isAbortError(error)
        ) {
          return
        }

        const targetMessage = getMessageById(assistantMessageId)
        const partialBody =
          targetMessage &&
          targetMessage.content.trim() &&
          targetMessage.content !== THINKING_PLACEHOLDER
            ? targetMessage.content.trim()
            : ''
        const partialSpeechText = markdownToPlainText(partialBody)

        if (taskId) {
          void difyChatClient.stop(taskId)
        }

        if (partialSpeechText) {
          if (targetMessage) {
            targetMessage.pending = false
            targetMessage.engine = 'dify'
          }

          finalizeSpeechFlow(
            flowId,
            assistantMessageId,
            partialSpeechText,
            'dify',
          )
          return
        }

        await runFallbackReplyFlow(flowId, question, assistantMessageId)
      }
    })()
  }

  const sendText = (
    rawText: string,
    source: DemoMessage['source'] = 'text',
  ) => {
    const question = rawText.trim()
    if (!question) {
      return
    }

    if (isBusy.value || isRecording.value || isAwaitingVoiceRecognitionResult.value) {
      cancelCurrentFlow()
    }

    if (source !== 'voice') {
      showVoiceInterruptButton.value = false
    }

    isExpanded.value = true
    messages.value.push(
      createMessage('user', question, {
        source,
        renderMode: 'plain',
      }),
    )
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

    if (isBusy.value || isAwaitingVoiceRecognitionResult.value) {
      cancelCurrentFlow()
    }

    activeVoiceStopId += 1
    isExpanded.value = true
    clearFlowTimers()
    clearVoiceInterruptState()
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

    const voiceStopId = ++activeVoiceStopId

    isRecording.value = false
    status.value = 'idle'
    showVoiceInterruptButton.value = true
    isAwaitingVoiceRecognitionResult.value = true

    const recognizedText = await speechRecognition.stop()

    if (
      voiceStopId !== activeVoiceStopId ||
      !isAwaitingVoiceRecognitionResult.value
    ) {
      return
    }

    isAwaitingVoiceRecognitionResult.value = false

    const fallbackText = inputText.value.trim()
    const question = recognizedText || fallbackText

    if (question) {
      sendText(question, 'voice')
      return
    }

    clearVoiceInterruptState()
    inputText.value = ''
  }

  const handleSpeechComplete = () => {
    const flowId = activeFlowId

    if (
      status.value !== 'speaking' ||
      activeSpeakingFlowId !== flowId ||
      !activeSpeechSegment
    ) {
      setSpeechResult(null)
      activeSpeakingFlowId = 0
      activeSpeechSegment = null
      return
    }

    const completedSegment = activeSpeechSegment
    const messageId = currentAssistantMessageId
    const engine = getMessageEngine(messageId, 'dify')

    setSpeechResult(null)
    activeSpeakingFlowId = 0
    activeSpeechSegment = null

    if (completedSegment === 'lead') {
      leadSpeechCompleted = true

      if (flowStreamCompleted) {
        startTailSpeechIfReady(flowId, messageId, engine)

        if (!tailSpeechStarted) {
          finishFlowNow(flowId)
        }

        return
      }

      status.value = 'thinking'
      return
    }

    scheduleIdleTransition(flowId)
  }

  const toggleThinkVisibility = (messageId: string) => {
    const targetMessage = getMessageById(messageId)
    if (!targetMessage?.thinkContent) {
      return
    }

    targetMessage.thinkCollapsed = !targetMessage.thinkCollapsed
  }

  const expand = () => {
    isExpanded.value = true
  }

  const collapse = () => {
    cancelCurrentFlow()
    isExpanded.value = false
  }

  const resetToWelcome = () => {
    messages.value = [
      createMessage('system', SYSTEM_WELCOME, {
        source: 'system',
        renderMode: 'markdown',
      }),
    ]
    inputText.value = ''
    isRecording.value = false
    status.value = 'idle'
    conversationId.value = ''
    cancelPendingDify()
    cancelPendingSpeechSynthesis()
    void speechRecognition.cancel()
    clearVoiceInterruptState()
    setSpeechResult(null)
    clearSpeechProgress()
  }

  const clearConversation = () => {
    cancelCurrentFlow()
    resetToWelcome()
  }

  onBeforeUnmount(() => {
    clearFlowTimers()
    cancelPendingDify()
    cancelPendingSpeechSynthesis()
    void speechRecognition.cancel()
    clearVoiceInterruptState()
    setSpeechResult(null)
    clearSpeechProgress()
  })

  return {
    clearConversation,
    collapse,
    expand,
    handleSpeechComplete,
    hasInput,
    inputText,
    interruptCurrentVoiceFlow,
    isBusy,
    isExpanded,
    isRecording,
    latestAssistantText,
    messages,
    sendText,
    showVoiceInterruptButton,
    speechResult,
    speechToken,
    startVoiceInput,
    status,
    stopVoiceInput,
    submitInput,
    suggestions,
    toggleThinkVisibility,
  }
}
