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
