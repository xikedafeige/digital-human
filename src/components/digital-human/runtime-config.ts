const readStringEnv = (value: string | undefined, fallback: string) => {
  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : fallback
}

const readNumberEnv = (value: string | undefined, fallback: number) => {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

const normalizePath = (value: string | undefined, fallback: string) => {
  const normalizedValue = readStringEnv(value, fallback)

  return normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`
}

export const DIGITAL_HUMAN_RUNTIME_CONFIG = {
  asrWsUrl: readStringEnv(import.meta.env.VITE_ASR_WS_URL, 'ws://192.168.113.44:8001/ws/recognize'),
  ttsBaseUrl: readStringEnv(import.meta.env.VITE_TTS_BASE_URL, 'http://192.168.113.44:8001'),
  ttsEndpoint: normalizePath(import.meta.env.VITE_TTS_ENDPOINT, '/v1/audio/speech'),
  ttsModel: readStringEnv(import.meta.env.VITE_TTS_MODEL, 'matcha-tts'),
  ttsVoice: readStringEnv(import.meta.env.VITE_TTS_VOICE, 'xiaoxiao'),
  ttsResponseFormat: readStringEnv(import.meta.env.VITE_TTS_RESPONSE_FORMAT, 'mp3'),
  ttsSpeed: readStringEnv(import.meta.env.VITE_TTS_SPEED, '1.0'),
  difyChatMessagesUrl: readStringEnv(
    import.meta.env.VITE_DIFY_CHAT_MESSAGES_URL,
    'https://copilot.sino-bridge.com:90/v1/chat-messages'
  ),
  difyStopMessageUrlTemplate: readStringEnv(
    import.meta.env.VITE_DIFY_STOP_MESSAGE_URL_TEMPLATE,
    'https://copilot.sino-bridge.com:90/v1/chat-messages/{task_id}/stop'
  ),
  difyApiKey: readStringEnv(import.meta.env.VITE_DIFY_API_KEY, ''),
  difyUserPrefix: readStringEnv(import.meta.env.VITE_DIFY_USER_PREFIX, 'digital-human-demo'),
  difyTimeoutMs: readNumberEnv(import.meta.env.VITE_DIFY_TIMEOUT_MS, 60000),
  videoSources: {
    idle: normalizePath(import.meta.env.VITE_VIDEO_IDLE_SRC, '/videos/等待1.mp4'),
    listening: normalizePath(import.meta.env.VITE_VIDEO_LISTENING_SRC, '/videos/思考1.mp4'),
    thinking: normalizePath(import.meta.env.VITE_VIDEO_THINKING_SRC, '/videos/思考1.mp4'),
    speaking: normalizePath(import.meta.env.VITE_VIDEO_SPEAKING_SRC, '/videos/说话2.mp4'),
  },
  responseTiming: {
    thinkingMs: readNumberEnv(import.meta.env.VITE_RESPONSE_THINKING_MS, 960),
    typingIntervalMs: readNumberEnv(import.meta.env.VITE_RESPONSE_TYPING_INTERVAL_MS, 24),
    speakingTailMs: readNumberEnv(import.meta.env.VITE_RESPONSE_SPEAKING_TAIL_MS, 420),
    minimumSpeakingMs: readNumberEnv(import.meta.env.VITE_RESPONSE_MIN_SPEAKING_MS, 1800),
    msPerCharacter: readNumberEnv(import.meta.env.VITE_RESPONSE_MS_PER_CHARACTER, 105),
  },
} as const

export const buildTtsEndpointUrl = () => {
  const baseUrl = DIGITAL_HUMAN_RUNTIME_CONFIG.ttsBaseUrl.replace(/\/+$/, '')
  const endpoint = DIGITAL_HUMAN_RUNTIME_CONFIG.ttsEndpoint.replace(/^\/+/, '')

  return `${baseUrl}/${endpoint}`
}

export const buildDifyStopMessageUrl = (taskId: string) =>
  DIGITAL_HUMAN_RUNTIME_CONFIG.difyStopMessageUrlTemplate.replace('{task_id}', encodeURIComponent(taskId))
