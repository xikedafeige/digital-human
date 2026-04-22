/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASR_WS_URL?: string
  readonly VITE_TTS_BASE_URL?: string
  readonly VITE_TTS_ENDPOINT?: string
  readonly VITE_TTS_MODEL?: string
  readonly VITE_TTS_VOICE?: string
  readonly VITE_TTS_RESPONSE_FORMAT?: string
  readonly VITE_TTS_SPEED?: string
  readonly VITE_VIDEO_IDLE_SRC?: string
  readonly VITE_VIDEO_LISTENING_SRC?: string
  readonly VITE_VIDEO_THINKING_SRC?: string
  readonly VITE_VIDEO_SPEAKING_SRC?: string
  readonly VITE_RESPONSE_THINKING_MS?: string
  readonly VITE_RESPONSE_TYPING_INTERVAL_MS?: string
  readonly VITE_RESPONSE_SPEAKING_TAIL_MS?: string
  readonly VITE_RESPONSE_MIN_SPEAKING_MS?: string
  readonly VITE_RESPONSE_MS_PER_CHARACTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
