// 数字人主交互 Hook，串联文本问答、语音识别、TTS 队列和面板状态。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  buildDemoReply,
  buildMockSpeechResult,
  DIGITAL_HUMAN_SUGGESTIONS,
  RESPONSE_TIMING,
  SYSTEM_WELCOME,
} from '@/config/demo-config'
import type {
  AvatarState,
  DemoMessage,
  SpeechSynthesisResult,
} from '@/types/avatar-types'
import { markdownToPlainText, type ParsedReplyContent } from '@/utils/message-content'
import { useDifyChat } from './useDifyChat'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useSpeechSynthesis } from './useSpeechSynthesis'

const THINKING_PLACEHOLDER = '思考中...'
const LEAD_SPEECH_SEGMENT_EFFECTIVE_CHARS = 40
const LEAD_SPEECH_SEGMENT_MAX_LOOKAHEAD_CHARS = 20
const SPEECH_SEGMENT_EFFECTIVE_CHARS = 100
const SPEECH_SEGMENT_MAX_LOOKAHEAD_CHARS = 40
const SENTENCE_END_CHARS = '。！？；.!?;'
const WHITESPACE_RE = /\s/

// 构造外部服务不可用时的本地兜底回复文本。
const buildFallbackReplyText = (question: string) =>
  `当前服务暂时不可用，先为你提供本地演示回复。\n\n${buildDemoReply(question)}`

// 清理播报文本首尾空白并统一换行符。
const normalizeSpeechText = (value: string) => value.replace(/\r\n/g, '\n').trim()

// 创建统一的消息对象，补齐时间、来源和渲染模式等默认值。
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

// 判断异常是否来自主动中断，避免误报为真实错误。
const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

interface TtsQueueItem {
  flowId: number
  messageId: string
  sequence: number
  text: string
  startIndex: number
  endIndex: number
  startEffectiveChar: number
  endEffectiveChar: number
  engine: DemoMessage['engine']
}

interface PlaybackQueueItem {
  flowId: number
  messageId: string
  sequence: number
  speechResult: SpeechSynthesisResult
  startIndex: number
  endIndex: number
  startEffectiveChar: number
  endEffectiveChar: number
  engine: DemoMessage['engine']
}

export function useDigitalHumanDemo() {
  const isExpanded = ref(false)
  const inputText = ref('')
  const inputHint = ref('')
  const isRecording = ref(false)
  const isAwaitingVoiceRecognitionResult = ref(false)
  const showInterruptButton = ref(false)
  const status = ref<AvatarState>('idle')
  const messages = ref<DemoMessage[]>([
    createMessage('system', SYSTEM_WELCOME, {
      source: 'system',
      renderMode: 'markdown',
    }),
  ])
  const speechResult = ref<SpeechSynthesisResult | null>(null)
  const speechToken = ref(0)
  const speechPlaybackProgress = ref(0)
  const speechPlaybackMessageId = ref('')
  const speechOverallProgress = ref(0)
  const speechFollowText = ref('')
  const speechFollowHighlightIndex = ref(0)
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
  let inputHintTimer: number | null = null
  let ttsQueue: TtsQueueItem[] = []
  let playbackQueue: PlaybackQueueItem[] = []
  let isTtsQueueRunning = false
  let isPlaybackQueueRunning = false
  let queuedSpeechEndIndex = 0
  let queuedSpeechEffectiveChars = 0
  let speechSegmentSequence = 0
  let streamSpeechText = ''
  let latestBodyMarkdown = ''
  let displayedSpeechText = ''
  let activePlaybackItem: PlaybackQueueItem | null = null
  let completedSpeechEffectiveChars = 0
  let totalSpeechEffectiveChars = 0
  let difyStreamCompleted = false

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
  const isSpeechSynthesizing = computed(
    () => speechSynthesisClient.isSynthesizing.value,
  )

  // 根据消息 id 获取当前会话中的消息对象。
  const getMessageById = (messageId: string) =>
    messages.value.find((message) => message.id === messageId) ?? null

  // 清理输入区临时提示及其自动消失定时器。
  const clearInputHint = () => {
    if (inputHintTimer !== null) {
      window.clearTimeout(inputHintTimer)
      inputHintTimer = null
    }

    inputHint.value = ''
  }

  // 展示短暂输入提示，用于错误、无识别结果等轻量反馈。
  const showTransientInputHint = (message: string) => {
    clearInputHint()
    inputHint.value = message
    inputHintTimer = window.setTimeout(() => {
      inputHintTimer = null
      inputHint.value = ''
    }, 3000)
  }

  // 清理中断按钮和等待语音识别结果的流程标记。
  const clearInterruptState = () => {
    showInterruptButton.value = false
    isAwaitingVoiceRecognitionResult.value = false
  }

  // 清理当前播报进度、跟读文本和播放关联消息。
  const clearSpeechProgress = () => {
    activeSpeakingFlowId = 0
    speechPlaybackProgress.value = 0
    speechPlaybackMessageId.value = ''
    speechOverallProgress.value = 0
    speechFollowText.value = ''
    speechFollowHighlightIndex.value = 0
    currentAssistantMessageId = ''
    activePlaybackItem = null
    completedSpeechEffectiveChars = 0
    displayedSpeechText = ''
  }

  // 重置 TTS 队列、播放队列和流式分段游标。
  const resetSpeechQueueState = () => {
    ttsQueue = []
    playbackQueue = []
    isTtsQueueRunning = false
    isPlaybackQueueRunning = false
    queuedSpeechEndIndex = 0
    queuedSpeechEffectiveChars = 0
    speechSegmentSequence = 0
    streamSpeechText = ''
    latestBodyMarkdown = ''
    totalSpeechEffectiveChars = 0
    difyStreamCompleted = false
  }

  // 判断字符是否适合作为语音分段的句末边界。
  const isSentenceEndChar = (value: string) => SENTENCE_END_CHARS.includes(value)

  // 统计非空白字符数量，用于控制 TTS 分段长度。
  const countEffectiveChars = (text: string) => {
    let effectiveChars = 0

    for (let index = 0; index < text.length; index += 1) {
      if (!WHITESPACE_RE.test(text[index])) {
        effectiveChars += 1
      }
    }

    return effectiveChars
  }

  // 按播放比例估算当前文本下标，用于跟读进度。
  const getTextIndexByRatio = (text: string, ratio: number) =>
    Math.max(0, Math.min(text.length, Math.floor(text.length * ratio)))

  // 寻找语音分段终点：首段更短，后续优先在目标长度附近按句末标点切分。
  const getSpeechSegmentEndIndex = (
    text: string,
    startIndex: number,
    includeTail = false,
  ) => {
    const isLeadSegment = speechSegmentSequence === 0 && startIndex === 0
    const targetEffectiveChars = isLeadSegment
      ? LEAD_SPEECH_SEGMENT_EFFECTIVE_CHARS
      : SPEECH_SEGMENT_EFFECTIVE_CHARS
    const maxLookaheadEffectiveChars = isLeadSegment
      ? LEAD_SPEECH_SEGMENT_MAX_LOOKAHEAD_CHARS
      : SPEECH_SEGMENT_MAX_LOOKAHEAD_CHARS
    let effectiveChars = 0
    let targetEndIndex = -1
    let lookaheadEffectiveChars = 0

    for (let index = startIndex; index < text.length; index += 1) {
      if (WHITESPACE_RE.test(text[index])) {
        continue
      }

      effectiveChars += 1

      if (targetEndIndex === -1) {
        if (effectiveChars >= targetEffectiveChars) {
          targetEndIndex = index + 1

          if (isSentenceEndChar(text[index])) {
            return targetEndIndex
          }
        }

        continue
      }

      lookaheadEffectiveChars += 1

      if (isSentenceEndChar(text[index])) {
        return index + 1
      }

      if (lookaheadEffectiveChars >= maxLookaheadEffectiveChars) {
        return index + 1
      }
    }

    if (includeTail && text.slice(startIndex).trim()) {
      return text.length
    }

    return -1
  }

  // 替换当前播放结果，并释放上一段语音的 blob URL。
  const setSpeechResult = (nextSpeechResult: SpeechSynthesisResult | null) => {
    if (
      speechResult.value &&
      speechResult.value.audioUrl !== nextSpeechResult?.audioUrl
    ) {
      speechSynthesisClient.revoke(speechResult.value)
    }

    speechResult.value = nextSpeechResult
  }

  // 清理本轮流程内登记的所有延迟任务。
  const clearFlowTimers = () => {
    flowTimers.forEach((timer) => window.clearTimeout(timer))
    flowTimers = []
  }

  // 登记可统一清理的延迟任务，避免中断后旧任务继续执行。
  const queueTimeout = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      flowTimers = flowTimers.filter((item) => item !== timer)
      callback()
    }, delay)

    flowTimers.push(timer)
  }

  // 取消正在进行的 TTS 请求。
  const cancelPendingSpeechSynthesis = () => {
    if (!activeTtsController) {
      return
    }

    activeTtsController.abort()
    activeTtsController = null
  }

  // 取消正在进行的 Dify 请求，并通知 Dify 后端停止任务。
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

  // 将所有 pending 消息收口为已完成，避免 UI 长期显示生成中。
  const settlePendingMessages = () => {
    messages.value.forEach((message) => {
      if (message.pending) {
        message.pending = false
      }
    })
  }

  // 根据当前分段播放进度计算整条回复的播报进度。
  const updateSpeechOverallProgress = (segmentProgress = speechPlaybackProgress.value) => {
    if (!activePlaybackItem || totalSpeechEffectiveChars <= 0) {
      speechOverallProgress.value = 0
      return
    }

    const currentSegmentEffectiveChars = Math.max(
      0,
      activePlaybackItem.endEffectiveChar - activePlaybackItem.startEffectiveChar,
    )
    const playedEffectiveChars =
      completedSpeechEffectiveChars +
      currentSegmentEffectiveChars * Math.max(0, Math.min(1, segmentProgress))

    speechOverallProgress.value = Math.max(
      0,
      Math.min(1, playedEffectiveChars / Math.max(1, totalSpeechEffectiveChars)),
    )
  }

  // 按当前分段播放进度更新用户可见正文。
  const syncVisibleSpeechText = (messageId: string, segmentProgress = 0) => {
    const targetMessage = getMessageById(messageId)
    if (!targetMessage || !activePlaybackItem) {
      return
    }

    const currentSegmentText = streamSpeechText.slice(
      activePlaybackItem.startIndex,
      activePlaybackItem.endIndex,
    )
    const currentSegmentVisibleIndex = getTextIndexByRatio(
      currentSegmentText,
      segmentProgress,
    )

    displayedSpeechText = (
      streamSpeechText.slice(0, activePlaybackItem.startIndex) +
      currentSegmentText.slice(0, currentSegmentVisibleIndex)
    ).trim()
    targetMessage.content = displayedSpeechText
    targetMessage.renderMode = 'markdown'
  }

  // 整轮语音播报完成后恢复最终完整 Markdown 正文。
  const revealFinalAssistantMessage = () => {
    if (!currentAssistantMessageId) {
      return
    }

    const targetMessage = getMessageById(currentAssistantMessageId)
    if (!targetMessage) {
      return
    }

    targetMessage.content = latestBodyMarkdown || displayedSpeechText
    targetMessage.pending = false
    targetMessage.renderMode = 'markdown'
  }

  // 立即结束当前流程并恢复空闲态。
  const finishFlowNow = (flowId: number) => {
    if (flowId !== activeFlowId) {
      return
    }

    revealFinalAssistantMessage()
    status.value = 'idle'
    resetSpeechQueueState()
    clearInterruptState()
    setSpeechResult(null)
    clearSpeechProgress()
  }

  // 将 Dify 流式内容同步到 assistant 消息，并维护 think 展开/折叠状态。
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

    latestBodyMarkdown = content.bodyMarkdown || latestBodyMarkdown

    const nextBodyContent =
      displayedSpeechText ||
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

  // 检查 Dify、TTS 和播放队列是否全部完成，满足条件时结束整轮流程。
  const finishSpeechQueueIfReady = (flowId: number) => {
    if (flowId !== activeFlowId) {
      return
    }

    if (isPlaybackQueueRunning || playbackQueue.length > 0) {
      return
    }

    if (isTtsQueueRunning || ttsQueue.length > 0 || !difyStreamCompleted) {
      status.value = 'thinking'
      return
    }

    finishFlowNow(flowId)
  }

  // 启动播放队列中的一段语音，并绑定当前消息和进度状态。
  const startQueuedPlayback = (item: PlaybackQueueItem) => {
    if (item.flowId !== activeFlowId) {
      speechSynthesisClient.revoke(item.speechResult)
      return false
    }

    const currentMessage = getMessageById(item.messageId)
    if (!currentMessage) {
      speechSynthesisClient.revoke(item.speechResult)
      return false
    }

    currentMessage.pending = !difyStreamCompleted
    currentMessage.engine = item.engine
    currentMessage.conversationId =
      conversationId.value || currentMessage.conversationId

    activeSpeakingFlowId = item.flowId
    activePlaybackItem = item
    speechPlaybackProgress.value = 0
    speechPlaybackMessageId.value = item.messageId
    speechFollowText.value = item.speechResult.text
    speechFollowHighlightIndex.value = 0
    syncVisibleSpeechText(item.messageId, 0)
    updateSpeechOverallProgress(0)
    setSpeechResult(item.speechResult)
    speechToken.value += 1
    status.value = 'speaking'
    return true
  }

  // 串行消费已合成的播放队列，保证音频按文本顺序播放。
  const drainPlaybackQueue = (flowId: number) => {
    if (flowId !== activeFlowId || isPlaybackQueueRunning) {
      return
    }

    const nextItem = playbackQueue.shift()

    if (!nextItem) {
      finishSpeechQueueIfReady(flowId)
      return
    }

    if (nextItem.flowId !== activeFlowId) {
      speechSynthesisClient.revoke(nextItem.speechResult)
      drainPlaybackQueue(flowId)
      return
    }

    isPlaybackQueueRunning = true
    if (!startQueuedPlayback(nextItem)) {
      isPlaybackQueueRunning = false
      drainPlaybackQueue(flowId)
    }
  }

  // 合成一个 TTS 分段，成功后放入播放队列，失败时使用本地模拟语音兜底。
  const synthesizeQueuedSpeech = async (item: TtsQueueItem) => {
    const normalizedSpeechText = normalizeSpeechText(item.text)
    const targetMessage = getMessageById(item.messageId)

    if (
      item.flowId !== activeFlowId ||
      !targetMessage ||
      !normalizedSpeechText
    ) {
      isTtsQueueRunning = false
      finishSpeechQueueIfReady(item.flowId)
      return
    }

    const ttsController = new AbortController()
    activeTtsController = ttsController
    if (!isPlaybackQueueRunning) {
      status.value = 'thinking'
    }

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
        item.flowId !== activeFlowId ||
        isAbortError(error)
      ) {
        isTtsQueueRunning = false
        return
      }

      synthesized = buildMockSpeechResult(normalizedSpeechText)
    }

    if (activeTtsController === ttsController) {
      activeTtsController = null
    }

    if (item.flowId !== activeFlowId) {
      speechSynthesisClient.revoke(synthesized)
      isTtsQueueRunning = false
      return
    }

    if (!getMessageById(item.messageId)) {
      speechSynthesisClient.revoke(synthesized)
      isTtsQueueRunning = false
      finishSpeechQueueIfReady(item.flowId)
      return
    }

    playbackQueue.push({
      flowId: item.flowId,
      messageId: item.messageId,
      sequence: item.sequence,
      speechResult: synthesized,
      startIndex: item.startIndex,
      endIndex: item.endIndex,
      startEffectiveChar: item.startEffectiveChar,
      endEffectiveChar: item.endEffectiveChar,
      engine: item.engine,
    })
    playbackQueue.sort((left, right) => left.sequence - right.sequence)
    isTtsQueueRunning = false
    drainPlaybackQueue(item.flowId)
    drainTtsQueue(item.flowId)
  }

  // 串行消费 TTS 合成队列，但允许 TTS 请求和当前音频播放并行。
  const drainTtsQueue = (flowId: number) => {
    if (flowId !== activeFlowId || isTtsQueueRunning) {
      return
    }

    const nextItem = ttsQueue.shift()

    if (!nextItem) {
      finishSpeechQueueIfReady(flowId)
      return
    }

    if (nextItem.flowId !== activeFlowId) {
      drainTtsQueue(flowId)
      return
    }

    isTtsQueueRunning = true
    void synthesizeQueuedSpeech(nextItem)
  }

  // 从最新 speechText 中切出新分段并加入 TTS 队列。
  const enqueueSpeechSegments = (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
    includeTail = false,
  ) => {
    if (flowId !== activeFlowId) {
      return
    }

    const normalizedSpeechText = normalizeSpeechText(speechText)
    streamSpeechText = normalizedSpeechText
    totalSpeechEffectiveChars = countEffectiveChars(normalizedSpeechText)

    if (queuedSpeechEndIndex > normalizedSpeechText.length) {
      queuedSpeechEndIndex = normalizedSpeechText.length
      queuedSpeechEffectiveChars = countEffectiveChars(
        normalizedSpeechText.slice(0, queuedSpeechEndIndex),
      )
    }

    while (queuedSpeechEndIndex < normalizedSpeechText.length) {
      const segmentStartIndex = queuedSpeechEndIndex
      const segmentEndIndex = getSpeechSegmentEndIndex(
        normalizedSpeechText,
        segmentStartIndex,
        includeTail,
      )

      if (segmentEndIndex === -1) {
        break
      }

      const rawSegmentText = normalizedSpeechText.slice(
        segmentStartIndex,
        segmentEndIndex,
      )
      const segmentText = rawSegmentText.trim()
      queuedSpeechEndIndex = segmentEndIndex

      if (segmentText) {
        const segmentEffectiveChars = countEffectiveChars(rawSegmentText)
        speechSegmentSequence += 1
        ttsQueue.push({
          flowId,
          messageId,
          sequence: speechSegmentSequence,
          text: segmentText,
          startIndex: segmentStartIndex,
          endIndex: segmentEndIndex,
          startEffectiveChar: queuedSpeechEffectiveChars,
          endEffectiveChar: queuedSpeechEffectiveChars + segmentEffectiveChars,
          engine,
        })
        queuedSpeechEffectiveChars += segmentEffectiveChars
      }
    }

    if (includeTail && queuedSpeechEndIndex < normalizedSpeechText.length) {
      const tailStartIndex = queuedSpeechEndIndex
      const rawTailText = normalizedSpeechText.slice(tailStartIndex)
      const tailText = rawTailText.trim()
      queuedSpeechEndIndex = normalizedSpeechText.length

      if (tailText) {
        const tailEffectiveChars = countEffectiveChars(rawTailText)
        speechSegmentSequence += 1
        ttsQueue.push({
          flowId,
          messageId,
          sequence: speechSegmentSequence,
          text: tailText,
          startIndex: tailStartIndex,
          endIndex: normalizedSpeechText.length,
          startEffectiveChar: queuedSpeechEffectiveChars,
          endEffectiveChar: queuedSpeechEffectiveChars + tailEffectiveChars,
          engine,
        })
        queuedSpeechEffectiveChars += tailEffectiveChars
      }
    }

    drainTtsQueue(flowId)
  }

  // Dify 流结束时补齐尾段，并标记后续可在队列清空后结束流程。
  const finalizeSpeechFlow = (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
  ) => {
    if (flowId !== activeFlowId) {
      return
    }

    difyStreamCompleted = true
    enqueueSpeechSegments(
      flowId,
      messageId,
      speechText || streamSpeechText,
      engine,
      true,
    )
  }

  // 本地兜底回复的打字流式展示，并复用同一套 TTS 分段队列。
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
        const currentMarkdown = fullReply.slice(0, index)

        latestBodyMarkdown = currentMarkdown
        currentMessage.content = displayedSpeechText || THINKING_PLACEHOLDER
        currentMessage.thinkContent = ''
        currentMessage.thinkCollapsed = true
        currentMessage.pending = isPending
        currentMessage.engine = engine
        currentMessage.renderMode = 'markdown'
        onProgress?.(currentMarkdown)

        if (isPending) {
          queueTimeout(tick, intervalMs)
          return
        }

        latestBodyMarkdown = fullReply
        currentMessage.content = displayedSpeechText || THINKING_PLACEHOLDER
        currentMessage.pending = false
        onProgress?.(fullReply)
        resolve(true)
      }

      tick()
    })

  // 外部 Dify 不可用时运行本地兜底问答流程。
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
        enqueueSpeechSegments(
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

  // 中断时收口当前 assistant 消息，避免留下空白或永久 pending 气泡。
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

  // 取消当前完整流程，覆盖 Dify、TTS、播放、录音和 UI 状态。
  const cancelCurrentFlow = () => {
    activeFlowId += 1
    activeVoiceStopId += 1
    clearFlowTimers()
    settlePendingMessages()
    cancelPendingDify()
    cancelPendingSpeechSynthesis()
    resetSpeechQueueState()
    void speechRecognition.cancel()
    clearInterruptState()
    clearInputHint()
    isRecording.value = false
    setSpeechResult(null)
    status.value = 'idle'
    clearSpeechProgress()
  }

  // 用户点击中断按钮时执行当前流程取消。
  const interruptCurrentFlow = () => {
    if (!showInterruptButton.value && !isAwaitingVoiceRecognitionResult.value) {
      return
    }

    settleInterruptedAssistantMessage()
    cancelCurrentFlow()
  }

  // 发起一轮问答流程：Dify 流式文本、TTS 预合成和播放队列协同执行。
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
    resetSpeechQueueState()
    clearSpeechProgress()
    currentAssistantMessageId = assistantMessage.id
    setSpeechResult(null)
    messages.value.push(assistantMessage)
    status.value = 'thinking'
    showInterruptButton.value = true

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
            enqueueSpeechSegments(
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
        const partialSpeechText = streamSpeechText || markdownToPlainText(partialBody)

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

  // 发送文本问题，并在忙碌时先中断上一轮流程。
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

    clearInputHint()
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

  // 提交当前输入框文本。
  const submitInput = () => {
    clearInputHint()
    sendText(inputText.value, 'text')
  }

  // 开始语音输入，进入 listening 状态并启动 ASR。
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
    clearInterruptState()
    clearInputHint()
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

  // 停止语音输入，拿到识别结果后自动发起问答。
  const stopVoiceInput = async () => {
    if (!isRecording.value) {
      return
    }

    const voiceStopId = ++activeVoiceStopId

    isRecording.value = false
    status.value = 'idle'
    showInterruptButton.value = true
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
      clearInputHint()
      sendText(question, 'voice')
      return
    }

    clearInterruptState()
    inputText.value = ''
    showTransientInputHint('未识别到内容，请重试。')
  }

  // 单段语音播放完成后推进播放队列或结束整轮流程。
  const handleSpeechComplete = () => {
    const flowId = activeFlowId

    if (status.value !== 'speaking' || activeSpeakingFlowId !== flowId) {
      setSpeechResult(null)
      activeSpeakingFlowId = 0
      return
    }

    setSpeechResult(null)
    if (activePlaybackItem) {
      completedSpeechEffectiveChars = activePlaybackItem.endEffectiveChar
      displayedSpeechText = streamSpeechText
        .slice(0, activePlaybackItem.endIndex)
        .trim()

      const currentMessage = getMessageById(activePlaybackItem.messageId)
      if (currentMessage) {
        currentMessage.content = displayedSpeechText
      }
    }
    activeSpeakingFlowId = 0
    activePlaybackItem = null
    isPlaybackQueueRunning = false
    speechPlaybackProgress.value = 0
    speechPlaybackMessageId.value = ''
    speechFollowText.value = ''
    speechFollowHighlightIndex.value = 0
    speechOverallProgress.value =
      totalSpeechEffectiveChars > 0
        ? Math.max(
            0,
            Math.min(1, completedSpeechEffectiveChars / totalSpeechEffectiveChars),
          )
        : 0
    drainPlaybackQueue(flowId)
  }

  // 接收视频舞台回传的当前段播放进度，并同步整体进度和跟读文本。
  const handleSpeechProgress = (progress: number) => {
    if (status.value !== 'speaking') {
      return
    }

    const nextProgress = Math.max(0, Math.min(1, progress))
    speechPlaybackProgress.value = nextProgress
    speechFollowHighlightIndex.value = getTextIndexByRatio(
      speechFollowText.value,
      nextProgress,
    )
    updateSpeechOverallProgress(nextProgress)

    if (activePlaybackItem) {
      syncVisibleSpeechText(activePlaybackItem.messageId, nextProgress)
    }
  }

  // 切换指定消息的思考过程展开状态。
  const toggleThinkVisibility = (messageId: string) => {
    const targetMessage = getMessageById(messageId)
    if (!targetMessage?.thinkContent) {
      return
    }

    targetMessage.thinkCollapsed = !targetMessage.thinkCollapsed
  }

  // 展开数字人面板。
  const expand = () => {
    isExpanded.value = true
  }

  // 关闭面板并取消当前所有运行中的流程。
  const collapse = () => {
    cancelCurrentFlow()
    isExpanded.value = false
  }

  // 重置会话到欢迎语，同时清理上下文和运行状态。
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
    resetSpeechQueueState()
    void speechRecognition.cancel()
    clearInterruptState()
    clearInputHint()
    setSpeechResult(null)
    clearSpeechProgress()
  }

  // 新建对话：取消当前流程并回到初始欢迎态。
  const clearConversation = () => {
    cancelCurrentFlow()
    resetToWelcome()
  }

  onBeforeUnmount(() => {
    clearFlowTimers()
    cancelPendingDify()
    cancelPendingSpeechSynthesis()
    resetSpeechQueueState()
    void speechRecognition.cancel()
    clearInterruptState()
    clearInputHint()
    setSpeechResult(null)
    clearSpeechProgress()
  })

  watch(inputText, (nextValue, previousValue) => {
    if (nextValue !== previousValue && inputHint.value) {
      clearInputHint()
    }
  })

  return {
    clearConversation,
    collapse,
    expand,
    handleSpeechComplete,
    handleSpeechProgress,
    hasInput,
    inputHint,
    inputText,
    interruptCurrentFlow,
    isBusy,
    isExpanded,
    isRecording,
    isSpeechSynthesizing,
    latestAssistantText,
    messages,
    sendText,
    showInterruptButton,
    speechResult,
    speechFollowHighlightIndex,
    speechFollowText,
    speechOverallProgress,
    speechPlaybackMessageId,
    speechPlaybackProgress,
    speechToken,
    startVoiceInput,
    status,
    stopVoiceInput,
    submitInput,
    suggestions,
    toggleThinkVisibility,
  }
}
