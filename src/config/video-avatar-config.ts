// 数字人视频舞台配置，负责状态视频资源和状态文案映射。
import type { AvatarState } from '@/types/avatar-types'
import { DIGITAL_HUMAN_RUNTIME_CONFIG } from '@/config/runtime-config'

export const VIDEO_STAGE_SOURCES: Record<AvatarState, string> = {
  ...DIGITAL_HUMAN_RUNTIME_CONFIG.videoSources,
}

export const VIDEO_STATUS_LABELS: Record<AvatarState, string> = {
  idle: '在线待命',
  listening: '正在聆听',
  thinking: '思考中',
  speaking: '正在回答',
}
