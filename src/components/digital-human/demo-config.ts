import type { DemoMessage, SpeechSynthesisResult } from './avatar-types'
import { DIGITAL_HUMAN_RUNTIME_CONFIG } from './runtime-config'

export type DigitalHumanStatus = 'idle' | 'listening' | 'thinking' | 'speaking'
export type { DemoMessage }

export const DIGITAL_HUMAN_SUGGESTIONS = [
  '如何快速了解预算绩效流程？',
  '项目立项审批要准备哪些内容？',
  '事后评价一般分几步完成？',
  '系统管理入口通常在哪？',
]

export const SYSTEM_WELCOME =
  '你好，我是数字人小助，当前版本支持文本问答、语音输入、流式回复和语音播报。'

export const RESPONSE_TIMING = {
  ...DIGITAL_HUMAN_RUNTIME_CONFIG.responseTiming,
}

const REPLY_LIBRARY = [
  {
    keywords: ['预算', '绩效'],
    reply:
      '预算绩效通常可以按目标拆解、预算编制、执行跟踪和结果评价四个阶段来理解。当前演示版先聚焦数字人交互链路，后续可以继续接入真实知识库和业务接口。',
  },
  {
    keywords: ['立项', '审批'],
    reply:
      '项目立项审批一般需要准备项目背景、目标、预算明细、时间安排和审批角色信息。等正式接口接入后，数字人可以继续联动表单、菜单和审批流节点。',
  },
  {
    keywords: ['事后评价', '评价'],
    reply:
      '事后评价通常包含资料归档、指标复盘、结果分析和改进建议四部分。当前版本会先模拟数字人回复链路，方便你确认前端交互体验。',
  },
  {
    keywords: ['系统管理', '入口', '模块'],
    reply:
      '系统管理入口通常会放在导航栏右侧或工作台首页的高频模块区域。当前方案优先落成一个独立数字人助手，方便后续嵌入真实后台页面。',
  },
]

export const buildMockSpeechResult = (text: string): SpeechSynthesisResult => {
  const normalizedText = text.trim()
  const baseDuration = Math.max(
    RESPONSE_TIMING.minimumSpeakingMs,
    normalizedText.length * RESPONSE_TIMING.msPerCharacter,
  )

  return {
    text: normalizedText,
    audioUrl: '',
    durationMs: baseDuration,
    playbackMode: 'energy',
    generatedAt: Date.now(),
  }
}

export function buildDemoReply(question: string) {
  const normalizedQuestion = question.trim()

  const matchedReply = REPLY_LIBRARY.find((item) =>
    item.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  )

  return (
    matchedReply?.reply ??
    '我已经收到你的问题。当前版本会先用本地模拟数据跑通数字人问答流程，后续可以继续接入真实的 ASR、TTS 和大模型能力。'
  )
}
