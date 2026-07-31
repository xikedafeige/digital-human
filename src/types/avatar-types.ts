// 数字人模块通用类型定义，集中描述状态、消息和语音播放结果。
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageSource = 'text' | 'voice' | 'system'
export type GuideProjectStage =
  | 'target_declaration'
  | 'pre_evaluation'
  | 'mid_monitoring'
  | 'post_evaluation'
export type AvatarVisemeCode = 'sil' | 'A' | 'E' | 'O' | 'U' | 'FV' | 'L' | 'MBP'
export type SpeechPlaybackMode = 'energy' | 'viseme'

export interface GuideProjectContext {
  todoId: string
  commissionTaskId: string
  projectName: string
  stage: GuideProjectStage | ''
  stageName: string
}

export interface GuideRouteCard {
  title: string
  url: string
  description?: string
}

export interface GuideCooperationItem {
  title: string
  content: string
  score?: number | null
  downloadUrl?: string
  metadata?: Record<string, unknown>
}

export interface GuideDisambiguationCandidate {
  id: string
  label: string
  intent: string
  subIntent: string
  routeId: string
  keyword: string
}

export interface GuideProjectMetric {
  label: string
  value: string
}

export interface GuideProjectSubtask {
  name: string
  statusText: string
  pointName?: string
  score?: string
}

export interface GuideProjectPoint {
  name: string
  statusText: string
}

export interface GuideProjectCard {
  id: string
  todoId: string
  title: string
  projectName: string
  taskType: number | null
  taskTypeName: string
  todoCategory: string
  currentStageName: string
  time: string
  deadline: string
  initiatorName: string
  createTime: string
  durationDesc: string
  statusText: string
  actions: string[]
  isUrgent: boolean
  source: 'recent' | 'todo' | 'query'
  commissionTaskId: string
  stage: GuideProjectStage | ''
  stageName: string
  chargePersonName?: string
  metrics?: GuideProjectMetric[]
  subtaskCount?: number | null
  subtasks?: GuideProjectSubtask[]
  pointCount?: number | null
  points?: GuideProjectPoint[]
  scope?: string
  dimension?: string
  dimensionName?: string
  raw: Record<string, unknown>
}

export type MessageRenderBlock =
  | {
      type: 'markdown'
      id: string
      content: string
    }
  | {
      type: 'echarts'
      id: string
      option: Record<string, unknown>
      raw: string
    }

export interface DemoMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  pending?: boolean
  source?: MessageSource
  engine?: 'dify' | 'guide' | 'fallback'
  conversationId?: string
  thinkContent?: string
  thinkCollapsed?: boolean
  renderMode?: 'plain' | 'markdown'
  renderBlocks?: MessageRenderBlock[]
  routeCard?: GuideRouteCard
  suggestions?: string[]
  cooperationItems?: GuideCooperationItem[]
  queryProjects?: GuideProjectCard[]
  disambiguationCandidates?: GuideDisambiguationCandidate[]
  disambiguationQuery?: string
  selectedDisambiguationCandidateId?: string
  projectContext?: GuideProjectContext
  requestMode?: 'global' | 'project'
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
