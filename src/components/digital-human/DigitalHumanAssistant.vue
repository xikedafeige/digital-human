<template>
  <section class="assistant-demo">
    <button
      v-if="!isExpanded"
      type="button"
      class="assistant-trigger"
      aria-label="打开数字人小助"
      @click="expand"
    >
      <img class="assistant-trigger__avatar" :src="fallbackPosterUrl" alt="" />
      <span class="assistant-trigger__content">
        <strong>数字人小助</strong>
        <span>点击展开智能问答</span>
      </span>
    </button>

    <div v-else class="assistant-panel">
      <header class="assistant-panel__header">
        <div class="assistant-panel__identity">
          <span class="assistant-panel__status-dot" :class="`is-${status}`"></span>
          <div>
            <strong>数字人小助</strong>
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
            aria-label="收起数字人小助"
            @click="collapse"
          >
            ×
          </button>
        </div>
      </header>

      <div class="assistant-panel__body">
        <VideoDigitalHumanStage
          :state="status"
          :speech-result="speechResult"
          :autoplay-token="speechToken"
          @speech-complete="handleSpeechComplete"
        />

        <section class="assistant-panel__chat-card">
          <header class="assistant-panel__chat-header">
            <div class="assistant-panel__llm-chip">
              <span class="assistant-panel__llm-dot"></span>
              <span>LLM 已接入</span>
            </div>
            <p class="assistant-panel__runtime-tip">{{ statusHint }}</p>
          </header>

          <section ref="messagesRef" class="assistant-messages">
            <article
              v-for="message in messages"
              :key="message.id"
              class="assistant-message"
              :class="[`is-${message.role}`, { 'is-pending': message.pending }]"
            >
              <header class="assistant-message__meta">
                <strong>{{ roleLabelMap[message.role] }}</strong>
                <time>{{ formatTime(message.timestamp) }}</time>
              </header>
              <p>{{ message.content }}</p>
            </article>
          </section>
        </section>

        <section class="assistant-suggestions">
          <button
            v-for="item in suggestions"
            :key="item"
            type="button"
            class="assistant-suggestions__item"
            @click="sendText(item)"
          >
            {{ item }}
          </button>
        </section>

        <footer class="assistant-input">
          <div class="assistant-input__field-wrap">
            <textarea
              v-model="inputText"
              class="assistant-input__field"
              rows="3"
              placeholder="输入问题..."
              :disabled="isRecording"
              @keydown="handleInputKeydown"
            ></textarea>

            <span v-if="isBusy" class="assistant-input__busy-tip">发送新问题会中断当前播报</span>
          </div>

          <div class="assistant-input__actions">
            <button
              type="button"
              class="assistant-input__voice"
              :class="{ 'is-recording': isRecording }"
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
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { DemoMessage } from './avatar-types'
import { useDigitalHumanDemo } from './useDigitalHumanDemo'
import VideoDigitalHumanStage from './VideoDigitalHumanStage.vue'
import { VIDEO_POSTER_URL, VIDEO_STATUS_LABELS } from './video-avatar-config'

const fallbackPosterUrl = VIDEO_POSTER_URL

const {
  clearConversation,
  collapse,
  expand,
  handleSpeechComplete,
  hasInput,
  inputText,
  isBusy,
  isExpanded,
  isRecording,
  latestAssistantText,
  messages,
  sendText,
  speechResult,
  speechToken,
  startVoiceInput,
  status,
  stopVoiceInput,
  submitInput,
  suggestions,
} = useDigitalHumanDemo()

const messagesRef = ref<HTMLElement | null>(null)

const statusLabel = computed(() => VIDEO_STATUS_LABELS[status.value])
const statusHint = computed(() => {
  if (isRecording.value) {
    return '录音中，松开后将自动发起提问。'
  }

  if (status.value === 'speaking') {
    return '回复正在流式输出，数字人同步播报中。'
  }

  if (status.value === 'thinking') {
    return '正在模拟大模型思考，请稍候。'
  }

  return latestAssistantText.value
})

const roleLabelMap: Record<DemoMessage['role'], string> = {
  user: '你',
  assistant: '数字人',
  system: '系统',
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
    minute: '2-digit',
  })

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
  z-index: 40;
}

.assistant-trigger {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 216px;
  padding: 10px 14px 10px 10px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 42px rgba(70, 107, 165, 0.18);
  cursor: pointer;
}

.assistant-trigger__avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center top;
  box-shadow: 0 10px 24px rgba(112, 144, 199, 0.2);
}

.assistant-trigger__content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
}

.assistant-trigger__content strong {
  font-size: 15px;
  color: #20304d;
}

.assistant-trigger__content span {
  font-size: 12px;
  color: #7283a1;
}

.assistant-panel {
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  padding: 16px 16px 14px;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 251, 255, 0.98)),
    rgba(255, 255, 255, 0.98);
  box-shadow: 0 34px 84px rgba(62, 100, 160, 0.22);
  border: 1px solid rgba(226, 234, 249, 0.95);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.assistant-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.assistant-panel__identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.assistant-panel__identity strong {
  display: block;
  color: #233352;
  font-size: 16px;
  line-height: 1.1;
}

.assistant-panel__identity p {
  margin: 2px 0 0;
  color: #6f7f9b;
  font-size: 12px;
}

.assistant-panel__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12);
}

.assistant-panel__status-dot.is-listening {
  background: #38bdf8;
  box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.14);
}

.assistant-panel__status-dot.is-thinking {
  background: #f59e0b;
  box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.14);
}

.assistant-panel__status-dot.is-speaking {
  background: #4f78ff;
  box-shadow: 0 0 0 6px rgba(79, 120, 255, 0.14);
}

.assistant-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.assistant-panel__text-button,
.assistant-panel__icon-button {
  border: none;
  cursor: pointer;
}

.assistant-panel__text-button {
  padding: 9px 12px;
  border-radius: 999px;
  color: #5e83ef;
  background: rgba(96, 133, 239, 0.12);
  font-size: 13px;
  font-weight: 700;
}

.assistant-panel__icon-button {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 20px;
  color: #5f6e88;
}

.assistant-panel__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 14px;
  min-height: 0;
  overflow: hidden;
}

.assistant-panel__chat-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 14px 14px 12px;
  border-radius: 24px;
  border: 1px solid rgba(226, 233, 248, 0.95);
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
  min-height: 0;
}

.assistant-panel__chat-header {
  display: grid;
  gap: 8px;
}

.assistant-panel__llm-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(187, 213, 250, 0.9);
  background: rgba(240, 247, 255, 0.9);
  color: #5d85ef;
  font-size: 12px;
  font-weight: 700;
}

.assistant-panel__llm-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #33c47a;
  box-shadow: 0 0 0 4px rgba(51, 196, 122, 0.14);
}

.assistant-panel__runtime-tip {
  margin: 0;
  color: #60718e;
  font-size: 13px;
  line-height: 1.6;
}

.assistant-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  padding: 2px 0 0;
  max-height: 86px;
  overflow-y: auto;
}

.assistant-suggestions__item {
  padding: 9px 14px;
  border: 1px solid rgba(194, 209, 241, 0.92);
  border-radius: 999px;
  background: rgba(248, 250, 255, 0.96);
  color: #52637f;
  font-size: 13px;
  cursor: pointer;
}

.assistant-messages {
  min-height: 0;
  max-height: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 6px;
}

.assistant-message {
  padding: 12px 14px;
  border-radius: 18px;
  background: #f4f8ff;
}

.assistant-message.is-user {
  align-self: flex-end;
  background: linear-gradient(180deg, #6d92ff, #547bfb);
  color: #ffffff;
}

.assistant-message.is-system {
  border: 1px dashed rgba(93, 133, 239, 0.28);
  background: #fbfdff;
}

.assistant-message.is-pending {
  opacity: 0.82;
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
  border-radius: 22px;
  border: 1px solid rgba(221, 230, 247, 0.95);
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  box-shadow: 0 -10px 24px rgba(255, 255, 255, 0.92);
}

.assistant-input__field-wrap {
  display: grid;
  gap: 8px;
}

.assistant-input__field {
  width: 100%;
  min-height: 78px;
  border: none;
  resize: none;
  outline: none;
  background: transparent;
  color: #233352;
  font-size: 14px;
}

.assistant-input__busy-tip {
  color: #ef7e2f;
  font-size: 12px;
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
  background: rgba(95, 131, 238, 0.1);
  color: #4166d5;
  font-weight: 700;
}

.assistant-input__voice.is-recording {
  background: rgba(255, 156, 75, 0.16);
  color: #ce6f20;
}

.assistant-input__send {
  min-width: 102px;
  min-height: 42px;
  background: linear-gradient(180deg, #6f91ff, #4f76fb);
  color: #ffffff;
  font-weight: 700;
}

.assistant-input__voice:disabled,
.assistant-input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1280px) {
  .assistant-demo {
    position: static;
  }

  .assistant-trigger {
    margin-top: 16px;
  }

  .assistant-panel {
    width: 100%;
    max-height: none;
    margin-top: 16px;
    overflow: visible;
  }

  .assistant-panel__body {
    grid-template-rows: auto auto auto auto;
    overflow: visible;
  }

  .assistant-panel__chat-card,
  .assistant-suggestions {
    min-height: auto;
    max-height: none;
  }
}

@media (max-width: 640px) {
  .assistant-demo {
    top: 12px;
    right: 12px;
    left: 12px;
  }

  .assistant-trigger {
    width: 100%;
  }

  .assistant-panel {
    width: 100%;
    padding: 14px;
  }

  .assistant-panel__text-button {
    padding-inline: 10px;
  }
}
</style>
