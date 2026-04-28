// 数字人语音识别 Hook，封装麦克风采集、PCM 转换和 ASR WebSocket 交互。
import { onBeforeUnmount, ref } from 'vue'
import { DIGITAL_HUMAN_RUNTIME_CONFIG } from '@/config/runtime-config'

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

// 将浏览器采集的 Float32 音频帧转换为 ASR 服务需要的 16-bit PCM。
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

// 提供实时语音识别能力，管理麦克风、音频节点和 WebSocket 生命周期。
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

  // 释放本地音频节点和麦克风设备，避免录音指示器残留。
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

  // 关闭并解绑 ASR WebSocket，避免旧连接继续回调。
  const cleanupWebSocket = () => {
    if (!ws) {
      return
    }

    if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
      ws.close()
    }

    ws.onopen = null
    ws.onclose = null
    ws.onerror = null
    ws.onmessage = null
    ws = null
  }

  // 清理等待最终识别结果的兜底定时器。
  const clearStopTimer = () => {
    if (stopTimerId !== null) {
      window.clearTimeout(stopTimerId)
      stopTimerId = null
    }
  }

  // 重置本轮识别的临时文本和最终文本。
  const resetRecognitionText = () => {
    partialText.value = ''
    finalText.value = ''
  }

  // 优先使用最终结果，没有最终结果时退回局部识别文本。
  const getBestRecognizedText = () => finalText.value.trim() || partialText.value.trim()

  // 收口停止录音流程，向调用方返回当前可用识别文本。
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

  // 解析 ASR 服务消息，并同步 partial、segment、complete 和 error 状态。
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

  // 启动实时语音识别：建立 ASR 连接并持续发送 PCM 音频帧。
  const start = async () => {
    if (isRecognizing.value) {
      return
    }

    await cancel()
    resetRecognitionText()
    errorMessage.value = ''
    isRecognizing.value = true

    try {
      ws = new WebSocket(DIGITAL_HUMAN_RUNTIME_CONFIG.asrWsUrl)
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

  // 主动结束录音，等待服务端返回最终识别文本。
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

  // 取消当前识别流程，不向上层返回已识别内容。
  const cancel = async () => {
    clearStopTimer()
    resetRecognitionText()
    errorMessage.value = ''

    await cleanupAudio()
    cleanupWebSocket()
    finishStop('')
  }

  onBeforeUnmount(() => {
    void cancel()
  })

  return {
    cancel,
    errorMessage,
    finalText,
    isRecognizing,
    partialText,
    start,
    stop,
  }
}
