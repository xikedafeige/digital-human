<template>
  <div class="video-stage" :class="`is-${state}`">
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

let visualTransitionId = 0

const waitForDrawableFrame = (video: HTMLVideoElement | null) =>
  new Promise<void>((resolve) => {
    if (!video || video.readyState >= 2) {
      resolve()
      return
    }

    let settled = false
    let fallbackTimer: number | null = null

    const cleanup = () => {
      video.removeEventListener('loadeddata', finish)
      video.removeEventListener('canplay', finish)

      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer)
      }
    }

    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve()
    }

    video.addEventListener('loadeddata', finish)
    video.addEventListener('canplay', finish)
    fallbackTimer = window.setTimeout(finish, 220)
  })

const syncVisualState = async (state: AvatarState) => {
  const transitionId = ++visualTransitionId
  const targetVideo = videoRefs[state]

  await playVideo(targetVideo, state !== 'idle')
  await waitForDrawableFrame(targetVideo)

  if (transitionId !== visualTransitionId) {
    return
  }

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
    if (transitionId === visualTransitionId) {
      visualState.value = state
    }
  })
}

const handleVideoReady = (state: AvatarState) => {
  readyStates[state] = true
  void playVideo(videoRefs[state])

  if (pendingState.value === state) {
    void syncVisualState(state)
  }
}

watch(
  () => props.state,
  (nextState) => {
    void syncVisualState(nextState)

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
  void syncVisualState(props.state)
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
  background: #fafaf8;
  border: 1px solid rgba(232, 232, 228, 0.95);
  box-shadow: 0 16px 36px rgba(94, 104, 120, 0.1);
}

.video-stage__media {
  position: absolute;
  inset: 0;
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
  transform: none;
  /* transition: opacity 180ms ease; */
  filter: none;
  will-change: opacity;
}

.video-stage__video.is-ready.is-active {
  opacity: 1;
  transform: none;
  filter: none;
}

.video-stage__badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(210, 222, 240, 0.86);
  box-shadow: 0 8px 18px rgba(92, 135, 204, 0.1);
  color: #3b4a66;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.video-stage__badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.video-stage__badge-dot.is-listening {
  background: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
}

.video-stage__badge-dot.is-thinking {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
}

.video-stage__badge-dot.is-speaking {
  background: #4f78ff;
  box-shadow: 0 0 0 3px rgba(79, 120, 255, 0.12);
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
    left: 10px;
    bottom: 10px;
    gap: 5px;
    padding: 5px 8px;
    font-size: 10px;
  }

  .video-stage__badge-dot {
    width: 5px;
    height: 5px;
  }
}
</style>
