<template>
  <div class="live2d-stage" :class="`is-${state}`">
    <div class="live2d-stage__backdrop">
      <div class="live2d-stage__backdrop-glow"></div>
      <div class="live2d-stage__backdrop-grid"></div>
    </div>

    <div ref="canvasHost" class="live2d-stage__canvas"></div>

    <div v-if="showFallback" class="live2d-stage__fallback">
      <img
        class="live2d-stage__fallback-image"
        :src="manifest.fallbackPosterUrl || fallbackPosterUrl"
        alt=""
      />
      <p class="live2d-stage__fallback-text">
        {{ fallbackMessage }}
      </p>
    </div>

    <div class="live2d-stage__status">
      <span class="live2d-stage__status-dot"></span>
      <span>{{ statusLabel }}</span>
      <em>{{ renderModeLabel }}</em>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ensureCubism4Runtime, PIXI } from './live2d-runtime'
import type {
  AvatarManifest,
  AvatarState,
  AvatarVisemeCode,
  SpeechSynthesisResult,
} from './avatar-types'

interface Props {
  manifest: AvatarManifest
  state: AvatarState
  speechResult?: SpeechSynthesisResult | null
  autoplayToken?: number
}

type Cubism4Module = typeof import('pixi-live2d-display/cubism4')
type Live2DModelInstance = Awaited<
  ReturnType<(typeof import('pixi-live2d-display/cubism4'))['Live2DModel']['from']>
>

const props = withDefaults(defineProps<Props>(), {
  speechResult: null,
  autoplayToken: 0,
})

const emit = defineEmits<{
  (e: 'speech-complete'): void
}>()

const fallbackPosterUrl = '/digital-human/avatar.jpg'
const canvasHost = ref<HTMLDivElement | null>(null)
const isModelReady = ref(false)
const loadError = ref('')

const statusLabelMap: Record<AvatarState, string> = {
  idle: '在线待命',
  listening: '正在聆听',
  thinking: '正在思考',
  speaking: '正在回答',
}

const statusLabel = computed(() => statusLabelMap[props.state])

const renderModeLabel = computed(() => {
  if (!isModelReady.value) {
    return 'Poster Fallback'
  }

  if (props.state !== 'speaking') {
    return 'Live2D Runtime'
  }

  return props.speechResult?.playbackMode === 'viseme' ? 'Viseme Lip Sync' : 'Energy Lip Sync'
})

const showFallback = computed(() => !isModelReady.value)
const fallbackMessage = computed(() =>
  loadError.value ? `Live2D 加载失败：${loadError.value}` : 'Live2D 模型加载中...'
)

const visemeMap: Record<AvatarVisemeCode, { open: number; form: number }> = {
  sil: { open: 0, form: 0 },
  A: { open: 1, form: 0.1 },
  E: { open: 0.55, form: 0.9 },
  O: { open: 0.72, form: -0.2 },
  U: { open: 0.4, form: -0.55 },
  FV: { open: 0.26, form: 0.65 },
  L: { open: 0.6, form: 0.25 },
  MBP: { open: 0.06, form: 0 },
}

let cubismModule: Cubism4Module | null = null
let pixiApp: PIXI.Application | null = null
let live2dModel: Live2DModelInstance | null = null
let resizeObserver: ResizeObserver | null = null
let motionFinishHandler: (() => void) | null = null
let speechPlaybackToken = 0
let animationFrameId: number | null = null
let playbackTimerId: number | null = null
let activeAudio: HTMLAudioElement | null = null
let activeUtterance: SpeechSynthesisUtterance | null = null
let audioContext: AudioContext | null = null
let audioSourceNode: MediaElementAudioSourceNode | null = null
let analyserNode: AnalyserNode | null = null
let loadToken = 0

const getMotionForState = (state: AvatarState) =>
  state === 'speaking' ? props.manifest.motions.speakingBase : props.manifest.motions[state]

const clearAnimationFrame = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const clearPlaybackTimer = () => {
  if (playbackTimerId !== null) {
    window.clearTimeout(playbackTimerId)
    playbackTimerId = null
  }
}

const setParameter = (parameterId: string | undefined, value: number) => {
  if (!parameterId || !live2dModel) {
    return
  }

  const coreModel = (live2dModel.internalModel as any)?.coreModel
  if (!coreModel?.setParameterValueById) {
    return
  }

  try {
    coreModel.setParameterValueById(parameterId, value, 1)
  } catch {
    // Ignore unsupported parameters on placeholder models.
  }
}

const applyMouthState = (open: number, form = 0) => {
  const clampedOpen = Math.max(0, Math.min(1, open))
  const clampedForm = Math.max(-1, Math.min(1, form))
  setParameter(props.manifest.parameters.mouthOpenY, clampedOpen)
  setParameter(props.manifest.parameters.mouthForm, clampedForm)
}

const resetSpeechParameters = () => {
  applyMouthState(0, 0)
}

const layoutModel = () => {
  if (!canvasHost.value || !live2dModel) {
    return
  }

  const width = canvasHost.value.clientWidth
  const height = canvasHost.value.clientHeight
  const internalModel = live2dModel.internalModel as any
  const modelWidth = internalModel?.width || live2dModel.width || 1
  const modelHeight = internalModel?.height || live2dModel.height || 1
  const scale = Math.min(width / modelWidth, height / modelHeight) * props.manifest.layout.scale

  live2dModel.anchor.set(props.manifest.layout.anchorX, props.manifest.layout.anchorY)
  live2dModel.scale.set(scale)
  live2dModel.x = width * props.manifest.layout.x
  live2dModel.y = height * props.manifest.layout.y
}

const stopSpeechPlayback = () => {
  speechPlaybackToken += 1
  clearAnimationFrame()
  clearPlaybackTimer()
  resetSpeechParameters()

  if (activeAudio) {
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }

  if (audioSourceNode) {
    audioSourceNode.disconnect()
    audioSourceNode = null
  }

  if (analyserNode) {
    analyserNode.disconnect()
    analyserNode = null
  }

  if (audioContext) {
    void audioContext.close().catch(() => undefined)
    audioContext = null
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

  activeUtterance = null
}

const destroyStage = () => {
  stopSpeechPlayback()

  const motionManager = (live2dModel?.internalModel as any)?.motionManager
  if (motionFinishHandler && motionManager?.off) {
    motionManager.off('motionFinish', motionFinishHandler)
  }
  motionFinishHandler = null
  live2dModel = null

  if (pixiApp) {
    pixiApp.destroy(true, {
      children: true,
      texture: false,
      baseTexture: false,
    })
    pixiApp = null
  }

  if (canvasHost.value) {
    canvasHost.value.replaceChildren()
  }

  isModelReady.value = false
}

const playStateMotion = async (state: AvatarState) => {
  if (!live2dModel || !cubismModule) {
    return
  }

  const motion = getMotionForState(state)
  const priority =
    state === 'speaking'
      ? cubismModule.MotionPriority.FORCE
      : state === 'idle'
        ? cubismModule.MotionPriority.IDLE
        : cubismModule.MotionPriority.NORMAL

  try {
    await live2dModel.motion(motion.group, motion.index, priority)
  } catch {
    // Ignore motion startup errors and stay on the current pose.
  }
}

const attachMotionLoop = () => {
  const motionManager = (live2dModel?.internalModel as any)?.motionManager
  if (!motionManager?.on) {
    return
  }

  motionFinishHandler = () => {
    if (!live2dModel) {
      return
    }

    if (props.state === 'speaking') {
      void playStateMotion('speaking')
      return
    }

    void playStateMotion(props.state)
  }

  motionManager.on('motionFinish', motionFinishHandler)
}

const syncVisemes = (speech: SpeechSynthesisResult, token: number) => {
  const timeline = speech.visemes ?? []
  if (timeline.length === 0) {
    return
  }

  const startTime = performance.now()
  const tick = () => {
    if (token !== speechPlaybackToken) {
      return
    }

    const elapsed = performance.now() - startTime
    const currentViseme = timeline.find((item) => elapsed >= item.startMs && elapsed < item.endMs)
    const visemeState = visemeMap[currentViseme?.code ?? 'sil']
    applyMouthState(visemeState.open, visemeState.form)

    if (elapsed < speech.durationMs) {
      animationFrameId = requestAnimationFrame(tick)
    }
  }

  animationFrameId = requestAnimationFrame(tick)
}

const syncEnergyFallback = (speech: SpeechSynthesisResult, token: number) => {
  const startTime = performance.now()
  const trimmedText = speech.text.replace(/\s+/g, '')
  const punctuationPattern = /[，。！？,.!?；;：:]/u

  const tick = () => {
    if (token !== speechPlaybackToken) {
      return
    }

    const elapsed = performance.now() - startTime
    if (elapsed >= speech.durationMs) {
      resetSpeechParameters()
      return
    }

    let open = 0
    let form = 0

    if (analyserNode) {
      const bufferLength = analyserNode.frequencyBinCount
      const data = new Uint8Array(bufferLength)
      analyserNode.getByteTimeDomainData(data)
      let sum = 0

      for (let index = 0; index < data.length; index += 1) {
        const normalized = (data[index] - 128) / 128
        sum += Math.abs(normalized)
      }

      open = Math.min(1, sum / data.length / 0.28)
    } else {
      const envelope = Math.sin((Math.min(elapsed, speech.durationMs) / speech.durationMs) * Math.PI)
      const beat = Math.abs(Math.sin(elapsed / 120))
      const textIndex = Math.min(
        Math.max(trimmedText.length - 1, 0),
        Math.floor((elapsed / speech.durationMs) * Math.max(trimmedText.length, 1))
      )
      const currentChar = trimmedText[textIndex] ?? ''
      const punctuationDamping = punctuationPattern.test(currentChar) ? 0.35 : 1

      open = Math.max(0, Math.min(1, envelope * (0.22 + beat * 0.82) * punctuationDamping))
    }

    form = 0.08 * Math.sin(elapsed / 280)
    applyMouthState(open, form)
    animationFrameId = requestAnimationFrame(tick)
  }

  animationFrameId = requestAnimationFrame(tick)
}

const finishSpeechPlayback = (token: number) => {
  if (token !== speechPlaybackToken) {
    return
  }

  stopSpeechPlayback()
  emit('speech-complete')
}

const startSpeechPlayback = async (speech: SpeechSynthesisResult) => {
  if (!live2dModel) {
    return
  }

  stopSpeechPlayback()
  const token = speechPlaybackToken

  await playStateMotion('speaking')

  if (speech.audioUrl) {
    const audio = new Audio(speech.audioUrl)
    activeAudio = audio

    try {
      audioContext = new window.AudioContext()
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      audioSourceNode = audioContext.createMediaElementSource(audio)
      audioSourceNode.connect(analyserNode)
      analyserNode.connect(audioContext.destination)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
    } catch {
      analyserNode = null
      audioSourceNode = null
      audioContext = null
    }

    audio.onended = () => {
      finishSpeechPlayback(token)
    }

    void audio.play().catch(() => undefined)
  } else if ('speechSynthesis' in window && speech.text) {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(speech.text)
      utterance.lang = 'zh-CN'
      utterance.rate = 1
      utterance.pitch = 1
      activeUtterance = utterance
      window.speechSynthesis.speak(utterance)
    } catch {
      activeUtterance = null
    }
  }

  if (speech.playbackMode === 'viseme' && (speech.visemes?.length ?? 0) > 0) {
    syncVisemes(speech, token)
  } else {
    syncEnergyFallback(speech, token)
  }

  playbackTimerId = window.setTimeout(() => {
    finishSpeechPlayback(token)
  }, speech.durationMs + 80)
}

const initializeStage = async () => {
  loadToken += 1
  const currentLoadToken = loadToken

  destroyStage()
  loadError.value = ''

  if (!canvasHost.value) {
    return
  }

  try {
    cubismModule = await ensureCubism4Runtime(props.manifest.coreScriptUrl)
    if (currentLoadToken !== loadToken || !canvasHost.value) {
      return
    }

    const app = new PIXI.Application({
      resizeTo: canvasHost.value,
      autoDensity: true,
      antialias: true,
      backgroundAlpha: 0,
    })
    canvasHost.value.appendChild(app.view as HTMLCanvasElement)

    const model = await cubismModule.Live2DModel.from(props.manifest.modelUrl, {
      autoInteract: false,
    })

    if (currentLoadToken !== loadToken) {
      app.destroy(true)
      return
    }

    pixiApp = app
    live2dModel = model
    app.stage.addChild(model)
    attachMotionLoop()
    layoutModel()
    isModelReady.value = true

    if (props.state === 'speaking' && props.speechResult && props.autoplayToken) {
      await startSpeechPlayback(props.speechResult)
    } else {
      await playStateMotion(props.state)
      resetSpeechParameters()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    loadError.value = message
    isModelReady.value = false
  }
}

watch(
  () => props.state,
  async (nextState) => {
    if (nextState !== 'speaking') {
      stopSpeechPlayback()
    }

    if (!isModelReady.value) {
      return
    }

    await playStateMotion(nextState)
  }
)

watch(
  () => props.autoplayToken,
  (nextToken, previousToken) => {
    if (!nextToken || nextToken === previousToken || props.state !== 'speaking' || !props.speechResult) {
      return
    }

    if (!isModelReady.value) {
      return
    }

    void startSpeechPlayback(props.speechResult)
  }
)

watch(
  () => props.manifest,
  async () => {
    await nextTick()
    void initializeStage()
  },
  { deep: true }
)

onMounted(() => {
  void initializeStage()

  if (canvasHost.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      layoutModel()
    })
    resizeObserver.observe(canvasHost.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  destroyStage()
})
</script>

<style scoped>
.live2d-stage {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  min-height: 420px;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.95), rgba(219, 234, 254, 0.96) 42%, rgba(191, 219, 254, 0.92) 100%);
  border: 1px solid rgba(191, 219, 254, 0.8);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 24px 60px rgba(59, 130, 246, 0.12);
}

.live2d-stage__backdrop,
.live2d-stage__canvas,
.live2d-stage__fallback {
  position: absolute;
  inset: 0;
}

.live2d-stage__backdrop {
  background:
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.84), transparent 56%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.94), rgba(191, 219, 254, 0.76));
}

.live2d-stage__backdrop-glow {
  position: absolute;
  inset: 12% 18% auto;
  height: 50%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.92), transparent 72%);
  filter: blur(14px);
}

.live2d-stage__backdrop-grid {
  position: absolute;
  inset: auto 0 0;
  height: 32%;
  background:
    linear-gradient(transparent 0, rgba(255, 255, 255, 0.24) 100%),
    repeating-linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0 1px, transparent 1px 44px),
    repeating-linear-gradient(0deg, rgba(59, 130, 246, 0.08) 0 1px, transparent 1px 30px);
  mask-image: linear-gradient(180deg, transparent, #000 16%, #000);
}

.live2d-stage__canvas {
  z-index: 2;
}

.live2d-stage__canvas :deep(canvas) {
  width: 100%;
  height: 100%;
}

.live2d-stage__fallback {
  z-index: 3;
  display: grid;
  place-items: center;
  padding: 28px;
  gap: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.3), rgba(255, 255, 255, 0.65));
}

.live2d-stage__fallback-image {
  width: min(72%, 320px);
  max-height: 78%;
  object-fit: contain;
  filter: drop-shadow(0 20px 40px rgba(59, 130, 246, 0.18));
}

.live2d-stage__fallback-text {
  margin: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #475569;
  font-size: 12px;
  line-height: 1.5;
}

.live2d-stage__status {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(191, 219, 254, 0.9);
  color: #0f172a;
  font-size: 12px;
  backdrop-filter: blur(12px);
}

.live2d-stage__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.16);
}

.live2d-stage__status em {
  font-style: normal;
  color: #2563eb;
}
</style>
