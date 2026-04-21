<template>
  <div class="video-stage" :class="`is-${state}`">
    <div class="video-stage__backdrop">
      <div class="video-stage__glow"></div>
      <div class="video-stage__grid"></div>
      <div class="video-stage__floor"></div>
    </div>

    <div class="video-stage__media">
      <video
        v-for="stageState in stageStates"
        :key="stageState"
        :ref="(element) => setVideoRef(stageState, element as HTMLVideoElement | null)"
        class="video-stage__video"
        :class="{
          'is-active': visualState === stageState,
          'is-ready': readyStates[stageState],
        }"
        :src="resolvedVideoSources[stageState]"
        muted
        loop
        autoplay
        playsinline
        preload="auto"
        @canplay="handleVideoReady(stageState)"
      ></video>

      <div v-if="!activeVideoReady" class="video-stage__fallback">
        <img class="video-stage__fallback-image" :src="posterUrl" alt="" />
      </div>
    </div>

    <div class="video-stage__badge">
      <span class="video-stage__badge-dot" :class="`is-${state}`"></span>
      <span>{{ statusLabel }}</span>
      <em>{{ runtimeLabel }}</em>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { AvatarState, SpeechSynthesisResult } from './avatar-types'
import {
  VIDEO_POSTER_URL,
  VIDEO_RUNTIME_LABEL,
  VIDEO_STAGE_SOURCES,
  VIDEO_STATUS_LABELS,
} from './video-avatar-config'

interface Props {
  state: AvatarState
  speechResult?: SpeechSynthesisResult | null
  autoplayToken?: number
  posterUrl?: string
  runtimeLabel?: string
  videoSources?: Partial<Record<AvatarState, string>>
}

const props = withDefaults(defineProps<Props>(), {
  speechResult: null,
  autoplayToken: 0,
  posterUrl: VIDEO_POSTER_URL,
  runtimeLabel: VIDEO_RUNTIME_LABEL,
  videoSources: () => VIDEO_STAGE_SOURCES,
})

const emit = defineEmits<{
  (e: 'speech-complete'): void
}>()

const stageStates: AvatarState[] = ['idle', 'listening', 'thinking', 'speaking']
const readyStates = reactive<Record<AvatarState, boolean>>({
  idle: false,
  listening: false,
  thinking: false,
  speaking: false,
})
const videoRefs = reactive<Record<AvatarState, HTMLVideoElement | null>>({
  idle: null,
  listening: null,
  thinking: null,
  speaking: null,
})
const visualState = ref<AvatarState>('idle')
const pendingState = ref<AvatarState | null>(null)

let playbackSessionId = 0
let speechTimerId: number | null = null
let activeUtterance: SpeechSynthesisUtterance | null = null

const resolvedVideoSources = computed<Record<AvatarState, string>>(() => ({
  ...VIDEO_STAGE_SOURCES,
  ...props.videoSources,
}))
const activeVideoReady = computed(() => readyStates[visualState.value])
const statusLabel = computed(() => VIDEO_STATUS_LABELS[props.state])

const clearSpeechTimer = () => {
  if (speechTimerId !== null) {
    window.clearTimeout(speechTimerId)
    speechTimerId = null
  }
}

const cleanupUtterance = () => {
  if (!activeUtterance) {
    return
  }

  activeUtterance.onend = null
  activeUtterance.onerror = null
  activeUtterance = null
}

const stopSpeechPlayback = () => {
  playbackSessionId += 1
  clearSpeechTimer()
  cleanupUtterance()

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

const finishSpeechPlayback = (sessionId: number) => {
  if (sessionId !== playbackSessionId) {
    return
  }

  stopSpeechPlayback()
  emit('speech-complete')
}

const startSpeechPlayback = async (speech: SpeechSynthesisResult) => {
  stopSpeechPlayback()
  const sessionId = playbackSessionId

  speechTimerId = window.setTimeout(() => {
    finishSpeechPlayback(sessionId)
  }, speech.durationMs + 900)

  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !speech.text.trim()) {
    return
  }

  try {
    const utterance = new SpeechSynthesisUtterance(speech.text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onend = () => finishSpeechPlayback(sessionId)
    utterance.onerror = () => finishSpeechPlayback(sessionId)
    activeUtterance = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } catch {
    cleanupUtterance()
  }
}

const setVideoRef = (state: AvatarState, element: HTMLVideoElement | null) => {
  videoRefs[state] = element
}

const playVideo = async (video: HTMLVideoElement | null, restart = false) => {
  if (!video) {
    return
  }

  if (restart) {
    try {
      video.currentTime = 0
    } catch {
      // Ignore currentTime reset errors before metadata is ready.
    }
  }

  try {
    await video.play()
  } catch {
    // Muted autoplay still depends on the browser policy and interaction timing.
  }
}

const playAllVideos = () => {
  stageStates.forEach((stageState) => {
    void playVideo(videoRefs[stageState])
  })
}

const syncVisualState = (state: AvatarState) => {
  void playVideo(videoRefs[state], state !== 'idle')

  if (state === visualState.value) {
    pendingState.value = null
    return
  }

  if (!readyStates[state]) {
    pendingState.value = state
    return
  }

  pendingState.value = null
  window.requestAnimationFrame(() => {
    visualState.value = state
  })
}

const handleVideoReady = (state: AvatarState) => {
  readyStates[state] = true
  void playVideo(videoRefs[state])

  if (pendingState.value === state) {
    syncVisualState(state)
  }
}

watch(
  () => props.state,
  (nextState) => {
    syncVisualState(nextState)

    if (nextState !== 'speaking') {
      stopSpeechPlayback()
    }
  },
  { immediate: true }
)

watch(
  () => props.autoplayToken,
  (nextToken, previousToken) => {
    if (!nextToken || nextToken === previousToken || props.state !== 'speaking' || !props.speechResult) {
      return
    }

    void startSpeechPlayback(props.speechResult)
  }
)

onMounted(() => {
  visualState.value = props.state
  playAllVideos()
  syncVisualState(props.state)
})

onBeforeUnmount(() => {
  stopSpeechPlayback()
})
</script>

<style scoped>
.video-stage {
  position: relative;
  min-height: clamp(210px, 34dvh, 330px);
  height: 100%;
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.96), rgba(228, 239, 255, 0.96) 38%, rgba(195, 218, 249, 0.96) 100%);
  border: 1px solid rgba(185, 210, 247, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 16px 36px rgba(94, 138, 214, 0.18);
}

.video-stage__backdrop,
.video-stage__media,
.video-stage__fallback {
  position: absolute;
  inset: 0;
}

.video-stage__backdrop {
  pointer-events: none;
}

.video-stage__glow {
  position: absolute;
  inset: 14% 18% auto;
  height: 44%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.94), transparent 74%);
  filter: blur(18px);
}

.video-stage__grid {
  position: absolute;
  inset: auto 0 0;
  height: 38%;
  background:
    linear-gradient(transparent 0, rgba(255, 255, 255, 0.3) 100%),
    repeating-linear-gradient(90deg, rgba(88, 143, 230, 0.11) 0 1px, transparent 1px 36px),
    repeating-linear-gradient(0deg, rgba(88, 143, 230, 0.11) 0 1px, transparent 1px 28px);
  mask-image: linear-gradient(180deg, transparent, #000 18%);
}

.video-stage__floor {
  position: absolute;
  inset: auto 16% 10%;
  height: 42px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(86, 138, 220, 0.22), rgba(86, 138, 220, 0.04) 62%, transparent 78%);
  filter: blur(10px);
}

.video-stage__media {
  overflow: hidden;
}

.video-stage__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  opacity: 0;
  transform: translate3d(0, 18px, 0) scale(1.04);
  transition:
    opacity 360ms ease,
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 360ms ease;
  filter: blur(12px) saturate(0.96);
}

.video-stage__video.is-ready.is-active {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
  filter: blur(0) saturate(1);
}

.video-stage__fallback {
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.58));
}

.video-stage__fallback-image {
  width: min(78%, 320px);
  max-height: 88%;
  object-fit: contain;
  filter: drop-shadow(0 20px 42px rgba(96, 135, 204, 0.22));
}

.video-stage__badge {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(193, 214, 248, 0.95);
  box-shadow: 0 12px 30px rgba(92, 135, 204, 0.16);
  color: #3b4a66;
  font-size: 12px;
  font-weight: 600;
}

.video-stage__badge-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12);
}

.video-stage__badge-dot.is-listening {
  background: #38bdf8;
  box-shadow: 0 0 0 5px rgba(56, 189, 248, 0.14);
}

.video-stage__badge-dot.is-thinking {
  background: #f59e0b;
  box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.14);
}

.video-stage__badge-dot.is-speaking {
  background: #4f78ff;
  box-shadow: 0 0 0 5px rgba(79, 120, 255, 0.14);
}

.video-stage__badge em {
  font-style: normal;
  color: #5d86ef;
}

@media (max-height: 820px) and (min-width: 641px) {
  .video-stage {
    border-radius: 22px;
  }

  .video-stage__badge {
    left: 12px;
    bottom: 12px;
    gap: 7px;
    padding: 7px 10px;
    font-size: 11px;
  }

  .video-stage__badge-dot {
    width: 8px;
    height: 8px;
  }
}
</style>
