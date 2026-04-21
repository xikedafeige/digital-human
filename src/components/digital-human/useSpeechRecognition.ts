import { onBeforeUnmount, ref } from 'vue'

const SPEECH_RECOGNITION_WS_URL = 'ws://192.168.113.44:8001/ws/recognize'
const STOP_RESULT_TIMEOUT_MS = 3000

interface RecognitionSegment {
  text: string
  speaker?: string
  start_time?: number
  end_time?: number
  similarity?: number
}

type RecognitionMessage =
  | {
      type: 'partial'
      text?: string
      start_time?: number
      end_time?: number
    }
  | {
      type: 'segment'
      data?: RecognitionSegment
    }
  | {
      type: 'progress' | 'complete'
    }
  | {
      type: 'error'
      message?: string
    }

interface SpeechRecognitionOptions {
  onPartial?: (text: string) => void
  onSegment?: (text: string) => void
  onError?: (message: string) => void
}

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const floatTo16BitPCM = (float32Array: Float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  let offset = 0

  for (let index = 0; index < float32Array.length; index += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, float32Array[index]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  return buffer
}

export function useSpeechRecognition(options: SpeechRecognitionOptions = {}) {
  const isRecognizing = ref(false)
  const partialText = ref('')
  const finalText = ref('')
  const errorMessage = ref('')

  let ws: WebSocket | null = null
  let mediaStream: MediaStream | null = null
  let processor: ScriptProcessorNode | null = null
  let audioContext: AudioContext | null = null
  let resolveStop: ((text: string) => void) | null = null
  let stopTimerId: number | null = null

  const cleanupAudio = async () => {
    if (processor) {
      processor.disconnect()
      processor.onaudioprocess = null
      processor = null
    }

    if (audioContext) {
      await audioContext.close()
      audioContext = null
    }

    if (mediaStream) {
      // Release the microphone immediately so the browser recording indicator is correct.
      mediaStream.getTracks().forEach((track) => track.stop())
      mediaStream = null
    }
  }

  const cleanupWebSocket = () => {
    if (ws) {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close()
      }

      ws.onopen = null
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws = null
    }
  }

  const clearStopTimer = () => {
    if (stopTimerId !== null) {
      window.clearTimeout(stopTimerId)
      stopTimerId = null
    }
  }

  const getBestRecognizedText = () => finalText.value.trim() || partialText.value.trim()

  const finishStop = (text = getBestRecognizedText()) => {
    const normalizedText = text.trim()
    clearStopTimer()

    if (resolveStop) {
      resolveStop(normalizedText)
      resolveStop = null
    }

    isRecognizing.value = false
    partialText.value = ''
  }

  const handleMessage = (rawData: string) => {
    try {
      const message = JSON.parse(rawData) as RecognitionMessage

      if (message.type === 'partial') {
        partialText.value += message.text ?? ''
        options.onPartial?.(partialText.value)
        return
      }

      if (message.type === 'segment') {
        const text = message.data?.text?.trim() ?? ''

        if (text) {
          finalText.value = text
          partialText.value = text
          options.onSegment?.(text)
        }

        finishStop(text)
        return
      }

      if (message.type === 'complete') {
        finishStop()
        return
      }

      if (message.type === 'error') {
        const messageText = message.message ?? '语音识别服务返回错误'
        errorMessage.value = messageText
        options.onError?.(messageText)
      }
    } catch {
      const messageText = '语音识别消息解析失败'
      errorMessage.value = messageText
      options.onError?.(messageText)
    }
  }

  const start = async () => {
    if (isRecognizing.value) {
      return
    }

    await stop()
    partialText.value = ''
    finalText.value = ''
    errorMessage.value = ''
    isRecognizing.value = true

    try {
      ws = new WebSocket(SPEECH_RECOGNITION_WS_URL)
      ws.onopen = () => {
        const sampleRate = audioContext?.sampleRate ?? 16000
        // Tell the service the actual browser sample rate for accurate server-side resampling.
        ws?.send(JSON.stringify({ type: 'meta', sampleRate }))
      }
      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handleMessage(event.data)
        }
      }
      ws.onerror = () => {
        const messageText = '语音识别服务连接错误'
        errorMessage.value = messageText
        options.onError?.(messageText)
      }
      ws.onclose = () => {
        isRecognizing.value = false

        if (resolveStop) {
          finishStop()
        }
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioWindow = window as AudioContextWindow
      const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext

      if (!AudioContextConstructor) {
        throw new Error('当前浏览器不支持 AudioContext')
      }

      audioContext = new AudioContextConstructor({ sampleRate: 16000 })

      const source = audioContext.createMediaStreamSource(mediaStream)
      const node = audioContext.createScriptProcessor(4096, 1, 1)
      source.connect(node)
      node.connect(audioContext.destination)
      processor = node
      processor.onaudioprocess = (event) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return
        }

        const input = event.inputBuffer.getChannelData(0)
        // The ASR service expects little-endian signed 16-bit PCM chunks.
        ws.send(floatTo16BitPCM(input))
      }
    } catch (error) {
      await cleanupAudio()
      cleanupWebSocket()
      isRecognizing.value = false
      const messageText = `语音识别启动失败：${error instanceof Error ? error.message : String(error)}`
      errorMessage.value = messageText
      options.onError?.(messageText)
      throw error
    }
  }

  const stop = async () => {
    if (resolveStop) {
      return new Promise<string>((resolve) => {
        const previousResolve = resolveStop
        resolveStop = (text) => {
          previousResolve?.(text)
          resolve(text)
        }
      })
    }

    const stopPromise = new Promise<string>((resolve) => {
      resolveStop = resolve
    })

    try {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send('end')
      }

      // Stop local audio capture immediately; the final segment may still arrive over WebSocket.
      await cleanupAudio()

      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        finishStop()
      }
    } catch {
      finishStop()
    }

    if (resolveStop) {
      stopTimerId = window.setTimeout(() => {
        finishStop()
        cleanupWebSocket()
      }, STOP_RESULT_TIMEOUT_MS)
    }

    return stopPromise
  }

  onBeforeUnmount(() => {
    clearStopTimer()
    void cleanupAudio()

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send('end')
    }

    cleanupWebSocket()
  })

  return {
    errorMessage,
    finalText,
    isRecognizing,
    partialText,
    start,
    stop,
  }
}
