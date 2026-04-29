// 数字人模块通用类型定义，集中描述状态、消息和语音播放结果。
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageSource = 'text' | 'voice' | 'system'
export type AvatarVisemeCode = 'sil' | 'A' | 'E' | 'O' | 'U' | 'FV' | 'L' | 'MBP'
export type SpeechPlaybackMode = 'energy' | 'viseme'

export interface DemoMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  pending?: boolean
  source?: MessageSource
  engine?: 'dify' | 'fallback'
  conversationId?: string
  thinkContent?: string
  thinkCollapsed?: boolean
  renderMode?: 'plain' | 'markdown'
}

export interface ConversationHistory {
  id: string
  difyConversationId?: string
  title: string
  messages: DemoMessage[]
  createdAt: number
  updatedAt: number
}

export interface SpeechViseme {
  startMs: number
  endMs: number
  code: AvatarVisemeCode
}

export interface SpeechSynthesisResult {
  text: string
  audioUrl: string
  durationMs: number
  visemes?: SpeechViseme[]
  playbackMode: SpeechPlaybackMode
  generatedAt: number
}
