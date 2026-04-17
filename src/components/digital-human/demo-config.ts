import type {
  AvatarState,
  AvatarVisemeCode,
  DemoMessage,
  SpeechSynthesisResult,
  SpeechViseme,
} from './avatar-types'

export type DigitalHumanStatus = AvatarState
export type { DemoMessage }

export const DIGITAL_HUMAN_SUGGESTIONS = [
  '如何快速了解预算绩效流程？',
  '项目立项审批要准备哪些内容？',
  '事后评价一般分几步完成？',
  '系统管理入口通常在哪里？',
]

export const VOICE_PROMPTS = [
  '请帮我介绍一下预算绩效的工作流程。',
  '我想知道项目管理模块一般从哪里进入。',
  '请告诉我事后评价要准备哪些资料。',
]

export const SYSTEM_WELCOME =
  '你好，我是数字人小助手，可以为你演示智能问答、实时发声、状态切换和基础语音交互流程。'

export const RESPONSE_TIMING = {
  thinkingMs: 960,
  typingIntervalMs: 22,
  speakingTailMs: 420,
  minimumSpeakingMs: 1800,
  msPerCharacter: 105,
  visemeStepMs: 96,
}

const REPLY_LIBRARY = [
  {
    keywords: ['预算', '绩效'],
    reply:
      '预算绩效通常可以按目标拆解、预算编制、执行跟踪、绩效评价四个阶段来理解。当前展示版先演示问答与状态切换，后续可以接入真实业务知识库。',
  },
  {
    keywords: ['立项', '审批'],
    reply:
      '项目立项审批一般需要准备项目背景、目标、预算明细、时间计划和审批流角色信息。后续接入真实接口后，可以进一步联动表单或系统菜单。',
  },
  {
    keywords: ['事后评价', '评价'],
    reply:
      '事后评价通常包含资料归档、指标复盘、结果分析和改进建议四部分。当前版本会先模拟数字人思考与说话状态，帮助确认前端交互形态。',
  },
  {
    keywords: ['系统管理', '入口', '模块'],
    reply:
      '系统管理入口通常会放在导航栏右侧或工作台首页的高频模块区域。当前方案优先落一个可独立展示的助手组件，方便后续嵌入真实后台。',
  },
]

const ENERGY_VISEME_CODES: AvatarVisemeCode[] = ['A', 'E', 'O', 'U', 'FV', 'L', 'MBP']

const pickVisemeCode = (character: string, index: number): AvatarVisemeCode => {
  if (/[mbpf]/i.test(character)) {
    return 'MBP'
  }

  if (/[ou]/i.test(character)) {
    return 'O'
  }

  if (/[ei]/i.test(character)) {
    return 'E'
  }

  if (/[fv]/i.test(character)) {
    return 'FV'
  }

  if (/[lnr]/i.test(character)) {
    return 'L'
  }

  return ENERGY_VISEME_CODES[index % ENERGY_VISEME_CODES.length]
}

export const buildMockSpeechResult = (text: string): SpeechSynthesisResult => {
  const normalizedText = text.trim()
  const baseDuration = Math.max(
    RESPONSE_TIMING.minimumSpeakingMs,
    normalizedText.length * RESPONSE_TIMING.msPerCharacter
  )
  const startPadding = 120
  const endPadding = 180
  const characters = normalizedText.replace(/\s+/g, '').split('')
  const visemes: SpeechViseme[] = []

  if (characters.length > 0) {
    const availableSpeakingMs = Math.max(
      RESPONSE_TIMING.visemeStepMs,
      baseDuration - startPadding - endPadding
    )
    const durationPerCharacter = Math.max(
      RESPONSE_TIMING.visemeStepMs,
      Math.floor(availableSpeakingMs / characters.length)
    )

    let cursor = startPadding
    characters.forEach((character, index) => {
      const nextCursor = Math.min(baseDuration - endPadding, cursor + durationPerCharacter)
      visemes.push({
        startMs: cursor,
        endMs: nextCursor,
        code: pickVisemeCode(character, index),
      })
      cursor = nextCursor
    })
  }

  return {
    text: normalizedText,
    audioUrl: '',
    durationMs: baseDuration,
    visemes,
    playbackMode: 'energy',
    generatedAt: Date.now(),
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
