<!-- 数字人视频舞台组件，负责状态视频切换、语音播放和播放进度回传。 -->
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { AvatarState, SpeechSynthesisResult } from '@/types/avatar-types'
import {
  VIDEO_STAGE_SOURCES,
  VIDEO_STATUS_LABELS,
} from '@/config/video-avatar-config'

interface Props {
  state: AvatarState
  speechResult?: SpeechSynthesisResult | null
  autoplayToken?: number
  videoSources?: Partial<Record<AvatarState, string>>
}

const props = withDefaults(defineProps<Props>(), {
  speechResult: null,
  autoplayToken: 0,
  videoSources: () => VIDEO_STAGE_SOURCES,
})

const emit = defineEmits<{
  (e: 'speech-complete'): void
  (e: 'speech-progress', progress: number): void
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
let speechProgressTimerId: number | null = null
let activeAudio: HTMLAudioElement | null = null
let activeUtterance: SpeechSynthesisUtterance | null = null

const resolvedVideoSources = computed<Record<AvatarState, string>>(() => ({
  ...VIDEO_STAGE_SOURCES,
  ...props.videoSources,
}))
const statusLabel = computed(() => VIDEO_STATUS_LABELS[props.state])

// 清理播报兜底结束定时器。
const clearSpeechTimer = () => {
  if (speechTimerId !== null) {
    window.clearTimeout(speechTimerId)
    speechTimerId = null
  }
}

// 清理语音播放进度轮询定时器。
const clearSpeechProgressTimer = () => {
  if (speechProgressTimerId !== null) {
    window.clearInterval(speechProgressTimerId)
    speechProgressTimerId = null
  }
}

// 停止并释放当前 HTMLAudioElement 播放实例。
const cleanupAudio = () => {
  if (!activeAudio) {
    return
  }

  activeAudio.onended = null
  activeAudio.onerror = null
  activeAudio.pause()
  activeAudio = null
}

// 解绑浏览器内置 speechSynthesis 的 utterance 回调。
const cleanupUtterance = () => {
  if (!activeUtterance) {
    return
  }

  activeUtterance.onend = null
  activeUtterance.onerror = null
  activeUtterance = null
}

// 停止当前语音播放会话，并让后续旧回调失效。
const stopSpeechPlayback = () => {
  playbackSessionId += 1
  clearSpeechTimer()
  clearSpeechProgressTimer()
  cleanupAudio()
  cleanupUtterance()

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

// 完成当前语音播放，回传最终进度和完成事件。
const finishSpeechPlayback = (sessionId: number) => {
  if (sessionId !== playbackSessionId) {
    return
  }

  emit('speech-progress', 1)
  stopSpeechPlayback()
  emit('speech-complete')
}

// 周期性计算当前音频播放进度，供消息进度条和跟读状态使用。
const startSpeechProgress = (
  sessionId: number,
  speech: SpeechSynthesisResult,
  audio?: HTMLAudioElement,
) => {
  clearSpeechProgressTimer()
  emit('speech-progress', 0)

  const startTime = performance.now()
  const fallbackDurationMs = Math.max(1, speech.durationMs)

  speechProgressTimerId = window.setInterval(() => {
    if (sessionId !== playbackSessionId) {
      clearSpeechProgressTimer()
      return
    }

    const audioDuration = audio?.duration
    const hasAudioDuration =
      typeof audioDuration === 'number' &&
      Number.isFinite(audioDuration) &&
      audioDuration > 0

    const nextProgress = hasAudioDuration
      ? (audio?.currentTime ?? 0) / audioDuration
      : (performance.now() - startTime) / fallbackDurationMs

    emit('speech-progress', Math.max(0, Math.min(1, nextProgress)))
  }, 120)
}

// 播放一段 TTS 结果，优先使用真实音频，缺失时退回浏览器语音。
const startSpeechPlayback = async (speech: SpeechSynthesisResult) => {
  stopSpeechPlayback()
  const sessionId = playbackSessionId

  speechTimerId = window.setTimeout(() => {
    finishSpeechPlayback(sessionId)
  }, speech.durationMs + (speech.audioUrl ? 240 : 900))

  if (speech.audioUrl) {
    const audio = new Audio(speech.audioUrl)
    activeAudio = audio
    audio.preload = 'auto'
    audio.onended = () => finishSpeechPlayback(sessionId)
    audio.onerror = () => finishSpeechPlayback(sessionId)
    startSpeechProgress(sessionId, speech, audio)

    try {
      await audio.play()
    } catch {
      // If autoplay is blocked, the timer fallback still keeps the speaking state consistent.
    }

    return
  }

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
    startSpeechProgress(sessionId, speech)
    window.speechSynthesis.speak(utterance)
  } catch {
    cleanupUtterance()
  }
}

// 收集每个状态对应的视频元素引用。
const setVideoRef = (state: AvatarState, element: HTMLVideoElement | null) => {
  videoRefs[state] = element
}

// 尝试播放指定视频，必要时从头开始以保证状态切换观感。
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

// 预播放所有静音视频，减少切换状态时的首帧延迟。
const playAllVideos = () => {
  stageStates.forEach((stageState) => {
    void playVideo(videoRefs[stageState])
  })
}

let visualTransitionId = 0

// 等待视频具备可绘制帧，避免切换到黑屏或未就绪画面。
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

// 同步数字人视觉状态，确保目标视频可播放后再切换显示。
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

// 标记视频已就绪，并处理等待中的状态切换。
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

<style scoped lang="less">
.video-stage {
  position: relative;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border-radius: 24px 24px 0 0;
  background: #fafaf8;
  border: 0;
  box-shadow: none;
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

@media (max-height: 820px) and (min-width: 641px) {
  .video-stage {
    border-radius: 18px 18px 0 0;
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
