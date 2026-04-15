<template>
  <section class="assistant-demo">
    <button
      v-if="!isExpanded"
      type="button"
      class="assistant-trigger"
      aria-label="打开数字人助手"
      @click="expand"
    >
      <img class="assistant-trigger__avatar" :src="DIGITAL_HUMAN_ASSETS.avatar" alt="" />
      <span class="assistant-trigger__content">
        <strong>数字人助手</strong>
        <span>点击展开演示</span>
      </span>
    </button>

    <div v-else class="assistant-panel">
      <header class="assistant-panel__header">
        <div class="assistant-panel__identity">
          <span class="assistant-panel__status-dot"></span>
          <div>
            <strong>数字人小婉</strong>
            <p>{{ statusLabel }}</p>
          </div>
        </div>

        <div class="assistant-panel__actions">
          <button type="button" class="assistant-panel__text-button" @click="clearConversation">
            清空
          </button>
          <button
            type="button"
            class="assistant-panel__icon-button"
            aria-label="收起数字人助手"
            @click="collapse"
          >
            ×
          </button>
        </div>
      </header>

      <div class="assistant-stage">
        <div class="assistant-stage__media">
          <video
            v-for="stateName in stateNames"
            :key="stateName"
            :ref="(element) => setVideoRef(stateName, element as HTMLVideoElement | null)"
            class="assistant-stage__video"
            :class="[
              `is-${stateName}`,
              {
                'is-active': status === stateName,
                'is-ready': readyStates[stateName]
              }
            ]"
            :style="VIDEO_FRAME_VARS[stateName]"
            :src="DIGITAL_HUMAN_ASSETS.videos[stateName]"
            muted
            loop
            autoplay
            playsinline
            preload="auto"
            @canplay="handleVideoReady(stateName)"
            @error="handleVideoError(stateName)"
          ></video>

          <img
            v-if="shouldShowFallback"
            class="assistant-stage__fallback"
            :src="DIGITAL_HUMAN_ASSETS.avatar"
            alt="数字人形象"
          />
        </div>

        <div class="assistant-stage__meta">
          <p class="assistant-stage__eyebrow">Front-end Demo</p>
          <h1>数字人前端展示版</h1>
          <p class="assistant-stage__description">
            {{ latestAssistantText }}
          </p>
        </div>
      </div>

      <section class="assistant-suggestions">
        <button
          v-for="item in suggestions"
          :key="item"
          type="button"
          class="assistant-suggestions__item"
          :disabled="isRecording"
          @click="sendText(item)"
        >
          {{ item }}
        </button>
      </section>

      <section ref="messagesRef" class="assistant-messages">
        <article
          v-for="message in messages"
          :key="message.id"
          class="assistant-message"
          :class="`is-${message.role}`"
        >
          <header class="assistant-message__meta">
            <strong>{{ roleLabelMap[message.role] }}</strong>
            <time>{{ formatTime(message.timestamp) }}</time>
          </header>
          <p>{{ message.content }}</p>
        </article>
      </section>

      <footer class="assistant-input">
        <textarea
          v-model="inputText"
          class="assistant-input__field"
          rows="3"
          placeholder="请输入你想演示的问题"
          :disabled="isRecording"
          @keydown="handleInputKeydown"
        ></textarea>

        <div class="assistant-input__actions">
          <button
            type="button"
            class="assistant-input__voice"
            :class="{ 'is-recording': isRecording }"
            :disabled="isBusy"
            @mousedown.prevent="startVoiceInput"
            @mouseup.prevent="stopVoiceInput"
            @mouseleave="handleVoiceLeave"
            @touchstart.prevent="startVoiceInput"
            @touchend.prevent="stopVoiceInput"
          >
            {{ isRecording ? '松开结束' : '按住说话' }}
          </button>

          <button
            type="button"
            class="assistant-input__send"
            :disabled="!hasInput || isRecording"
            @click="submitInput"
          >
            发送
          </button>
        </div>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import {
  DIGITAL_HUMAN_ASSETS,
  VIDEO_FRAME_VARS,
  type DigitalHumanStatus,
  type MessageRole
} from './demo-config'
import { useDigitalHumanDemo } from './useDigitalHumanDemo'

const {
  clearConversation,
  collapse,
  expand,
  hasInput,
  inputText,
  isBusy,
  isExpanded,
  isRecording,
  latestAssistantText,
  messages,
  sendText,
  startVoiceInput,
  status,
  stopVoiceInput,
  submitInput,
  suggestions
} = useDigitalHumanDemo()

const stateNames: DigitalHumanStatus[] = ['idle', 'listening', 'thinking', 'speaking']
const roleLabelMap: Record<MessageRole, string> = {
  user: '你',
  assistant: '数字人',
  system: '系统'
}

const readyStates = reactive<Record<DigitalHumanStatus, boolean>>({
  idle: false,
  listening: false,
  thinking: false,
  speaking: false
})

const errorStates = reactive<Record<DigitalHumanStatus, boolean>>({
  idle: false,
  listening: false,
  thinking: false,
  speaking: false
})

const videoRefs = reactive<Record<DigitalHumanStatus, HTMLVideoElement | null>>({
  idle: null,
  listening: null,
  thinking: null,
  speaking: null
})

const messagesRef = ref<HTMLElement | null>(null)

const statusLabel = computed(() => {
  switch (status.value) {
    case 'listening':
      return '正在倾听'
    case 'thinking':
      return '正在思考'
    case 'speaking':
      return '正在回答'
    default:
      return '在线待命'
  }
})

const shouldShowFallback = computed(() => {
  const currentStatus = status.value
  return errorStates[currentStatus] || !readyStates[currentStatus]
})

const setVideoRef = (stateName: DigitalHumanStatus, element: HTMLVideoElement | null) => {
  videoRefs[stateName] = element
}

const playActiveVideo = async (stateName: DigitalHumanStatus) => {
  const videoElement = videoRefs[stateName]
  if (!videoElement) {
    return
  }

  try {
    if (stateName !== 'idle') {
      videoElement.currentTime = 0
    }
  } catch {
    // Ignore seek errors before metadata is fully ready.
  }

  try {
    await videoElement.play()
  } catch {
    // Ignore autoplay rejections in restricted environments.
  }
}

const handleVideoReady = (stateName: DigitalHumanStatus) => {
  readyStates[stateName] = true
  errorStates[stateName] = false

  if (status.value === stateName) {
    void playActiveVideo(stateName)
  }
}

const handleVideoError = (stateName: DigitalHumanStatus) => {
  errorStates[stateName] = true
}

const handleVoiceLeave = () => {
  if (isRecording.value) {
    stopVoiceInput()
  }
}

const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitInput()
  }
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })

watch(
  status,
  (currentStatus) => {
    void playActiveVideo(currentStatus)
  },
  { immediate: true }
)

watch(
  messages,
  () => {
    nextTick(() => {
      if (!messagesRef.value) {
        return
      }

      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    })
  },
  { deep: true }
)
</script>

<style scoped>
.assistant-demo {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10;
}

.assistant-trigger {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 218px;
  padding: 12px 14px 12px 12px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
  cursor: pointer;
}

.assistant-trigger__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center top;
  flex: none;
}

.assistant-trigger__content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
}

.assistant-trigger__content strong {
  font-size: 16px;
  color: #0f172a;
}

.assistant-trigger__content span {
  font-size: 13px;
  color: #64748b;
}

.assistant-panel {
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 32px 80px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(18px);
}

.assistant-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.assistant-panel__identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.assistant-panel__identity strong {
  display: block;
  color: #0f172a;
  font-size: 16px;
}

.assistant-panel__identity p {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 13px;
}

.assistant-panel__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12);
}

.assistant-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assistant-panel__text-button,
.assistant-panel__icon-button {
  border: none;
  background: transparent;
  cursor: pointer;
}

.assistant-panel__text-button {
  padding: 8px 10px;
  border-radius: 999px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
}

.assistant-panel__icon-button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 22px;
  color: #334155;
}

.assistant-stage {
  display: grid;
  gap: 14px;
}

.assistant-stage__media {
  position: relative;
  aspect-ratio: 4 / 5;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 30%),
    linear-gradient(180deg, #f9fbff 0%, #edf5ff 100%);
}

.assistant-stage__video,
.assistant-stage__fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.assistant-stage__video {
  opacity: 0;
  object-fit: contain;
  object-position: var(--video-object-position, 50% 52%);
  transform: scale(var(--video-scale, 1));
  transition: opacity 220ms ease;
}

.assistant-stage__video.is-active.is-ready {
  opacity: 1;
}

.assistant-stage__fallback {
  object-fit: cover;
  object-position: center top;
}

.assistant-stage__meta {
  display: grid;
  gap: 8px;
}

.assistant-stage__eyebrow {
  margin: 0;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.assistant-stage__meta h1 {
  margin: 0;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.1;
}

.assistant-stage__description {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.6;
}

.assistant-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.assistant-suggestions__item {
  padding: 9px 12px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.9);
  color: #334155;
  cursor: pointer;
}

.assistant-suggestions__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.assistant-messages {
  min-height: 180px;
  max-height: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 4px;
}

.assistant-message {
  padding: 12px 14px;
  border-radius: 18px;
  background: #f8fafc;
}

.assistant-message.is-user {
  align-self: flex-end;
  background: #2563eb;
  color: #ffffff;
}

.assistant-message.is-system {
  border: 1px dashed rgba(37, 99, 235, 0.24);
}

.assistant-message__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
}

.assistant-message__meta strong {
  font-size: 12px;
}

.assistant-message__meta time {
  opacity: 0.7;
}

.assistant-message p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.assistant-input {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 20px;
  background: #f8fafc;
}

.assistant-input__field {
  width: 100%;
  min-height: 78px;
  border: none;
  resize: none;
  outline: none;
  background: transparent;
  color: #0f172a;
}

.assistant-input__actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.assistant-input__voice,
.assistant-input__send {
  border: none;
  border-radius: 999px;
  cursor: pointer;
}

.assistant-input__voice {
  flex: 1;
  min-height: 42px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
}

.assistant-input__voice.is-recording {
  background: rgba(249, 115, 22, 0.14);
  color: #c2410c;
}

.assistant-input__send {
  min-width: 88px;
  min-height: 42px;
  background: #0f172a;
  color: #ffffff;
}

.assistant-input__voice:disabled,
.assistant-input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .assistant-demo {
    top: 12px;
    right: 12px;
    left: 12px;
  }

  .assistant-trigger {
    width: 100%;
    justify-content: center;
  }

  .assistant-panel {
    width: 100%;
  }
}
</style>
