import { ref } from 'vue'
import type { SpeechSynthesisResult } from './avatar-types'
import { RESPONSE_TIMING } from './demo-config'

const TTS_SERVER_URL = 'http://192.168.113.44:8001'
const TTS_ENDPOINT = `${TTS_SERVER_URL}/v1/audio/speech`
const TTS_MODEL = 'matcha-tts'
const TTS_VOICE = 'xiaoxiao'
const TTS_RESPONSE_FORMAT = 'mp3'
const TTS_SPEED = '1.0'
const AUDIO_METADATA_TIMEOUT_MS = 3500

const createAbortError = () => new DOMException('TTS synthesis aborted', 'AbortError')

const estimateSpeechDurationMs = (text: string) => {
  const normalizedText = text.trim()

  return Math.max(
    RESPONSE_TIMING.minimumSpeakingMs,
    normalizedText.length * RESPONSE_TIMING.msPerCharacter
  )
}

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

export function useSpeechSynthesis() {
  const errorMessage = ref('')
  const isSynthesizing = ref(false)

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
    formData.append('model', TTS_MODEL)
    formData.append('voice', TTS_VOICE)
    formData.append('response_format', TTS_RESPONSE_FORMAT)
    formData.append('speed', TTS_SPEED)

    let audioUrl = ''

    try {
      // Request real TTS audio using the same contract as the standalone test page.
      const response = await fetch(TTS_ENDPOINT, {
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
