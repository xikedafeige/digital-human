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
  GuideProjectContext,
  SpeechSynthesisResult,
} from '@/types/avatar-types'
import {
  searchGuide,
  streamGuideProject,
  streamGuideQa,
  type GuideProjectCard,
  type GuideSearchRoute,
} from '@/services/guide-api'
import {
  markdownToPlainText,
  parseReplyContent,
  splitMarkdownRenderBlocks,
  type ParsedReplyContent,
} from '@/utils/message-content'
import { useSpeechRecognition } from './useSpeechRecognition'
import { useSpeechSynthesis } from './useSpeechSynthesis'

const THINKING_PLACEHOLDER = ''
const VOICE_AUTO_SEND_DELAY_MS = 500
const MAX_CONCURRENT_TTS_REQUESTS = 2
const LEAD_SPEECH_SEGMENT_EFFECTIVE_CHARS = 24
const LEAD_SPEECH_SEGMENT_MAX_LOOKAHEAD_CHARS = 12
const SPEECH_SEGMENT_EFFECTIVE_CHARS = 50
const SPEECH_SEGMENT_MAX_LOOKAHEAD_CHARS = 20
const SENTENCE_END_CHARS = '。！？；.!?;'
const SPEECH_PAUSE_END_CHARS = `${SENTENCE_END_CHARS}，,、：:`
const WHITESPACE_RE = /\s/

// 构造外部服务不可用时的本地兜底回复文本。
const buildFallbackReplyText = (question: string) =>
  `当前服务暂时不可用，先为你提供本地演示回复。\n\n${buildDemoReply(question)}`

// 清理播报文本首尾空白并统一换行符。
const appendSpeechPause = (text: string, pauseMark: '，' | '。') => {
  const trimmedText = text.replace(/[ \t]+$/g, '')
  const lastChar = trimmedText.charAt(trimmedText.length - 1)

  if (!lastChar || SPEECH_PAUSE_END_CHARS.includes(lastChar)) {
    return trimmedText
  }

  return `${trimmedText}${pauseMark}`
}

const normalizeSpeechText = (value: string) => {
  const normalizedText = value
    .replace(/\r\n/g, '\n')
    .replace(/\*{2,}/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalizedText) {
    return ''
  }

  return normalizedText
    .split(/(\n{2,}|\n)/)
    .map((part, index, parts) => {
      if (part.startsWith('\n')) {
        return part
      }

      const nextPart = parts[index + 1] ?? ''
      if (nextPart.startsWith('\n\n')) {
        return appendSpeechPause(part, '。')
      }

      if (nextPart === '\n') {
        return appendSpeechPause(part, '，')
      }

      return part.replace(/[ \t]+$/g, '')
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

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
      | 'renderBlocks'
      | 'routeCard'
      | 'suggestions'
      | 'projectContext'
      | 'requestMode'
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
  renderBlocks: options.renderBlocks,
  routeCard: options.routeCard,
  suggestions: options.suggestions,
  projectContext: options.projectContext,
  requestMode: options.requestMode,
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
  updateMessageContent?: boolean
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
  updateMessageContent?: boolean
}

interface ReplyFlowOptions {
  reuseMessageId?: string
  projectContext?: GuideProjectContext | null
}

interface DigitalHumanDemoOptions {
  onOpenRecentProjects?: () => void
}

export function useDigitalHumanDemo(demoOptions: DigitalHumanDemoOptions = {}) {
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
  const speechCompletedMessageIds = ref<string[]>([])
  const speechLoadingMessageId = ref('')
  const conversationId = ref('')
  const projectConversationId = ref('')
  const selectedProjectContext = ref<GuideProjectContext | null>(null)
  const isHistoryPanelOpen = ref(false)

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
  const activeTtsControllers = new Set<AbortController>()
  let activeGuideController: AbortController | null = null
  let inputHintTimer: number | null = null
  let voiceAutoSendTimerId: number | null = null
  let ttsQueue: TtsQueueItem[] = []
  let playbackQueue: PlaybackQueueItem[] = []
  let activeTtsRequestCount = 0
  let isPlaybackQueueRunning = false
  let queuedSpeechEndIndex = 0
  let queuedSpeechEffectiveChars = 0
  let nextPlaybackSequence = 1
  let speechSegmentSequence = 0
  let streamSpeechText = ''
  let latestBodyMarkdown = ''
  let latestMessageRenderBlocks: DemoMessage['renderBlocks'] = []
  let displayedSpeechText = ''
  let activePlaybackItem: PlaybackQueueItem | null = null
  let completedSpeechEffectiveChars = 0
  let totalSpeechEffectiveChars = 0
  let replyStreamCompleted = false
  // 远端历史仅作为只读快照展示，不能回写浏览器本地历史。
  let isExternalHistorySnapshot = false

  const speechRecognition = useSpeechRecognition({
    onPartial: (text) => {
      inputText.value = text
    },
    onSegment: (text) => {
      inputText.value = text
    },
    onAutoStop: () => {
      void stopVoiceInput()
    },
    onError: () => {
      void speechRecognition.cancel()
      isRecording.value = false
      status.value = 'idle'
      clearInterruptState()
    },
  })
  const speechSynthesisClient = useSpeechSynthesis()
  const isSpeechSynthesizing = computed(
    () => speechSynthesisClient.isSynthesizing.value,
  )

  // 记录已完整跟读结束的 assistant 消息，用于控制操作栏展示时机。
  const markSpeechCompleted = (messageId: string) => {
    if (!messageId || speechCompletedMessageIds.value.includes(messageId)) {
      return
    }

    speechCompletedMessageIds.value = [
      ...speechCompletedMessageIds.value,
      messageId,
    ]
  }

  // 新回复、重新生成等场景会清除旧完成标记，避免操作栏提前出现。
  const clearSpeechCompleted = (messageId: string) => {
    if (!messageId || !speechCompletedMessageIds.value.includes(messageId)) {
      return
    }

    speechCompletedMessageIds.value = speechCompletedMessageIds.value.filter(
      (item) => item !== messageId,
    )
  }

  // 清理首段语音加载提示，支持按消息 id 定向清理。
  const clearSpeechLoading = (messageId?: string) => {
    if (!messageId || speechLoadingMessageId.value === messageId) {
      speechLoadingMessageId.value = ''
    }
  }

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
    speechLoadingMessageId.value = ''
    currentAssistantMessageId = ''
    activePlaybackItem = null
    completedSpeechEffectiveChars = 0
    displayedSpeechText = ''
  }

  // 重置 TTS 队列、播放队列和流式分段游标。
  const resetSpeechQueueState = () => {
    ttsQueue = []
    playbackQueue = []
    activeTtsRequestCount = 0
    activeTtsControllers.clear()
    isPlaybackQueueRunning = false
    queuedSpeechEndIndex = 0
    queuedSpeechEffectiveChars = 0
    nextPlaybackSequence = 1
    speechSegmentSequence = 0
    streamSpeechText = ''
    latestBodyMarkdown = ''
    latestMessageRenderBlocks = []
    totalSpeechEffectiveChars = 0
    replyStreamCompleted = false
    speechLoadingMessageId.value = ''
  }

  // 判断字符是否适合作为语音分段的句末边界。
  const isSentenceEndChar = (value: string) =>
    SENTENCE_END_CHARS.includes(value)

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
  const clearVoiceAutoSendTimer = () => {
    if (voiceAutoSendTimerId !== null) {
      window.clearTimeout(voiceAutoSendTimerId)
      voiceAutoSendTimerId = null
    }
  }

  const clearFlowTimers = () => {
    flowTimers.forEach((timer) => window.clearTimeout(timer))
    flowTimers = []
    clearVoiceAutoSendTimer()
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
    activeTtsControllers.forEach((controller) => controller.abort())
    activeTtsControllers.clear()
    activeTtsRequestCount = 0
  }

  // 取消正在进行的智能引导请求，覆盖普通问答 SSE 和项目问答。
  const cancelPendingGuide = () => {
    activeGuideController?.abort()
    activeGuideController = null
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
  const updateSpeechOverallProgress = (
    segmentProgress = speechPlaybackProgress.value,
  ) => {
    if (!activePlaybackItem || totalSpeechEffectiveChars <= 0) {
      speechOverallProgress.value = 0
      return
    }

    const currentSegmentEffectiveChars = Math.max(
      0,
      activePlaybackItem.endEffectiveChar -
        activePlaybackItem.startEffectiveChar,
    )
    const playedEffectiveChars =
      completedSpeechEffectiveChars +
      currentSegmentEffectiveChars * Math.max(0, Math.min(1, segmentProgress))

    speechOverallProgress.value = Math.max(
      0,
      Math.min(
        1,
        playedEffectiveChars / Math.max(1, totalSpeechEffectiveChars),
      ),
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
    targetMessage.renderBlocks = latestMessageRenderBlocks?.length
      ? latestMessageRenderBlocks
      : splitMarkdownRenderBlocks(targetMessage.content)
    targetMessage.pending = false
    targetMessage.renderMode = 'markdown'
  }

  // 立即结束当前流程并恢复空闲态。
  const finishFlowNow = (flowId: number) => {
    if (flowId !== activeFlowId) {
      return
    }

    revealFinalAssistantMessage()
    markSpeechCompleted(currentAssistantMessageId)
    status.value = 'idle'
    resetSpeechQueueState()
    clearInterruptState()
    setSpeechResult(null)
    clearSpeechProgress()
  }

  // 将智能引导流式内容同步到 assistant 消息，并维护 think 展开/折叠状态。
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
    latestMessageRenderBlocks = content.renderBlocks

    const nextBodyContent =
      displayedSpeechText || (content.thinkMarkdown ? '' : THINKING_PLACEHOLDER)

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

    targetMessage.thinkCollapsed = !content.thinkCompleted ? false : true
  }

  // 检查回复、TTS 和播放队列是否全部完成，满足条件时结束整轮流程。
  const finishSpeechQueueIfReady = (flowId: number) => {
    if (flowId !== activeFlowId) {
      return
    }

    if (isPlaybackQueueRunning || playbackQueue.length > 0) {
      return
    }

    if (
      activeTtsRequestCount > 0 ||
      ttsQueue.length > 0 ||
      !replyStreamCompleted
    ) {
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

    if (item.updateMessageContent !== false) {
      currentMessage.pending = !replyStreamCompleted
      currentMessage.engine = item.engine
      if (currentMessage.requestMode !== 'project') {
        currentMessage.conversationId =
          conversationId.value || currentMessage.conversationId
      }
    }

    clearSpeechLoading(item.messageId)
    activeSpeakingFlowId = item.flowId
    activePlaybackItem = item
    speechPlaybackProgress.value = 0
    speechPlaybackMessageId.value = item.messageId
    speechFollowText.value = item.speechResult.text
    speechFollowHighlightIndex.value = 0
    if (item.updateMessageContent !== false) {
      syncVisibleSpeechText(item.messageId, 0)
    }
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

    const nextItemIndex = playbackQueue.findIndex(
      (item) => item.sequence === nextPlaybackSequence,
    )

    if (nextItemIndex === -1) {
      finishSpeechQueueIfReady(flowId)
      return
    }

    const [nextItem] = playbackQueue.splice(nextItemIndex, 1)

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
      finishSpeechQueueIfReady(item.flowId)
      return
    }

    const ttsController = new AbortController()
    activeTtsControllers.add(ttsController)
    activeTtsRequestCount += 1
    if (item.sequence === 1 && !isPlaybackQueueRunning) {
      speechLoadingMessageId.value = item.messageId
    }
    if (!isPlaybackQueueRunning) {
      status.value = 'thinking'
    }

    let synthesized: SpeechSynthesisResult

    try {
      synthesized = await speechSynthesisClient.synthesize(
        normalizedSpeechText,
        {
          signal: ttsController.signal,
        },
      )
    } catch (error) {
      if (
        ttsController.signal.aborted ||
        item.flowId !== activeFlowId ||
        isAbortError(error)
      ) {
        activeTtsControllers.delete(ttsController)
        activeTtsRequestCount = activeTtsControllers.size
        clearSpeechLoading(item.messageId)
        drainTtsQueue(item.flowId)
        return
      }

      synthesized = buildMockSpeechResult(normalizedSpeechText)
    }

    activeTtsControllers.delete(ttsController)
    activeTtsRequestCount = activeTtsControllers.size

    if (item.flowId !== activeFlowId) {
      speechSynthesisClient.revoke(synthesized)
      clearSpeechLoading(item.messageId)
      return
    }

    if (!getMessageById(item.messageId)) {
      speechSynthesisClient.revoke(synthesized)
      clearSpeechLoading(item.messageId)
      finishSpeechQueueIfReady(item.flowId)
      drainTtsQueue(item.flowId)
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
      updateMessageContent: item.updateMessageContent,
    })
    playbackQueue.sort((left, right) => left.sequence - right.sequence)
    drainPlaybackQueue(item.flowId)
    drainTtsQueue(item.flowId)
  }

  // 串行消费 TTS 合成队列，但允许 TTS 请求和当前音频播放并行。
  const drainTtsQueue = (flowId: number) => {
    if (flowId !== activeFlowId) {
      return
    }

    if (!ttsQueue.length) {
      finishSpeechQueueIfReady(flowId)
      return
    }

    while (
      activeTtsRequestCount < MAX_CONCURRENT_TTS_REQUESTS &&
      ttsQueue.length > 0
    ) {
      const nextItem = ttsQueue.shift()

      if (!nextItem) {
        break
      }

      if (nextItem.flowId !== activeFlowId) {
        continue
      }

      void synthesizeQueuedSpeech(nextItem)
    }
  }

  // 从最新 speechText 中切出新分段并加入 TTS 队列。
  const enqueueSpeechSegments = (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
    includeTail = false,
    updateMessageContent = true,
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
          updateMessageContent,
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
          updateMessageContent,
        })
        queuedSpeechEffectiveChars += tailEffectiveChars
      }
    }

    drainTtsQueue(flowId)
  }

  // 回复流结束时补齐尾段，并标记后续可在队列清空后结束流程。
  const finalizeSpeechFlow = (
    flowId: number,
    messageId: string,
    speechText: string,
    engine: DemoMessage['engine'],
  ) => {
    if (flowId !== activeFlowId) {
      return
    }

    replyStreamCompleted = true
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

  // 智能引导服务不可用时运行本地兜底问答流程。
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

  // 取消当前完整流程，覆盖智能引导、TTS、播放、录音和 UI 状态。
  const cancelCurrentFlow = (options: { persistHistory?: boolean } = {}) => {
    const shouldPersistHistory = options.persistHistory ?? true

    activeFlowId += 1
    activeVoiceStopId += 1
    clearFlowTimers()

    if (shouldPersistHistory) {
      settlePendingMessages()
    } else {
      messages.value.forEach((message) => {
        if (message.pending) {
          message.pending = false
        }
      })
    }

    cancelPendingGuide()
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

  // 将后端路由和查询参数转换为仅允许 http/https 的安全跳转卡片。
  const buildGuideRouteCard = (route: GuideSearchRoute | null) => {
    if (!route?.url) {
      return undefined
    }

    try {
      const targetUrl = new URL(route.url, window.location.origin)
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return undefined
      }

      Object.entries(route.params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return
        }

        if (Array.isArray(value)) {
          value.forEach((item) =>
            targetUrl.searchParams.append(key, String(item)),
          )
          return
        }

        if (typeof value !== 'object') {
          targetUrl.searchParams.set(key, String(value))
        }
      })

      return {
        title: route.title || targetUrl.href,
        url: targetUrl.href,
      }
    } catch {
      return undefined
    }
  }

  // 完成一段智能引导回复，并复用现有 TTS 分段、预取和顺序播放链路。
  const completeGuideReply = (
    flowId: number,
    messageId: string,
    markdown: string,
    messageOptions: Pick<
      DemoMessage,
      | 'conversationId'
      | 'routeCard'
      | 'suggestions'
      | 'projectContext'
      | 'requestMode'
    >,
  ) => {
    const parsedContent = parseReplyContent(markdown)
    const targetMessage = getMessageById(messageId)
    if (!targetMessage || flowId !== activeFlowId) {
      return false
    }

    targetMessage.routeCard = messageOptions.routeCard
    targetMessage.suggestions = messageOptions.suggestions
    targetMessage.projectContext = messageOptions.projectContext
    targetMessage.requestMode = messageOptions.requestMode
    updateAssistantMessage(messageId, parsedContent, {
      pending: false,
      engine: 'guide',
      conversationId: messageOptions.conversationId,
    })

    if (parsedContent.speechText) {
      finalizeSpeechFlow(flowId, messageId, parsedContent.speechText, 'guide')
      return true
    }

    replyStreamCompleted = true
    finishSpeechQueueIfReady(flowId)
    return Boolean(parsedContent.bodyMarkdown || messageOptions.routeCard)
  }

  // 发起一轮问答流程：智能引导文本、TTS 预合成和播放队列协同执行。
  const runReplyFlow = (
    question: string,
    source: DemoMessage['source'],
    options: ReplyFlowOptions = {},
  ) => {
    const projectContext =
      options.projectContext === undefined
        ? selectedProjectContext.value
        : options.projectContext
    const requestMode: DemoMessage['requestMode'] = projectContext
      ? 'project'
      : 'global'
    const reusableMessage = options.reuseMessageId
      ? getMessageById(options.reuseMessageId)
      : null
    const assistantMessage =
      reusableMessage?.role === 'assistant'
        ? reusableMessage
        : createMessage('assistant', THINKING_PLACEHOLDER, {
            pending: true,
            source,
            engine: 'guide',
            renderMode: 'markdown',
            thinkCollapsed: true,
            projectContext: projectContext ?? undefined,
            requestMode,
          })
    const flowId = activeFlowId + 1

    activeFlowId = flowId
    resetSpeechQueueState()
    clearSpeechProgress()
    currentAssistantMessageId = assistantMessage.id
    clearSpeechCompleted(assistantMessage.id)
    clearSpeechLoading(assistantMessage.id)
    setSpeechResult(null)

    if (reusableMessage?.role === 'assistant') {
      assistantMessage.content = THINKING_PLACEHOLDER
      assistantMessage.pending = true
      assistantMessage.source = source
      assistantMessage.engine = 'guide'
      assistantMessage.thinkContent = ''
      assistantMessage.thinkCollapsed = true
      assistantMessage.renderMode = 'markdown'
      assistantMessage.renderBlocks = undefined
      assistantMessage.routeCard = undefined
      assistantMessage.suggestions = undefined
      assistantMessage.projectContext = projectContext ?? undefined
      assistantMessage.requestMode = requestMode
    } else {
      messages.value.push(assistantMessage)
    }

    status.value = 'thinking'
    showInterruptButton.value = true

    const assistantMessageId = assistantMessage.id
    const guideController = new AbortController()
    activeGuideController = guideController

    void (async () => {
      try {
        if (projectContext) {
          const projectRequestConversationId = projectConversationId.value
          const isCurrentProjectContext = () =>
            selectedProjectContext.value?.commissionTaskId ===
              projectContext.commissionTaskId &&
            selectedProjectContext.value?.stage === projectContext.stage
          const result = await streamGuideProject(
            projectContext,
            question,
            projectRequestConversationId,
            {
              onConversationId: (nextConversationId) => {
                if (flowId === activeFlowId && isCurrentProjectContext()) {
                  projectConversationId.value = nextConversationId
                }
              },
              onText: (answer) => {
                if (flowId !== activeFlowId) {
                  return
                }

                const parsedContent = parseReplyContent(answer)
                updateAssistantMessage(assistantMessageId, parsedContent, {
                  pending: true,
                  engine: 'guide',
                  conversationId: projectRequestConversationId,
                })
                enqueueSpeechSegments(
                  flowId,
                  assistantMessageId,
                  parsedContent.speechText,
                  'guide',
                )
              },
            },
            guideController.signal,
          )
          if (flowId !== activeFlowId) {
            return
          }

          const nextProjectConversationId =
            result.conversationId || projectRequestConversationId
          if (isCurrentProjectContext()) {
            projectConversationId.value = nextProjectConversationId
          }
          if (!result.answer) {
            throw new Error('项目助手未返回回答内容')
          }

          completeGuideReply(flowId, assistantMessageId, result.answer, {
            conversationId: nextProjectConversationId,
            routeCard: undefined,
            suggestions: result.suggestions,
            projectContext,
            requestMode: 'project',
          })
          return
        }

        const searchResult = await searchGuide(
          question,
          conversationId.value,
          guideController.signal,
        )
        if (flowId !== activeFlowId) {
          return
        }

        conversationId.value =
          searchResult.conversationId || conversationId.value
        if (searchResult.intent === 'qa') {
          const streamResult = await streamGuideQa(
            question,
            conversationId.value,
            {
              onConversationId: (nextConversationId) => {
                if (flowId === activeFlowId) {
                  conversationId.value = nextConversationId
                }
              },
              onText: (answer) => {
                if (flowId !== activeFlowId) {
                  return
                }

                const parsedContent = parseReplyContent(answer)
                updateAssistantMessage(assistantMessageId, parsedContent, {
                  pending: true,
                  engine: 'guide',
                  conversationId: conversationId.value,
                })
                enqueueSpeechSegments(
                  flowId,
                  assistantMessageId,
                  parsedContent.speechText,
                  'guide',
                )
              },
            },
            guideController.signal,
          )
          if (flowId !== activeFlowId) {
            return
          }

          conversationId.value =
            streamResult.conversationId || conversationId.value
          completeGuideReply(flowId, assistantMessageId, streamResult.answer, {
            conversationId: conversationId.value,
            routeCard: undefined,
            suggestions: undefined,
            projectContext: undefined,
            requestMode: 'global',
          })
          return
        }

        const routeCard =
          searchResult.intent === 'navigation'
            ? buildGuideRouteCard(searchResult.route)
            : undefined
        const replyText = searchResult.description || routeCard?.title || ''
        if (!replyText) {
          throw new Error('智能引导未返回可展示内容')
        }

        completeGuideReply(flowId, assistantMessageId, replyText, {
          conversationId: conversationId.value,
          routeCard,
          suggestions: undefined,
          projectContext: undefined,
          requestMode: 'global',
        })
        if (searchResult.intent === 'recent_projects') {
          demoOptions.onOpenRecentProjects?.()
        }
      } catch (error) {
        if (
          flowId !== activeFlowId ||
          guideController.signal.aborted ||
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
        const partialSpeechText =
          streamSpeechText ||
          markdownToPlainText(latestBodyMarkdown || partialBody)

        if (partialSpeechText) {
          if (targetMessage) {
            targetMessage.pending = false
            targetMessage.engine = 'guide'
          }

          finalizeSpeechFlow(
            flowId,
            assistantMessageId,
            partialSpeechText,
            'guide',
          )
          return
        }

        await runFallbackReplyFlow(flowId, question, assistantMessageId)
      } finally {
        if (activeGuideController === guideController) {
          activeGuideController = null
        }
      }
    })()
  }

  // 发送文本问题，并在忙碌时先中断上一轮流程。
  const sendText = (
    rawText: string,
    source: DemoMessage['source'] = 'text',
  ) => {
    clearVoiceAutoSendTimer()
    const question = rawText.trim()
    if (!question) {
      return
    }

    // 服务端历史只用于回放；用户继续提问时从新的智能引导会话开始。
    if (isExternalHistorySnapshot) {
      resetToWelcome()
    }

    const projectContext = selectedProjectContext.value
    if (
      projectContext &&
      (!projectContext.stage || !projectContext.commissionTaskId)
    ) {
      showTransientInputHint('项目上下文不完整，请重新选择项目')
      return
    }

    if (
      isBusy.value ||
      isRecording.value ||
      isAwaitingVoiceRecognitionResult.value
    ) {
      cancelCurrentFlow()
    }

    clearInputHint()
    isExpanded.value = true
    messages.value.push(
      createMessage('user', question, {
        source,
        renderMode: 'plain',
        projectContext: projectContext ?? undefined,
        requestMode: projectContext ? 'project' : 'global',
      }),
    )
    inputText.value = ''
    runReplyFlow(question, source, { projectContext })
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
      clearInterruptState()
      inputText.value = question
      clearVoiceAutoSendTimer()
      voiceAutoSendTimerId = window.setTimeout(() => {
        voiceAutoSendTimerId = null

        if (
          voiceStopId !== activeVoiceStopId ||
          inputText.value.trim() !== question ||
          isRecording.value ||
          isBusy.value ||
          isAwaitingVoiceRecognitionResult.value
        ) {
          return
        }

        sendText(question, 'voice')
      }, VOICE_AUTO_SEND_DELAY_MS)
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
      nextPlaybackSequence = activePlaybackItem.sequence + 1
      completedSpeechEffectiveChars = activePlaybackItem.endEffectiveChar
      if (activePlaybackItem.updateMessageContent !== false) {
        displayedSpeechText = streamSpeechText
          .slice(0, activePlaybackItem.endIndex)
          .trim()

        const currentMessage = getMessageById(activePlaybackItem.messageId)
        if (currentMessage) {
          currentMessage.content = displayedSpeechText
        }
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
            Math.min(
              1,
              completedSpeechEffectiveChars / totalSpeechEffectiveChars,
            ),
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

    const playbackItem = activePlaybackItem
    if (playbackItem && playbackItem.updateMessageContent !== false) {
      syncVisibleSpeechText(playbackItem.messageId, nextProgress)
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

  // 找到当前回复前最近的用户问题，并用同一条 assistant 消息承载重新生成结果。
  const regenerateAssistantMessage = (messageId: string) => {
    const messageIndex = messages.value.findIndex(
      (message) => message.id === messageId,
    )
    const targetMessage = messages.value[messageIndex]

    if (messageIndex === -1 || targetMessage?.role !== 'assistant') {
      return
    }

    const sourceMessage = [...messages.value.slice(0, messageIndex)]
      .reverse()
      .find((message) => message.role === 'user' && message.content.trim())

    if (!sourceMessage) {
      showTransientInputHint('未找到可重新生成的问题')
      return
    }

    if (
      isBusy.value ||
      isRecording.value ||
      isAwaitingVoiceRecognitionResult.value
    ) {
      cancelCurrentFlow()
    }

    clearInputHint()
    isExpanded.value = true
    clearSpeechLoading(messageId)
    const projectContext = sourceMessage.projectContext ?? null
    if (projectContext) {
      const currentContext = selectedProjectContext.value
      if (
        !currentContext ||
        currentContext.commissionTaskId !== projectContext.commissionTaskId ||
        currentContext.stage !== projectContext.stage
      ) {
        projectConversationId.value = ''
      }
      selectedProjectContext.value = projectContext
    }
    runReplyFlow(
      sourceMessage.content,
      sourceMessage.source === 'voice' ? 'voice' : 'text',
      { reuseMessageId: messageId, projectContext },
    )
  }

  // 复用数字人 TTS 播放链路朗读单条已完成回复，不覆盖正文内容。
  const readMessageAloud = (messageId: string) => {
    const targetMessage = getMessageById(messageId)
    const speechText = targetMessage
      ? normalizeSpeechText(
          markdownToPlainText(targetMessage.content) || targetMessage.content,
        )
      : ''

    if (!targetMessage || targetMessage.role !== 'assistant' || !speechText) {
      return
    }

    clearSpeechLoading(messageId)

    if (
      isBusy.value ||
      isRecording.value ||
      isAwaitingVoiceRecognitionResult.value
    ) {
      cancelCurrentFlow()
    } else {
      cancelPendingSpeechSynthesis()
      resetSpeechQueueState()
      clearSpeechProgress()
      setSpeechResult(null)
    }

    const flowId = activeFlowId + 1
    activeFlowId = flowId
    currentAssistantMessageId = messageId
    latestBodyMarkdown = targetMessage.content
    replyStreamCompleted = true
    status.value = 'thinking'
    showInterruptButton.value = true

    enqueueSpeechSegments(
      flowId,
      messageId,
      speechText,
      targetMessage.engine ?? 'guide',
      true,
      false,
    )
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
    isExternalHistorySnapshot = false
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
    projectConversationId.value = ''
    selectedProjectContext.value = null
    speechCompletedMessageIds.value = []
    speechLoadingMessageId.value = ''
    cancelPendingGuide()
    cancelPendingSpeechSynthesis()
    resetSpeechQueueState()
    void speechRecognition.cancel()
    clearInterruptState()
    clearInputHint()
    setSpeechResult(null)
    clearSpeechProgress()
  }

  // 新建对话：清空消息、全局会话和项目附件上下文。
  const clearConversation = () => {
    cancelCurrentFlow({ persistHistory: false })
    resetToWelcome()
    isHistoryPanelOpen.value = false
  }

  // 装载智能引导服务端会话消息，仅用于只读回放，不写入 localStorage。
  const loadExternalConversationMessages = (
    externalMessages: DemoMessage[],
  ) => {
    cancelCurrentFlow({ persistHistory: false })
    messages.value = externalMessages.map((message) => ({
      ...message,
      pending: false,
      thinkCollapsed: message.thinkCollapsed ?? true,
      renderBlocks:
        message.role === 'assistant'
          ? splitMarkdownRenderBlocks(message.content)
          : undefined,
    }))
    conversationId.value = ''
    projectConversationId.value = ''
    selectedProjectContext.value = null
    inputText.value = ''
    // 远端回放不开放重新生成、反馈和朗读等会改变当前流程的消息动作。
    speechCompletedMessageIds.value = []
    speechLoadingMessageId.value = ''
    isExternalHistorySnapshot = true
    isHistoryPanelOpen.value = false
    status.value = 'idle'
  }

  // 选择项目后保留附件，切换到不同项目时重置项目会话。
  const attachProject = (project: GuideProjectCard) => {
    if (isExternalHistorySnapshot) {
      resetToWelcome()
    }

    const nextContext: GuideProjectContext = {
      todoId: project.todoId || project.id,
      commissionTaskId: project.commissionTaskId,
      projectName: project.projectName || project.title,
      stage: project.stage,
      stageName: project.stageName || project.taskTypeName,
    }
    const currentContext = selectedProjectContext.value
    const isSameProject =
      currentContext?.commissionTaskId === nextContext.commissionTaskId &&
      currentContext.stage === nextContext.stage

    if (
      isBusy.value ||
      isRecording.value ||
      isAwaitingVoiceRecognitionResult.value
    ) {
      cancelCurrentFlow()
    }

    if (!isSameProject) {
      projectConversationId.value = ''
    }
    selectedProjectContext.value = nextContext
    inputText.value = ''
    clearInputHint()
  }

  const removeProject = () => {
    selectedProjectContext.value = null
    projectConversationId.value = ''
    clearInputHint()
  }

  onBeforeUnmount(() => {
    clearFlowTimers()
    cancelPendingGuide()
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
    attachProject,
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
    isHistoryPanelOpen,
    isRecording,
    isSpeechSynthesizing,
    latestAssistantText,
    loadExternalConversationMessages,
    messages,
    readMessageAloud,
    regenerateAssistantMessage,
    removeProject,
    selectedProjectContext,
    sendText,
    showInterruptButton,
    speechCompletedMessageIds,
    speechResult,
    speechFollowHighlightIndex,
    speechFollowText,
    speechOverallProgress,
    speechPlaybackMessageId,
    speechPlaybackProgress,
    speechToken,
    speechLoadingMessageId,
    startVoiceInput,
    status,
    stopVoiceInput,
    submitInput,
    suggestions,
    toggleThinkVisibility,
  }
}
