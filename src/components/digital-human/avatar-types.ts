export type AvatarRuntime = 'video' | 'live2d'
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type AvatarRestState = Exclude<AvatarState, 'speaking'>
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

export interface Live2DMotionRef {
  group: string
  index?: number
}

export interface Live2DLayoutConfig {
  x: number
  y: number
  scale: number
  anchorX: number
  anchorY: number
}

export interface Live2DParameterConfig {
  mouthOpenY: string
  mouthForm?: string
  angleX?: string
  angleY?: string
  angleZ?: string
  bodyAngleX?: string
  eyeBallX?: string
  eyeBallY?: string
}

export interface Live2DAvatarManifest {
  version: string
  runtime: 'live2d'
  coreScriptUrl: string
  modelUrl: string
  textures: string[]
  motions: Record<AvatarRestState, Live2DMotionRef> & {
    speakingBase: Live2DMotionRef
  }
  expressions: string[]
  layout: Live2DLayoutConfig
  parameters: Live2DParameterConfig
  fallbackPosterUrl?: string
}

export type AvatarManifest = Live2DAvatarManifest
