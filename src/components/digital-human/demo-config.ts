export type DigitalHumanStatus = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MessageRole = 'user' | 'assistant' | 'system'

export interface DemoMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
}

export const DIGITAL_HUMAN_ASSETS = {
  avatar: '/digital-human/avatar.jpg',
  videos: {
    idle: '/digital-human/idle.mp4',
    listening: '/digital-human/listening.mp4',
    thinking: '/digital-human/thinking.mp4',
    speaking: '/digital-human/speaking.mp4'
  }
} as const

export const DIGITAL_HUMAN_SUGGESTIONS = [
  '如何快速了解预算绩效流程？',
  '项目立项审批要准备哪些内容？',
  '事后评价一般分几步完成？',
  '系统管理入口通常在哪里？'
]

export const VOICE_PROMPTS = [
  '请帮我介绍一下预算绩效的工作流程。',
  '我想知道项目管理模块一般从哪里进入。',
  '请告诉我事后评价要准备哪些资料。'
]

export const SYSTEM_WELCOME =
  '你好，我是数字人小婉，可以为你演示智能问答、状态切换和基础交互流程。'

export const RESPONSE_TIMING = {
  thinkingMs: 900,
  typingIntervalMs: 24,
  speakingTailMs: 520
}

const REPLY_LIBRARY = [
  {
    keywords: ['预算', '绩效'],
    reply:
      '预算绩效通常可以按目标拆解、预算编制、执行跟踪、绩效评价四个阶段来理解。当前展示版先演示问答与状态切换，后续可以接入真实业务知识库。'
  },
  {
    keywords: ['立项', '审批'],
    reply:
      '项目立项审批一般需要准备项目背景、目标、预算明细、时间计划和审批流角色信息。后续接入真实接口后，可以进一步联动表单或系统菜单。'
  },
  {
    keywords: ['事后评价', '评价'],
    reply:
      '事后评价通常包含资料归档、指标复盘、结果分析和改进建议四部分。展示版会先模拟数字人思考与说话状态，帮助确认前端交互形态。'
  },
  {
    keywords: ['系统管理', '入口', '模块'],
    reply:
      '系统管理入口通常会放在导航栏右侧或工作台首页的高频模块区域。当前方案优先落一个可独立展示的助手组件，方便后续嵌入真实后台。'
  }
]

export const VIDEO_FRAME_VARS: Record<DigitalHumanStatus, Record<string, string>> = {
  idle: {
    '--video-object-position': '50% 52%',
    '--video-scale': '1'
  },
  listening: {
    '--video-object-position': '50% 52%',
    '--video-scale': '1'
  },
  thinking: {
    '--video-object-position': '50% 52%',
    '--video-scale': '1'
  },
  speaking: {
    '--video-object-position': '52% 53%',
    '--video-scale': '0.96'
  }
}

export function buildDemoReply(question: string) {
  const normalizedQuestion = question.trim()

  const matchedReply = REPLY_LIBRARY.find((item) =>
    item.keywords.some((keyword) => normalizedQuestion.includes(keyword))
  )

  return (
    matchedReply?.reply ??
    '我已经收到你的问题。当前版本是前端展示版，会用本地演示数据完成一次数字人应答流程，后续可以继续接入真实的 ASR、TTS 和大模型能力。'
  )
}
