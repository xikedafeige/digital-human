// 数字人语音合成 Hook，封装 TTS 请求、音频时长探测和资源释放。
import { ref } from 'vue'
import type { SpeechSynthesisResult } from '@/types/avatar-types'
import { RESPONSE_TIMING } from '@/config/demo-config'
import { buildTtsEndpointUrl, DIGITAL_HUMAN_RUNTIME_CONFIG } from '@/config/runtime-config'

const AUDIO_METADATA_TIMEOUT_MS = 3500

// 生成标准中断错误，便于上层区分主动取消和真实失败。
const createAbortError = () => new DOMException('TTS synthesis aborted', 'AbortError')

// 在无法读取音频元数据时，根据文本长度估算播报时长。
const estimateSpeechDurationMs = (text: string) => {
  const normalizedText = text.trim()

  return Math.max(
    RESPONSE_TIMING.minimumSpeakingMs,
    normalizedText.length * RESPONSE_TIMING.msPerCharacter
  )
}

// 用临时 audio 元素探测真实音频时长，让播报进度更贴近实际音频。
const probeAudioDurationMs = (audioUrl: string, signal?: AbortSignal) =>
  new Promise<number>((resolve, reject) => {
    const audio = new Audio()
    let timeoutId: number | null = null

    const cleanup = () => {
      audio.onloadedmetadata = null
      audio.onerror = null

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }

      signal?.removeEventListener('abort', handleAbort)
      audio.pause()
      audio.removeAttribute('src')
    }

    const handleAbort = () => {
      cleanup()
      reject(createAbortError())
    }

    audio.onloadedmetadata = () => {
      const durationSeconds = audio.duration

      cleanup()

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        reject(new Error('TTS audio metadata is invalid'))
        return
      }

      resolve(Math.round(durationSeconds * 1000))
    }

    audio.onerror = () => {
      cleanup()
      reject(new Error('TTS audio metadata failed to load'))
    }

    timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('TTS audio metadata timed out'))
    }, AUDIO_METADATA_TIMEOUT_MS)

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })

    // Probe the generated blob with a temporary audio element so speaking timing matches the real file.
    audio.preload = 'metadata'
    audio.src = audioUrl
    audio.load()
  })

interface SpeechSynthesisOptions {
  signal?: AbortSignal
}

// 提供 TTS 合成能力，并负责生成音频 URL 与释放资源。
export function useSpeechSynthesis() {
  const errorMessage = ref('')
  const isSynthesizing = ref(false)

  // 请求 TTS 服务生成一段语音，返回可直接播放的 SpeechSynthesisResult。
  const synthesize = async (
    text: string,
    options: SpeechSynthesisOptions = {}
  ): Promise<SpeechSynthesisResult> => {
    const normalizedText = text.trim()

    if (!normalizedText) {
      throw new Error('TTS text is empty')
    }

    if (options.signal?.aborted) {
      throw createAbortError()
    }

    isSynthesizing.value = true
    errorMessage.value = ''

    const formData = new FormData()
    formData.append('input', normalizedText)
    formData.append('model', DIGITAL_HUMAN_RUNTIME_CONFIG.ttsModel)
    formData.append('voice', DIGITAL_HUMAN_RUNTIME_CONFIG.ttsVoice)
    formData.append('response_format', DIGITAL_HUMAN_RUNTIME_CONFIG.ttsResponseFormat)
    formData.append('speed', DIGITAL_HUMAN_RUNTIME_CONFIG.ttsSpeed)

    let audioUrl = ''

    try {
      // Request real TTS audio using the same contract as the standalone test page.
      const response = await fetch(buildTtsEndpointUrl(), {
        method: 'POST',
        body: formData,
        signal: options.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'TTS request failed'}`)
      }

      const blob = await response.blob()

      if (options.signal?.aborted) {
        throw createAbortError()
      }

      // Convert the returned audio blob into an object URL so the stage can play it immediately.
      audioUrl = URL.createObjectURL(blob)

      let durationMs = estimateSpeechDurationMs(normalizedText)

      try {
        durationMs = await probeAudioDurationMs(audioUrl, options.signal)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
      }

      return {
        text: normalizedText,
        audioUrl,
        durationMs,
        playbackMode: 'energy',
        generatedAt: Date.now(),
      }
    } catch (error) {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        errorMessage.value = error instanceof Error ? error.message : String(error)
      }

      throw error
    } finally {
      isSynthesizing.value = false
    }
  }

  // 释放 TTS 生成的 blob URL，避免长时间使用后内存泄漏。
  const revoke = (speech: SpeechSynthesisResult | null | undefined) => {
    if (!speech?.audioUrl || !speech.audioUrl.startsWith('blob:')) {
      return
    }

    // Release generated object URLs when a reply is replaced or the assistant is reset.
    URL.revokeObjectURL(speech.audioUrl)
  }

  return {
    errorMessage,
    isSynthesizing,
    revoke,
    synthesize,
  }
}
