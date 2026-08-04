// 数字人演示配置，提供快捷建议、欢迎语和本地兜底回复。
import type { DemoMessage, SpeechSynthesisResult } from '@/types/avatar-types'
import { DIGITAL_HUMAN_RUNTIME_CONFIG } from '@/config/runtime-config'

export type DigitalHumanStatus = 'idle' | 'listening' | 'thinking' | 'speaking'
export type { DemoMessage }

export const DIGITAL_HUMAN_SUGGESTIONS = [
  '事后评价怎么操作？',
  '目标申报任务列表在哪里？',
  '绩效评价流程是什么？',
  '系统管理入口在哪里？',
]

export type DigitalHumanAgentIcon =
  | 'college'
  | 'elderly-care'
  | 'policy-radar'
  | 'budget-allocation'
  | 'project-risk'
  | 'fiscal-policy'

export interface DigitalHumanAgentOption {
  value: string
  label: string
  description: string
  icon: DigitalHumanAgentIcon
  disabled?: boolean
}

export interface DigitalHumanAgentGroup {
  label: string
  icon: 'industry' | 'decision'
  options: DigitalHumanAgentOption[]
}

export const DIGITAL_HUMAN_AGENTS: DigitalHumanAgentGroup[] = [
  {
    label: '行业绩效智能体',
    icon: 'industry',
    options: [
      {
        value: 'higher-education-performance',
        label: '高职院校绩效智算智能体',
        description: '高职院校 · 行业绩效',
        icon: 'college',
      },
      {
        value: 'elderly-care-performance',
        label: '养老绩效智算智能体',
        description: '养老行业 · 服务绩效',
        icon: 'elderly-care',
        disabled: true,
      },
    ],
  },
  {
    label: '决策支持智能体',
    icon: 'decision',
    options: [
      {
        value: 'policy-radar',
        label: '政策雷达智能体',
        description: '政策雷达 · 税收优惠',
        icon: 'policy-radar',
        disabled: true,
      },
      {
        value: 'budget-allocation',
        label: '资金预算分配建议智能体',
        description: '政府决策 · 预算',
        icon: 'budget-allocation',
        disabled: true,
      },
      {
        value: 'project-risk',
        label: '项目风险预警智能体',
        description: '风险预警 · 过程监控',
        icon: 'project-risk',
        disabled: true,
      },
      {
        value: 'fiscal-policy',
        label: '财政政策分析智能体',
        description: '财政政策 · 政策解读',
        icon: 'fiscal-policy',
        disabled: true,
      },
    ],
  },
]

export const DIGITAL_HUMAN_DEVELOPMENT_NOTICE = '当前功能正在开发中...'

export const DIGITAL_HUMAN_TODO_FILTERS = [
  '全部任务',
  '事前',
  '事中',
  '绩效目标',
  '事后',
  '其他',
]

export const DIGITAL_HUMAN_TODOS = [
  {
    id: 1,
    title: 'xx绩效任务-xxx项目名称',
    time: '10:04',
    level: '紧急',
    actions: ['提问', '审核', '问数'],
  },
  {
    id: 2,
    title: 'xx绩效任务-xxx项目名称',
    time: '10:04',
    level: '普通',
    actions: ['提问', '写报告', '审核', '问数'],
  },
  {
    id: 3,
    title: 'xx绩效任务-xxx项目名称',
    time: '10:04',
    level: '普通',
    actions: ['提问', '写报告', '审核', '问数'],
  },
]

export const DIGITAL_HUMAN_BOARD_TASKS = [
  { id: 1, title: 'xxx项目名称', progress: 50 },
  { id: 2, title: 'xxx项目名称', progress: 50 },
]

export const SYSTEM_WELCOME =
  '你好，我是数字人小助，当前版本支持文本问答、语音输入、流式回复和语音播报。'

export const RESPONSE_TIMING = {
  ...DIGITAL_HUMAN_RUNTIME_CONFIG.responseTiming,
}

const REPLY_LIBRARY = [
  {
    keywords: ['预算', '绩效'],
    reply: '',
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

// 构造本地模拟语音结果，用于 TTS 失败时保持播报流程可继续。
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

// 根据关键词生成本地兜底回复，避免外部服务失败时面板无响应。
export function buildDemoReply(question: string) {
  const normalizedQuestion = question.trim()

  const matchedReply = REPLY_LIBRARY.find((item) =>
    item.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  )

  return matchedReply?.reply ?? ''
}
