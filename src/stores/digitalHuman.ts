import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export interface Message {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
}

export type ChatStatus = 'idle' | 'listening' | 'thinking' | 'speaking'

const SUGGESTIONS = [
  '如何编制预算？',
  '事后评价的流程是什么？',
  '项目管理在哪里？'
]

const DEFAULT_GREETING = '您好，我是小婉！'
const VOICE_SAMPLES = [
  '请帮我介绍一下项目预算编制流程',
  '项目立项审批一般要看哪些信息？',
  '请告诉我事后评价需要准备什么材料'
]

const STATUS_BUFFER_MS = 150
const THINKING_DURATION_MS = 1200
const SPEAKING_DURATION_MS = 2850

export const useDigitalHumanStore = defineStore('digitalHuman', () => {
  const isExpanded = ref(false)
  const chatStatus = ref<ChatStatus>('idle')
  const messages = ref<Message[]>([])
  const isRecording = ref(false)
  const inputText = ref('')
  const voiceSampleIndex = ref(0)

  let flowTimers: number[] = []

  const suggestions = computed(() => SUGGESTIONS)

  const assistantText = computed(() => {
    const lastAssistantMessage = [...messages.value]
      .reverse()
      .find((message) => message.type === 'ai' || message.type === 'system')

    return lastAssistantMessage?.content ?? DEFAULT_GREETING
  })

  const statusText = computed(() => {
    switch (chatStatus.value) {
      case 'listening':
        return '正在倾听'
      case 'thinking':
        return '正在思考'
      case 'speaking':
        return '正在回答'
      default:
        return '等待唤醒'
    }
  })

  const clearFlowTimers = () => {
    flowTimers.forEach((timer) => window.clearTimeout(timer))
    flowTimers = []
  }

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      flowTimers = flowTimers.filter((item) => item !== timer)
      callback()
    }, delay)

    flowTimers.push(timer)
  }

  const addMessage = (type: Message['type'], content: string) => {
    const message: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      content,
      timestamp: new Date()
    }

    messages.value.push(message)
    return message
  }

  const setChatStatus = (status: ChatStatus) => {
    chatStatus.value = status
  }

  const expand = () => {
    isExpanded.value = true
  }

  const collapse = () => {
    isExpanded.value = false
    isRecording.value = false
    clearFlowTimers()
    setChatStatus('idle')
  }

  const buildReply = (question: string) => {
    if (question.includes('预算')) {
      return '预算编制通常从目标拆解、费用归集、口径确认和审批流配置四步开始，我可以继续给你拆到表单字段。'
    }

    if (question.includes('事后评价')) {
      return '事后评价一般包括资料归档、指标复盘、绩效评分和经验沉淀四个阶段，建议先准备项目结项与财务数据。'
    }

    if (question.includes('项目管理')) {
      return '项目管理入口通常放在业务工作台或项目中心，你可以先从立项、计划、执行、结项四个模块查看。'
    }

    if (question.includes('审批')) {
      return '审批场景建议重点展示流程节点、经办角色、时限规则和回退机制，这样最容易让使用者快速理解。'
    }

    return '我已经收到你的问题，可以继续结合预算、流程或项目管理场景，帮你输出更具体的回答。'
  }

  const sendMessage = (text: string) => {
    const question = text.trim()

    if (!question) {
      return
    }

    clearFlowTimers()
    isRecording.value = false

    addMessage('user', question)
    inputText.value = ''

    schedule(() => {
      setChatStatus('thinking')
    }, STATUS_BUFFER_MS)

    schedule(() => {
      addMessage('ai', buildReply(question))
      setChatStatus('speaking')
    }, STATUS_BUFFER_MS + THINKING_DURATION_MS + STATUS_BUFFER_MS)

    schedule(() => {
      setChatStatus('idle')
    }, STATUS_BUFFER_MS + THINKING_DURATION_MS + STATUS_BUFFER_MS + SPEAKING_DURATION_MS)
  }

  const startListening = () => {
    if (isRecording.value) {
      return
    }

    clearFlowTimers()
    isRecording.value = true
    setChatStatus('listening')
  }

  const stopListening = () => {
    if (!isRecording.value) {
      return
    }

    isRecording.value = false
    const sample = VOICE_SAMPLES[voiceSampleIndex.value % VOICE_SAMPLES.length]
    voiceSampleIndex.value += 1
    sendMessage(sample)
  }

  const clearMessages = () => {
    clearFlowTimers()
    messages.value = []
    inputText.value = ''
    isRecording.value = false
    setChatStatus('idle')
    initWelcome()
  }

  const initWelcome = () => {
    if (messages.value.length === 0) {
      addMessage('system', DEFAULT_GREETING)
    }
  }

  const destroy = () => {
    clearFlowTimers()
  }

  return {
    assistantText,
    chatStatus,
    clearMessages,
    collapse,
    destroy,
    expand,
    inputText,
    initWelcome,
    isExpanded,
    isRecording,
    messages,
    sendMessage,
    setChatStatus,
    startListening,
    statusText,
    stopListening,
    suggestions
  }
})
