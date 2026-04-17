import type { AvatarState } from './avatar-types'

export const VIDEO_POSTER_URL = '/digital-human/avatar.jpg'
export const VIDEO_RUNTIME_LABEL = 'Video Runtime'

export const VIDEO_STAGE_SOURCES: Record<AvatarState, string> = {
  idle: '/digital-human/idle.mp4',
  listening: '/digital-human/listening.mp4',
  thinking: '/digital-human/thinking.mp4',
  speaking: '/digital-human/speaking.mp4',
}

export const VIDEO_STATUS_LABELS: Record<AvatarState, string> = {
  idle: '在线待命',
  listening: '正在聆听',
  thinking: '正在思考',
  speaking: '正在回答',
}
