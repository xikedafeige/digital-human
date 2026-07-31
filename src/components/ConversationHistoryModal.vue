<template>
  <a-modal
    :open="open"
    title="历史对话"
    :footer="null"
    :width="430"
    :body-style="historyModalBodyStyle"
    centered
    @cancel="close"
  >
    <div class="history-modal__content">
      <div v-if="isLoading" class="history-modal__state">正在加载中，请耐心等待...</div>
      <div v-else-if="errorMessage" class="history-modal__state is-error">
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadConversations">重新加载</button>
      </div>
      <div v-else-if="!conversations.length" class="history-modal__state">暂无历史对话</div>

      <div v-else class="history-modal__list">
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          type="button"
          class="history-modal__item"
          :class="{ 'is-active': conversation.id === activeConversationId }"
          @click="loadMessages(conversation)"
        >
          <span class="history-modal__title-row">
            <strong>{{ conversation.title }}</strong>
            <small
              v-if="conversation.conversationType"
              :class="conversation.conversationType === 'project' ? 'is-project' : 'is-digital-human'"
            >
              {{ conversation.conversationType === 'project' ? '项目助手' : '数字人' }}
            </small>
          </span>
          <span>{{ formatTime(conversation.updatedAt || conversation.lastMessageAt) }} · {{ conversation.messageCount }} 条消息</span>
          <p v-if="conversation.lastMessagePreview">{{ conversation.lastMessagePreview }}</p>
        </button>
      </div>

      <div
        v-if="isMessagesLoading || messagesError"
        class="history-modal__message-overlay"
        :class="{ 'is-error': Boolean(messagesError) }"
      >
        <template v-if="isMessagesLoading">正在加载中，请耐心等待...</template>
        <template v-else>
          <span>{{ messagesError }}</span>
          <button v-if="retryConversation" type="button" @click="loadMessages(retryConversation)">重试</button>
        </template>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Modal as AModal } from 'ant-design-vue'
import {
  fetchGuideConversationMessages,
  fetchGuideConversations,
  type GuideConversationMessage,
  type GuideConversationSummary,
} from '@/services/guide-api'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (
    event: 'select-messages',
    messages: GuideConversationMessage[],
    conversation: GuideConversationSummary,
  ): void
}>()

const conversations = ref<GuideConversationSummary[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const isMessagesLoading = ref(false)
const messagesError = ref('')
const activeConversationId = ref('')
const retryConversation = ref<GuideConversationSummary | null>(null)
let listRequest: AbortController | null = null
let messagesRequest: AbortController | null = null
const historyModalBodyStyle = {
  height: 'clamp(240px, 58vh, 420px)',
  overflow: 'hidden',
}

const close = () => emit('update:open', false)

const formatTime = (value: string) => {
  const normalized = value.trim().replace(' ', 'T')
  const timestamp = normalized ? Date.parse(normalized) : Number.NaN
  if (!Number.isFinite(timestamp)) {
    return value || '时间未知'
  }

  const date = new Date(timestamp)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const cancelRequests = () => {
  listRequest?.abort()
  listRequest = null
  messagesRequest?.abort()
  messagesRequest = null
  isLoading.value = false
  isMessagesLoading.value = false
}

const loadConversations = async () => {
  listRequest?.abort()
  const controller = new AbortController()
  listRequest = controller
  isLoading.value = true
  errorMessage.value = ''
  messagesError.value = ''
  retryConversation.value = null

  try {
    const nextConversations = await fetchGuideConversations(controller.signal)
    if (!controller.signal.aborted) {
      conversations.value = nextConversations
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      errorMessage.value = error instanceof Error ? error.message : '服务端历史加载失败'
    }
  } finally {
    if (listRequest === controller) {
      listRequest = null
      isLoading.value = false
    }
  }
}

const loadMessages = async (conversation: GuideConversationSummary) => {
  messagesRequest?.abort()
  const controller = new AbortController()
  messagesRequest = controller
  activeConversationId.value = conversation.id
  isMessagesLoading.value = true
  messagesError.value = ''
  retryConversation.value = conversation

  try {
    const messages = await fetchGuideConversationMessages(conversation.id, controller.signal)
    if (controller.signal.aborted) {
      return
    }

    if (!messages.length) {
      throw new Error('该会话暂无可展示的消息')
    }

    emit('select-messages', messages, conversation)
    close()
  } catch (error) {
    if (!controller.signal.aborted) {
      messagesError.value = error instanceof Error ? error.message : '会话消息加载失败'
    }
  } finally {
    if (messagesRequest === controller) {
      messagesRequest = null
      isMessagesLoading.value = false
    }
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      void loadConversations()
      return
    }

    cancelRequests()
  },
)

onBeforeUnmount(cancelRequests)
</script>

<style scoped lang="less">
.history-modal__list { display: grid; gap: 9px; flex: 1; min-height: 0; overflow-y: auto; padding: 2px; scrollbar-gutter: stable; }
.history-modal__content { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.history-modal__item { display: grid; gap: 4px; width: 100%; padding: 11px 12px; border: 1px solid #dfe3ea; border-radius: 9px; background: #fff; color: #768197; text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease; }
.history-modal__item:hover, .history-modal__item.is-active { border-color: #a9c7fa; background: #f5f9ff; }
.history-modal__title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.history-modal__title-row strong { flex: 1; min-width: 0; overflow: hidden; color: #27364f; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.history-modal__title-row small { flex: none; padding: 1px 6px; border-radius: 999px; background: #eef4ff; color: #547ae2; font-size: 9px; line-height: 16px; }
.history-modal__title-row small.is-project { background: #f3efff; color: #7957c7; }
.history-modal__title-row small.is-digital-human { background: #eef6ff; color: #397ce0; }
.history-modal__item > span:not(.history-modal__title-row) { font-size: 11px; line-height: 17px; }
.history-modal__item p { margin: 0; overflow: hidden; color: #929bab; font-size: 11px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }
.history-modal__state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; color: #8b929d; font-size: 12px; text-align: center; }
.history-modal__state.is-error, .history-modal__message-overlay.is-error { flex-direction: column; color: #d05b48; }
.history-modal__state button, .history-modal__message-overlay button { padding: 5px 12px; border: 1px solid #cbd9ef; border-radius: 6px; background: #fff; color: #4384e8; cursor: pointer; }
.history-modal__message-overlay { position: absolute; z-index: 2; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; background: rgba(250, 251, 253, .88); color: #8b929d; font-size: 12px; text-align: center; }
</style>
