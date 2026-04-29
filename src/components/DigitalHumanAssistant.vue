<!-- 数字人面板组件，负责入口 UI、消息展示、输入区和语音交互控制。 -->
<template>
	<section class="assistant-demo">
		<div class="assistant-panel" :class="{ 'is-wide': isWidePanel }">
			<header class="assistant-panel__header">
				<div class="assistant-panel__identity">
					<span class="assistant-panel__status-dot" :class="`is-${status}`"></span>
					<div>
						<strong>数字人小助</strong>
						<p>{{ statusLabel }}</p>
					</div>
				</div>

				<div class="assistant-panel__actions">
					<button type="button" class="assistant-panel__icon-button" :aria-label="isWidePanel ? '收起面板' : '展开面板'"
						:title="isWidePanel ? '收起面板' : '展开面板'" :data-tooltip="isWidePanel ? '收起面板' : '展开面板'"
						@click="isWidePanel = !isWidePanel">
						<svg v-if="!isWidePanel" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M8 5H5v3" />
							<path d="M5 5l5.2 5.2" />
							<path d="M16 19h3v-3" />
							<path d="M19 19l-5.2-5.2" />
							<path d="M16 5h3v3" />
							<path d="M19 5l-5.2 5.2" />
							<path d="M8 19H5v-3" />
							<path d="M5 19l5.2-5.2" />
						</svg>
						<svg v-else viewBox="0 0 24 24" aria-hidden="true">
							<path d="M10 4v6H4" />
							<path d="M4 10l6-6" />
							<path d="M14 20v-6h6" />
							<path d="M20 14l-6 6" />
							<path d="M14 4v6h6" />
							<path d="M20 10l-6-6" />
							<path d="M10 20v-6H4" />
							<path d="M4 14l6 6" />
						</svg>
					</button>
					<button type="button" class="assistant-panel__icon-button" aria-label="新建对话" title="新建对话" data-tooltip="新建对话"
						@click="clearConversation">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 5v14" />
							<path d="M5 12h14" />
							<path d="M5.8 5.8h7.7" />
							<path d="M5.8 5.8v12.4h12.4v-7.7" />
						</svg>
					</button>
				</div>
			</header>

			<div class="assistant-panel__body">
				<div class="assistant-panel__stage-shell">
					<VideoDigitalHumanStage :state="status" :speech-result="speechResult" :autoplay-token="speechToken"
						@speech-complete="handleSpeechComplete" @speech-progress="handleSpeechProgress" />

					<section class="assistant-panel__chat-card">
						<header class="assistant-panel__chat-header">
							<div class="assistant-panel__llm-chip">
								<span class="assistant-panel__llm-dot"></span>
								<span>LLM 已接入</span>
							</div>
							<div class="assistant-panel__runtime-tip">
								<span>{{ statusHint }}</span>
							</div>
						</header>

						<section ref="messagesRef" class="assistant-messages">
							<article v-for="message in messages" :key="message.id" class="assistant-message" :class="[
								`is-${message.role}`,
								{
									'is-pending': message.pending,
									'is-speech-active': message.id === speechPlaybackMessageId,
								},
							]">
								<header class="assistant-message__meta">
									<strong>{{ roleLabelMap[message.role] }}</strong>
									<time>{{ formatTime(message.timestamp) }}</time>
								</header>

								<div v-if="message.thinkContent" class="assistant-message__think"
									:class="{ 'is-collapsed': message.thinkCollapsed }">
									<button type="button" class="assistant-message__think-toggle" @click="handleThinkToggle(message.id)">
										<span>思考过程</span>
										<span class="assistant-message__think-arrow" :class="{ 'is-collapsed': message.thinkCollapsed }"
											aria-hidden="true"></span>
									</button>

									<div v-show="!message.thinkCollapsed"
										class="assistant-message__markdown assistant-message__think-markdown"
										v-html="renderMessageHtml(message.thinkContent)"></div>
								</div>

								<div v-if="speechLoadingMessageId === message.id" class="assistant-message__speech-loading">
									<span></span>
									语音加载中...
								</div>

								<div v-if="message.renderMode === 'markdown' && message.content" class="assistant-message__markdown"
									v-html="renderMessageHtml(message.content)"></div>
								<p v-else-if="message.content" class="assistant-message__plain">
									{{ message.content }}
								</p>

								<div v-if="canShowMessageActions(message)" class="assistant-message__actions" aria-label="消息操作">
									<button type="button" class="assistant-message__action-button"
										:class="{ 'is-active': copiedMessageId === message.id || messageActionStateMap[message.id] === 'copy' }"
										:aria-label="copiedMessageId === message.id ? '已复制' : '复制'"
										:data-tooltip="copiedMessageId === message.id ? '已复制' : '复制'"
										:disabled="isMessageActionBusy(message.id)" @click="copyMessageContent(message)">
										<svg v-if="copiedMessageId === message.id" viewBox="0 0 24 24" aria-hidden="true">
											<path d="M20 6 9 17l-5-5" />
										</svg>
										<svg v-else viewBox="0 0 24 24" aria-hidden="true">
											<rect x="8" y="8" width="10" height="12" rx="2" />
											<path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
										</svg>
									</button>
									<button type="button" class="assistant-message__action-button" aria-label="重新生成"
										data-tooltip="重新生成" :class="{ 'is-active': messageActionStateMap[message.id] === 'regenerate' }"
										:disabled="isMessageActionBusy(message.id)" @click="handleRegenerateMessage(message.id)">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M21 12a9 9 0 0 1-15.3 6.4" />
											<path d="M3 12A9 9 0 0 1 18.3 5.6" />
											<path d="M18 2v4h-4" />
											<path d="M6 22v-4h4" />
										</svg>
									</button>
									<!-- <button type="button" class="assistant-message__action-button" aria-label="语音朗读"
										data-tooltip="语音朗读" :class="{ 'is-active': isMessageReadActive(message.id) }"
										:disabled="isMessageActionBusy(message.id)" @click="handleReadMessage(message.id)">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M4 10v4h4l5 4V6l-5 4H4Z" />
											<path d="M16 8.5v7" />
											<path d="M19 7v10" />
										</svg>
									</button> -->
									<button type="button" class="assistant-message__action-button"
										:class="{ 'is-active': messageFeedbackMap[message.id] === 'like' }" aria-label="喜欢"
										data-tooltip="喜欢" :disabled="isMessageActionBusy(message.id)"
										@click="setMessageFeedback(message.id, 'like')">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M7 10v10" />
											<path d="M11 9l1-5a2 2 0 0 1 3.9.8L15 10h4a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7" />
											<path d="M3 10h4v10H3z" />
										</svg>
									</button>
									<button type="button" class="assistant-message__action-button"
										:class="{ 'is-active': messageFeedbackMap[message.id] === 'dislike' }" aria-label="不喜欢"
										data-tooltip="不喜欢" :disabled="isMessageActionBusy(message.id)"
										@click="setMessageFeedback(message.id, 'dislike')">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M17 14V4" />
											<path d="M13 15l-1 5a2 2 0 0 1-3.9-.8L9 14H5a2 2 0 0 1-2-2.3l1-6A2 2 0 0 1 6 4h11" />
											<path d="M17 4h4v10h-4z" />
										</svg>
									</button>
								</div>

								<div v-if="message.id === speechPlaybackMessageId && speechFollowText"
									class="assistant-message__follow">
									<span class="assistant-message__follow-done">
										{{ speechFollowText.slice(0, speechFollowHighlightIndex) }}
									</span>
									<span class="assistant-message__follow-rest">
										{{ speechFollowText.slice(speechFollowHighlightIndex) }}
									</span>
								</div>

								<div v-if="message.id === speechPlaybackMessageId" class="assistant-message__speech-progress"
									aria-hidden="true">
									<span :style="{ transform: `scaleX(${speechOverallProgress})` }"></span>
								</div>
							</article>
						</section>
					</section>
				</div>

				<footer class="assistant-input">
					<section v-if="suggestions.length" class="assistant-suggestions">
						<button v-for="item in suggestions" :key="item" type="button" class="assistant-suggestions__item"
							@click="sendText(item)">
							{{ item }}
						</button>
					</section>

					<div class="assistant-input__field-wrap">
						<textarea v-model="inputText" class="assistant-input__field" rows="3" placeholder="输入问题..."
							:disabled="isRecording" @keydown="handleInputKeydown"></textarea>

						<button type="button" class="assistant-input__voice-icon" :class="{
							'is-recording': actionButtonMode === 'stop',
							'is-interrupt': actionButtonMode === 'interrupt',
						}" :aria-label="actionButtonLabel" :data-tooltip="actionButtonLabel" @click="handleActionButtonClick">
							<svg v-if="actionButtonMode === 'record'" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M12 14.5c1.7 0 3-1.3 3-3V6.8c0-1.7-1.3-3-3-3s-3 1.3-3 3v4.7c0 1.7 1.3 3 3 3Z" />
								<path d="M6.5 11.2c0 3 2.4 5.5 5.5 5.5s5.5-2.5 5.5-5.5" />
								<path d="M12 16.7v3.2" />
								<path d="M9 19.9h6" />
							</svg>
							<svg v-else-if="actionButtonMode === 'send'" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M21 3 10 14" />
								<path d="m21 3-7 18-4-7-7-4 18-7Z" />
							</svg>
							<svg v-else viewBox="0 0 24 24" aria-hidden="true">
								<rect x="8.3" y="8.3" width="7.4" height="7.4" rx="1.4" />
							</svg>
						</button>

						<div class="assistant-input__helper" aria-live="polite">
							<span class="assistant-input__helper-text" :class="{
								'is-busy': helperTone === 'busy',
								'is-hint': helperTone === 'hint',
								'is-empty': !helperText,
							}" :title="helperTitle">
								{{ helperText || ' ' }}
							</span>
						</div>
					</div>
				</footer>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { DemoMessage } from '@/types/avatar-types'
import { markdownToPlainText, renderMarkdownToHtml } from '@/utils/message-content'
import { useDigitalHumanDemo } from '@/hooks/useDigitalHumanDemo'
import VideoDigitalHumanStage from './VideoDigitalHumanStage.vue'
import { VIDEO_STATUS_LABELS } from '@/config/video-avatar-config'

const {
	clearConversation,
	handleSpeechComplete,
	handleSpeechProgress,
	hasInput,
	inputHint,
	inputText,
	interruptCurrentFlow,
	isBusy,
	isRecording,
	isSpeechSynthesizing,
	messages,
	readMessageAloud,
	regenerateAssistantMessage,
	sendText,
	showInterruptButton,
	speechCompletedMessageIds,
	speechResult,
	speechFollowHighlightIndex,
	speechFollowText,
	speechOverallProgress,
	speechPlaybackMessageId,
	speechToken,
	speechLoadingMessageId,
	startVoiceInput,
	status,
	stopVoiceInput,
	submitInput,
	suggestions,
	toggleThinkVisibility,
} = useDigitalHumanDemo()

const messagesRef = ref<HTMLElement | null>(null)
const isWidePanel = ref(false)
const shouldSkipNextMessageAutoScroll = ref(false)
const copiedMessageId = ref('')
const messageFeedbackMap = ref<Record<string, MessageFeedback | undefined>>({})
const messageActionStateMap = ref<Record<string, MessageActionState | undefined>>({})
type ActionButtonMode = 'record' | 'send' | 'stop' | 'interrupt'
type HelperTone = 'idle' | 'busy' | 'hint'
type MessageFeedback = 'like' | 'dislike'
type MessageActionState = 'copy' | 'regenerate' | 'read'
let copiedMessageTimer: number | null = null
const messageActionStateTimers = new Map<string, number>()
const IDLE_RUNTIME_TIP = '你好，我是数字人小助，很高兴为您服务！'

// 根据当前视频状态展示头部状态文案。
const statusLabel = computed(() => VIDEO_STATUS_LABELS[status.value])

// 汇总录音、生成、播报和空闲状态下的运行提示。
const statusHint = computed(() => {
	if (isRecording.value) {
		return '录音中，再次点击按钮后将结束录音并开始识别。'
	}

	if (showInterruptButton.value && !isBusy.value) {
		return '正在等待语音识别结果，可点击右侧按钮打断。'
	}

	if (isSpeechSynthesizing.value) {
		return '语音跟读中...'
	}

	if (status.value === 'speaking') {
		return '语音跟读中...'
	}

	if (status.value === 'thinking') {
		return '思考中...'
	}

	return IDLE_RUNTIME_TIP
})

const roleLabelMap: Record<DemoMessage['role'], string> = {
	user: '你',
	assistant: '数字人',
	system: '系统',
}

// 统一渲染 Markdown 消息，保持模板中 v-html 来源可控。
const renderMessageHtml = (content: string) => renderMarkdownToHtml(content)

const getMessagePlainText = (message: DemoMessage) =>
	markdownToPlainText(message.content) || message.content

// 跟读完成后才显示操作栏，动作反馈期间保留当前操作按钮可见。
const canShowMessageActions = (message: DemoMessage) =>
	message.role === 'assistant' &&
	!message.pending &&
	Boolean(message.content.trim()) &&
	(speechCompletedMessageIds.value.includes(message.id) || Boolean(messageActionStateMap.value[message.id]))

// 单条消息朗读中包含加载和播放阶段，用于同步按钮高亮。
const isMessageReadActive = (messageId: string) =>
	messageActionStateMap.value[messageId] === 'read' ||
	speechPlaybackMessageId.value === messageId ||
	speechLoadingMessageId.value === messageId

const isMessageActionBusy = (messageId: string) =>
	messageActionStateMap.value[messageId] === 'regenerate' ||
	isMessageReadActive(messageId)

// 记录短暂操作反馈，避免点击后按钮没有状态变化。
const markMessageAction = (messageId: string, action: MessageActionState, duration = 1400) => {
	messageActionStateMap.value = {
		...messageActionStateMap.value,
		[messageId]: action,
	}

	const existingTimer = messageActionStateTimers.get(messageId)
	if (existingTimer !== undefined) {
		window.clearTimeout(existingTimer)
	}

	const timer = window.setTimeout(() => {
		messageActionStateTimers.delete(messageId)
		if (messageActionStateMap.value[messageId] === action) {
			const nextMap = { ...messageActionStateMap.value }
			delete nextMap[messageId]
			messageActionStateMap.value = nextMap
		}
	}, duration)
	messageActionStateTimers.set(messageId, timer)
}

// 复制成功后短暂切换为已复制状态，再自动恢复。
const markMessageCopied = (messageId: string) => {
	copiedMessageId.value = messageId

	if (copiedMessageTimer !== null) {
		window.clearTimeout(copiedMessageTimer)
	}

	copiedMessageTimer = window.setTimeout(() => {
		copiedMessageTimer = null
		if (copiedMessageId.value === messageId) {
			copiedMessageId.value = ''
		}
	}, 2000)
}

const fallbackCopyText = (text: string) => {
	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.style.position = 'fixed'
	textarea.style.left = '-9999px'
	document.body.appendChild(textarea)
	textarea.select()

	try {
		document.execCommand('copy')
	} finally {
		document.body.removeChild(textarea)
	}
}

// 将 assistant 正文转成纯文本后复制，Clipboard 不可用时回退到 textarea。
const copyMessageContent = async (message: DemoMessage) => {
	const plainText = getMessagePlainText(message).trim()
	if (!plainText) {
		return
	}

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(plainText)
		} else {
			fallbackCopyText(plainText)
		}

		markMessageCopied(message.id)
		markMessageAction(message.id, 'copy')
	} catch {
		fallbackCopyText(plainText)
		markMessageCopied(message.id)
		markMessageAction(message.id, 'copy')
	}
}

// 复用上一条用户问题替换生成当前 assistant 回复。
const handleRegenerateMessage = (messageId: string) => {
	delete messageFeedbackMap.value[messageId]
	markMessageAction(messageId, 'regenerate', 2200)
	regenerateAssistantMessage(messageId)
}

// 触发当前 assistant 回复的数字人朗读流程。
const handleReadMessage = (messageId: string) => {
	markMessageAction(messageId, 'read', 2200)
	readMessageAloud(messageId)
}

// 喜欢和不喜欢互斥；再次点击当前选中项会取消。
const setMessageFeedback = (messageId: string, feedback: MessageFeedback) => {
	messageFeedbackMap.value[messageId] =
		messageFeedbackMap.value[messageId] === feedback ? undefined : feedback
}

// 根据录音、打断和输入内容决定右下角按钮模式。
const actionButtonMode = computed<ActionButtonMode>(() => {
	if (isRecording.value) {
		return 'stop'
	}

	if (showInterruptButton.value) {
		return 'interrupt'
	}

	if (hasInput.value) {
		return 'send'
	}

	return 'record'
})

// 根据按钮模式生成无障碍标签和 tooltip 文案。
const actionButtonLabel = computed(() => {
	if (actionButtonMode.value === 'stop') {
		return '停止录音'
	}

	if (actionButtonMode.value === 'interrupt') {
		return '打断回答'
	}

	if (actionButtonMode.value === 'send') {
		return '发送'
	}

	return '语音输入'
})

// 决定输入区 helper 的视觉语气：空闲、忙碌或错误提示。
const helperTone = computed<HelperTone>(() => {
	if (inputHint.value) {
		return 'hint'
	}

	if (isSpeechSynthesizing.value) {
		return 'busy'
	}

	if (isBusy.value || showInterruptButton.value) {
		return 'busy'
	}

	return 'idle'
})

// 统一生成输入区左下角提示，避免多个提示节点造成布局跳动。
const helperText = computed(() => {
	if (inputHint.value) {
		return inputHint.value
	}

	if (isSpeechSynthesizing.value) {
		return '语音跟读中...'
	}

	if (isBusy.value || showInterruptButton.value) {
		return showInterruptButton.value
			? status.value === 'speaking'
				? '语音跟读中...'
				: '可点击右侧按钮中断当前流程'
			: '发送新问题会中断当前生成和播报'
	}

	return ''
})

const helperTitle = computed(() => helperText.value || '')

// 处理右下角按钮点击，分发到录音、发送、停止或中断动作。
const handleActionButtonClick = () => {
	if (actionButtonMode.value === 'stop') {
		void stopVoiceInput()
		return
	}

	if (actionButtonMode.value === 'interrupt') {
		interruptCurrentFlow()
		return
	}

	if (actionButtonMode.value === 'send') {
		submitInput()
		return
	}

	void startVoiceInput()
}

// Enter 直接发送，Shift+Enter 保留换行输入。
const handleInputKeydown = (event: KeyboardEvent) => {
	if (event.isComposing) {
		return
	}

	if (event.key === 'Enter' && !event.shiftKey && actionButtonMode.value === 'send') {
		event.preventDefault()
		submitInput()
	}
}

// 格式化消息时间，只展示小时和分钟。
const formatTime = (timestamp: number) =>
	new Date(timestamp).toLocaleTimeString('zh-CN', {
		hour: '2-digit',
		minute: '2-digit',
	})

const scrollMessagesToBottom = () => {
	const messagesElement = messagesRef.value
	if (!messagesElement) {
		return
	}

	messagesElement.scrollTop = messagesElement.scrollHeight
}

// 用户展开/收起思考过程时保留当前位置，不触发本次自动滚底。
const handleThinkToggle = (messageId: string) => {
	shouldSkipNextMessageAutoScroll.value = true
	toggleThinkVisibility(messageId)
}

watch(
	messages,
	() => {
		if (shouldSkipNextMessageAutoScroll.value) {
			shouldSkipNextMessageAutoScroll.value = false
			return
		}

		nextTick(() => {
			scrollMessagesToBottom()
		})
	},
	{ deep: true },
)

onBeforeUnmount(() => {
	if (copiedMessageTimer !== null) {
		window.clearTimeout(copiedMessageTimer)
	}

	messageActionStateTimers.forEach((timer) => window.clearTimeout(timer))
	messageActionStateTimers.clear()
})
</script>

<style scoped lang="less">
.assistant-demo {
	position: fixed;
	inset: 0;
	z-index: 40;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 12px;
}

.assistant-panel {
	width: min(520px, calc(100vw - 32px));
	height: calc(100dvh - 24px);
	max-height: calc(100dvh - 24px);
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

.assistant-panel.is-wide {
	width: min(760px, calc(100vw - 32px));
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

.assistant-panel__icon-button {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 34px;
	height: 34px;
	border: none;
	cursor: pointer;
	padding: 0;
	border-radius: 12px;
	color: #5e83ef;
	background: rgba(96, 133, 239, 0.12);
}

.assistant-panel__icon-button:hover {
	background: rgba(96, 133, 239, 0.18);
	color: #4267e8;
}

.assistant-panel__icon-button::after {
	content: attr(data-tooltip);
	position: absolute;
	right: 0;
	top: calc(100% + 6px);
	z-index: 30;
	padding: 5px 8px;
	border-radius: 8px;
	background: rgba(34, 43, 60, 0.92);
	color: #ffffff;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
	opacity: 0;
	pointer-events: none;
}

.assistant-panel__icon-button:hover::after,
.assistant-panel__icon-button:focus-visible::after {
	opacity: 1;
}

.assistant-panel__icon-button svg {
	width: 18px;
	height: 18px;
	fill: none;
	stroke: currentColor;
	stroke-width: 1.9;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.assistant-panel__body {
	flex: 1;
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	gap: 7px;
	min-height: 0;
	padding-bottom: 2px;
	overflow: hidden;
}

.assistant-panel__stage-shell {
	display: grid;
	grid-template-rows: minmax(180px, 0.48fr) minmax(170px, 0.52fr);
	height: 100%;
	min-height: 0;
	overflow: hidden;
	border: 1px solid rgba(226, 233, 248, 0.62);
	border-radius: 22px;
	background: linear-gradient(180deg, #fafaf8 0%, #fafaf8 51%, #ffffff 51%, #f8fbff 100%);
	box-shadow:
		0 6px 14px rgba(88, 116, 156, 0.04),
		inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.assistant-panel.is-wide .assistant-panel__stage-shell {
	grid-template-columns: minmax(280px, 0.9fr) minmax(340px, 1.1fr);
	grid-template-rows: minmax(0, 1fr);
	height: 100%;
	background: linear-gradient(90deg, #fafaf8 0%, #fafaf8 48%, #ffffff 48%, #f8fbff 100%);
}

.assistant-panel__chat-card {
	display: grid;
	grid-template-rows: auto minmax(0, 1fr);
	gap: 8px;
	padding: 12px 12px 10px;
	padding-top: 30px;
	border-top: 1px solid rgba(220, 229, 246, 0.72);
	background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
	min-height: 0;
	overflow: hidden;
}

.assistant-panel.is-wide .assistant-panel__chat-card {
	padding-top: 12px;
	border-top: none;
	border-left: 1px solid rgba(220, 229, 246, 0.72);
}

.assistant-panel__chat-header {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.assistant-panel__llm-chip {
	display: inline-flex;
	align-items: center;
	flex: none;
	gap: 5px;
	width: fit-content;
	padding: 4px 8px;
	border-radius: 999px;
	border: 1px solid rgba(187, 213, 250, 0.9);
	background: rgba(240, 247, 255, 0.9);
	color: #5d85ef;
	font-size: 10px;
	font-weight: 700;
	line-height: 1.2;
}

.assistant-panel__llm-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #33c47a;
	box-shadow: 0 0 0 3px rgba(51, 196, 122, 0.12);
}

.assistant-panel__runtime-tip {
	position: relative;
	flex: 1 1 auto;
	min-width: 0;
	margin: 0;
	color: #60718e;
	font-size: 12px;
	line-height: 1.4;
}

.assistant-panel__runtime-tip span {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-suggestions {
	position: relative;
	z-index: 1;
	display: flex;
	flex-wrap: nowrap;
	gap: 7px;
	min-width: 0;
	margin: -2px -4px 8px 0;
	padding: 2px 18px 4px 1px;
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
	white-space: nowrap;
	mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent 100%);
}

.assistant-suggestions::-webkit-scrollbar {
	display: none;
}

.assistant-suggestions__item {
	flex: 0 0 auto;
	padding: 6px 10px;
	border: 1px solid rgba(205, 217, 243, 0.88);
	border-radius: 999px;
	background: rgba(244, 248, 255, 0.82);
	color: #536684;
	font-size: 12px;
	line-height: 1.2;
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		background 0.18s ease,
		color 0.18s ease;
}

.assistant-suggestions__item:hover {
	border-color: rgba(111, 146, 255, 0.58);
	background: rgba(233, 240, 255, 0.96);
	color: #4267e8;
}

.assistant-messages {
	min-height: 0;
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

.assistant-message.is-speech-active {
	box-shadow:
		inset 0 0 0 1px rgba(79, 120, 255, 0.18),
		0 10px 22px rgba(79, 120, 255, 0.08);
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

.assistant-message__plain {
	margin: 0;
	font-size: 14px;
	line-height: 1.6;
	white-space: pre-wrap;
}

.assistant-message__markdown {
	color: inherit;
	font-size: 14px;
	line-height: 1.6;
	word-break: break-word;
}

.assistant-message__markdown :deep(*:first-child) {
	margin-top: 0;
}

.assistant-message__markdown :deep(*:last-child) {
	margin-bottom: 0;
}

.assistant-message__markdown :deep(p) {
	margin: 0 0 8px;
}

.assistant-message__markdown :deep(ul),
.assistant-message__markdown :deep(ol) {
	margin: 0 0 8px;
	padding-left: 18px;
}

.assistant-message__markdown :deep(li + li) {
	margin-top: 4px;
}

.assistant-message__markdown :deep(code) {
	padding: 1px 4px;
	border-radius: 6px;
	background: rgba(24, 39, 75, 0.08);
	font-size: 0.92em;
}

.assistant-message__markdown :deep(pre) {
	margin: 0 0 8px;
	padding: 10px 12px;
	border-radius: 12px;
	background: rgba(24, 39, 75, 0.08);
	overflow-x: auto;
}

.assistant-message__markdown :deep(pre code) {
	padding: 0;
	background: transparent;
}

.assistant-message__think {
	margin-bottom: 10px;
	border-radius: 14px;
	border: 1px solid rgba(197, 210, 235, 0.85);
	background: rgba(255, 255, 255, 0.62);
	overflow: hidden;
}

.assistant-message__think.is-collapsed {
	margin-bottom: 12px;
}

.assistant-message__think-toggle {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 12px;
	border: none;
	background: transparent;
	color: #536684;
	font-size: 12px;
	font-weight: 700;
	cursor: pointer;
}

.assistant-message__think-arrow {
	width: 8px;
	height: 8px;
	border-right: 2px solid currentColor;
	border-bottom: 2px solid currentColor;
	transform: rotate(45deg);
	transition: transform 0.2s ease;
}

.assistant-message__think-arrow.is-collapsed {
	transform: rotate(-45deg);
}

.assistant-message__think-markdown {
	padding: 0 12px 12px;
	color: #5b6c88;
	font-size: 13px;
}

.assistant-message__speech-loading {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	width: fit-content;
	margin: 0 0 8px;
	padding: 6px 9px;
	border-radius: 10px;
	background: rgba(79, 120, 255, 0.08);
	color: #5f72a0;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.2;
}

.assistant-message__speech-loading span {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #5d85ef;
	box-shadow: 0 0 0 4px rgba(93, 133, 239, 0.12);
}

.assistant-message__actions {
	position: relative;
	display: flex;
	align-items: center;
	gap: 4px;
	margin-top: 8px;
	color: #7c8aa5;
}

.assistant-message__action-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	padding: 0;
	position: relative;
	border: 1px solid transparent;
	border-radius: 8px;
	background: transparent;
	color: inherit;
	cursor: pointer;
	transition:
		background 0.18s ease,
		border-color 0.18s ease,
		color 0.18s ease;
}

.assistant-message__action-button::after {
	content: attr(data-tooltip);
	position: absolute;
	left: 50%;
	bottom: calc(100% + 7px);
	z-index: 30;
	padding: 5px 8px;
	border-radius: 8px;
	background: rgba(34, 43, 60, 0.92);
	color: #ffffff;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
	opacity: 0;
	pointer-events: none;
	transform: translateX(-50%);
}

.assistant-message__action-button:hover,
.assistant-message__action-button:focus-visible,
.assistant-message__action-button.is-active {
	border-color: rgba(111, 146, 255, 0.24);
	background: rgba(79, 120, 255, 0.09);
	color: #4267e8;
}

.assistant-message__action-button:hover::after,
.assistant-message__action-button:focus-visible::after {
	opacity: 1;
}

.assistant-message__action-button:disabled {
	cursor: default;
	opacity: 0.7;
}

.assistant-message__action-button:disabled::after {
	display: none;
}

.assistant-message__action-button svg {
	width: 16px;
	height: 16px;
	fill: none;
	stroke: currentColor;
	stroke-width: 1.8;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.assistant-message__follow {
	margin-top: 10px;
	padding: 10px 12px;
	border-radius: 14px;
	background: rgba(79, 120, 255, 0.08);
	color: #8a97ad;
	font-size: 13px;
	line-height: 1.7;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.assistant-message__follow-done {
	color: #2457ff;
	font-weight: 700;
}

.assistant-message__follow-rest {
	color: #8a97ad;
}

.assistant-message__speech-progress {
	height: 3px;
	margin-top: 10px;
	border-radius: 999px;
	background: rgba(79, 120, 255, 0.12);
	overflow: hidden;
}

.assistant-message__speech-progress span {
	display: block;
	width: 100%;
	height: 100%;
	border-radius: inherit;
	background: linear-gradient(90deg, #6d92ff, #4f78ff);
	transform: scaleX(0);
	transform-origin: left center;
	transition: transform 120ms linear;
}

.assistant-input {
	min-width: 0;
	padding: 10px 12px 12px;
	border-radius: 18px 18px 22px 22px;
	border: 1px solid rgba(221, 230, 247, 0.72);
	background: linear-gradient(180deg, #ffffff, #f8fbff);
	box-shadow: 0 -1px 6px rgba(214, 226, 246, 0.22);
	overflow: hidden;
}

.assistant-input__field-wrap {
	position: relative;
	display: grid;
	min-width: 0;
	grid-template-columns: minmax(0, 1fr) 50px;
	grid-template-rows: auto 38px;
	column-gap: 10px;
	row-gap: 6px;
	align-items: center;
}

.assistant-input__field {
	grid-column: 1 / -1;
	grid-row: 1;
	width: 100%;
	min-height: 56px;
	padding: 0;
	border: none;
	resize: none;
	outline: none;
	background: transparent;
	color: #233352;
	font-size: 14px;
}

.assistant-input__voice-icon {
	position: relative;
	grid-column: 2;
	grid-row: 2;
	justify-self: end;
	align-self: end;
	top: 5px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 38px;
	height: 38px;
	border: none;
	border-radius: 50%;
	background: linear-gradient(180deg, #eef4ff, #dfe9ff);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
	color: #4f76fb;
	cursor: pointer;
	touch-action: none;
	transition:
		background 0.2s ease,
		box-shadow 0.2s ease,
		color 0.2s ease,
		transform 0.2s ease;
}

.assistant-input__voice-icon:hover:not(.is-recording):not(.is-interrupt) {
	background: linear-gradient(180deg, #f2f7ff, #e8f0ff);
	color: #3f67f4;
}

.assistant-input__voice-icon::after {
	content: attr(data-tooltip);
	position: absolute;
	left: 50%;
	bottom: calc(100% + 8px);
	transform: translateX(-50%);
	padding: 4px 8px;
	border-radius: 8px;
	background: rgba(35, 51, 82, 0.92);
	color: #ffffff;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.16s ease;
}

.assistant-input__voice-icon:hover::after,
.assistant-input__voice-icon:focus-visible::after {
	opacity: 1;
}

.assistant-input__voice-icon svg {
	width: 20px;
	height: 20px;
	fill: none;
	stroke: currentColor;
	stroke-width: 2;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.assistant-input__voice-icon.is-recording {
	background: linear-gradient(180deg, #ffe4cc, #ffd2aa);
	box-shadow:
		0 0 0 6px rgba(255, 156, 75, 0.14),
		inset 0 1px 0 rgba(255, 255, 255, 0.72);
	color: #ce6f20;
	animation: voiceIconPulse 1.15s ease-in-out infinite;
}

.assistant-input__voice-icon.is-interrupt {
	background: linear-gradient(180deg, #f7f7f7, #ebebeb);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
	color: #262b33;
}

.assistant-input__voice-icon.is-interrupt:hover {
	background: linear-gradient(180deg, #f4f4f4, #e8e8e8);
}

.assistant-input__voice-icon.is-recording svg,
.assistant-input__voice-icon.is-interrupt svg {
	fill: currentColor;
	stroke: none;
}

.assistant-input__helper {
	grid-column: 1;
	grid-row: 2;
	align-self: end;
	width: 100%;
	min-width: 0;
	max-width: 100%;
	min-height: 18px;
	padding-right: 0;
	transform: translateY(3px);
}

.assistant-input__helper-text {
	display: block;
	width: 100%;
	min-width: 0;
	max-width: 100%;
	min-height: 18px;
	color: transparent;
	font-size: 12px;
	line-height: 18px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-input__helper-text.is-busy {
	color: #ef7e2f;
}

.assistant-input__helper-text.is-hint {
	color: #d95f40;
}

.assistant-input__helper-text.is-empty {
	visibility: hidden;
}

@keyframes voiceIconPulse {

	0%,
	100% {
		transform: scale(1);
	}

	50% {
		transform: scale(1.06);
	}
}

@media (max-height: 820px) and (min-width: 641px) {
	.assistant-panel {
		width: min(500px, calc(100vw - 24px));
		padding: 12px;
		border-radius: 24px;
	}

	.assistant-panel.is-wide {
		width: min(720px, calc(100vw - 24px));
	}

	.assistant-panel__header {
		margin-bottom: 10px;
	}

	.assistant-panel__body {
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 6px;
		padding-bottom: 2px;
	}

	.assistant-panel__stage-shell {
		grid-template-rows: minmax(170px, 0.48fr) minmax(150px, 0.52fr);
		height: 100%;
		border-radius: 18px;
	}

	.assistant-panel.is-wide .assistant-panel__stage-shell {
		grid-template-columns: minmax(250px, 0.9fr) minmax(310px, 1.1fr);
		grid-template-rows: minmax(0, 1fr);
		height: 100%;
	}

	.assistant-panel__chat-card {
		gap: 6px;
		padding: 8px 10px;
	}

	.assistant-panel__chat-header {
		gap: 6px;
	}

	.assistant-panel__llm-chip {
		padding: 3px 7px;
		font-size: 10px;
	}

	.assistant-panel__runtime-tip {
		font-size: 11px;
		line-height: 1.3;
	}

	.assistant-suggestions {
		margin-bottom: 6px;
	}

	.assistant-suggestions__item {
		padding: 5px 9px;
		font-size: 12px;
	}

	.assistant-message {
		padding: 9px 11px;
		border-radius: 14px;
	}

	.assistant-message__meta {
		margin-bottom: 5px;
	}

	.assistant-message__plain,
	.assistant-message__markdown {
		font-size: 13px;
		line-height: 1.5;
	}

	.assistant-message__think-toggle {
		padding: 8px 10px;
	}

	.assistant-message__think-markdown {
		padding: 0 10px 10px;
	}

	.assistant-input {
		padding: 8px 10px 10px;
		border-radius: 16px 16px 18px 18px;
	}

	.assistant-input__field-wrap {
		grid-template-columns: minmax(0, 1fr) 44px;
		grid-template-rows: auto 34px;
	}

	.assistant-input__field {
		min-height: 50px;
		font-size: 13px;
	}

	.assistant-input__voice-icon {
		width: 34px;
		height: 34px;
	}

	.assistant-input__voice-icon svg {
		width: 18px;
		height: 18px;
	}
}

@media (max-width: 640px) {
	.assistant-panel {
		width: 100%;
		height: calc(100dvh - 24px);
		padding: 14px;
	}

	.assistant-panel.is-wide {
		width: 100%;
	}

	.assistant-panel.is-wide .assistant-panel__stage-shell {
		grid-template-columns: none;
		grid-template-rows: minmax(180px, 0.48fr) minmax(170px, 0.52fr);
	}

	.assistant-panel.is-wide .assistant-panel__chat-card {
		border-left: none;
		border-top: 1px solid rgba(220, 229, 246, 0.72);
	}

	.assistant-panel__icon-button {
		width: 32px;
		height: 32px;
	}
}
</style>
