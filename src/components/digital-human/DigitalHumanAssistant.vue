<template>
  <section class="assistant-demo">
    <button
      v-if="!isExpanded"
      type="button"
      class="assistant-trigger"
      aria-label="打开数字人助手"
      @click="expand"
    >
      <img class="assistant-trigger__avatar" :src="manifest.fallbackPosterUrl || fallbackPosterUrl" alt="" />
      <span class="assistant-trigger__content">
        <strong>数字人助手</strong>
        <span>点击展开 Live2D 演示</span>
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
            aria-label="收起数字人助手"
            @click="collapse"
          >
            ×
          </button>
        </div>
      </header>

      <div class="assistant-panel__body">
        <div class="assistant-panel__stage">
          <Live2DStage
            :manifest="manifest"
            :state="status"
            :speech-result="speechResult"
            :autoplay-token="speechToken"
            @speech-complete="handleSpeechComplete"
          />

          <div class="assistant-panel__summary">
            <p class="assistant-panel__eyebrow">Live2D Demo</p>
            <h1>实时对话 + 状态机 + 能量口型驱动</h1>
            <p class="assistant-panel__description">
              {{ latestAssistantText }}
            </p>
            <p class="assistant-panel__hint">
              当前运行模式：{{ manifestModeLabel }}。项目已切到 `Live2D + Motion + 参数驱动`，后续只要替换正式模型包和
              TTS 接口即可继续升级。
            </p>
          </div>
        </div>

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

        <footer class="assistant-input">
          <div class="assistant-input__field-wrap">
            <textarea
              v-model="inputText"
              class="assistant-input__field"
              rows="3"
              placeholder="请输入你想演示的问题"
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
              发送问题
            </button>
          </div>
        </footer>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Live2DStage from './Live2DStage.vue'
import { AVATAR_MANIFEST_URL, DEFAULT_AVATAR_MANIFEST } from './avatar-manifest'
import type { AvatarManifest, DemoMessage } from './avatar-types'
import { useDigitalHumanDemo } from './useDigitalHumanDemo'

const fallbackPosterUrl = '/digital-human/avatar.jpg'

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

const manifest = ref<AvatarManifest>(DEFAULT_AVATAR_MANIFEST)
const manifestLoadedFromFile = ref(false)
const messagesRef = ref<HTMLElement | null>(null)

const statusLabel = computed(() => {
  switch (status.value) {
    case 'listening':
      return '正在聆听'
    case 'thinking':
      return '正在思考'
    case 'speaking':
      return '正在回答'
    default:
      return '在线待命'
  }
})

const manifestModeLabel = computed(() =>
  manifestLoadedFromFile.value ? '正式 manifest + Live2D 样例模型' : '默认 Live2D manifest 回退'
)

const roleLabelMap: Record<DemoMessage['role'], string> = {
  user: '你',
  assistant: '数字人',
  system: '系统',
}

const normalizeManifest = (incoming: Partial<AvatarManifest>): AvatarManifest => ({
  ...DEFAULT_AVATAR_MANIFEST,
  ...incoming,
  textures: incoming.textures?.length ? incoming.textures : DEFAULT_AVATAR_MANIFEST.textures,
  motions: {
    ...DEFAULT_AVATAR_MANIFEST.motions,
    ...(incoming.motions || {}),
  },
  expressions: incoming.expressions || DEFAULT_AVATAR_MANIFEST.expressions,
  layout: {
    ...DEFAULT_AVATAR_MANIFEST.layout,
    ...(incoming.layout || {}),
  },
  parameters: {
    ...DEFAULT_AVATAR_MANIFEST.parameters,
    ...(incoming.parameters || {}),
  },
})

const loadManifest = async () => {
  try {
    const response = await fetch(AVATAR_MANIFEST_URL, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`manifest request failed: ${response.status}`)
    }

    const data = (await response.json()) as Partial<AvatarManifest>
    manifest.value = normalizeManifest(data)
    manifestLoadedFromFile.value = true
  } catch {
    manifest.value = DEFAULT_AVATAR_MANIFEST
    manifestLoadedFromFile.value = false
  }
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

onMounted(() => {
  void loadManifest()
})
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
  gap: 14px;
  min-width: 220px;
  padding: 12px 14px 12px 12px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
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
  width: min(430px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
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
  margin-bottom: 14px;
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

.assistant-panel__status-dot.is-listening {
  background: #38bdf8;
  box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.14);
}

.assistant-panel__status-dot.is-thinking {
  background: #f59e0b;
  box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.14);
}

.assistant-panel__status-dot.is-speaking {
  background: #2563eb;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12);
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

.assistant-panel__body {
  display: grid;
  gap: 14px;
}

.assistant-panel__stage {
  display: grid;
  gap: 12px;
}

.assistant-panel__summary {
  display: grid;
  gap: 8px;
}

.assistant-panel__eyebrow {
  margin: 0;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.assistant-panel__summary h1 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.2;
}

.assistant-panel__description,
.assistant-panel__hint {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.6;
}

.assistant-panel__hint {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.96);
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
  border-radius: 20px;
  background: #f8fafc;
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
  color: #0f172a;
  font-size: 14px;
}

.assistant-input__busy-tip {
  color: #f97316;
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
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
}

.assistant-input__voice.is-recording {
  background: rgba(249, 115, 22, 0.14);
  color: #c2410c;
}

.assistant-input__send {
  min-width: 102px;
  min-height: 42px;
  background: #0f172a;
  color: #ffffff;
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
    justify-content: center;
  }

  .assistant-panel {
    width: 100%;
  }
}
</style>
