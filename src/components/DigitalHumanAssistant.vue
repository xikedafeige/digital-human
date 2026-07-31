<!-- 数字人面板组件，负责入口 UI、消息展示、输入区和语音交互控制。 -->
<template>
	<section class="assistant-demo">
		<div class="assistant-panel" :class="{ 'is-wide': isWidePanel }">
			<header class="assistant-panel__header">
				<nav class="assistant-tabs" aria-label="数字人功能导航">
					<a-button :class="{ 'is-active': activeTab === 'assistant' }" @click="activeTab = 'assistant'">智能助手</a-button>
					<a-button :class="{ 'is-active': activeTab === 'todo' }" @click="activeTab = 'todo'">增强待办</a-button>
					<a-button :class="{ 'is-active': activeTab === 'board' }" @click="notifyDeveloping">AI任务看板</a-button>
				</nav>

				<div v-if="activeTab === 'assistant'" class="assistant-panel__actions">
					<button type="button" class="assistant-panel__icon-button" :class="{ 'is-active': isHistoryPanelOpen }"
						aria-label="历史对话" data-tooltip="历史对话" @click="handleHistoryOpen">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9" />
							<path d="M3.5 5.5v4h4" />
							<path d="M12 7.5v5l3.2 1.9" />
						</svg>
					</button>
					<button type="button" class="assistant-panel__icon-button" aria-label="新建对话" data-tooltip="新建对话"
						@click="handleClearConversation">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 5v14" />
							<path d="M5 12h14" />
							<path d="M5.8 5.8h7.7" />
							<path d="M5.8 5.8v12.4h12.4v-7.7" />
						</svg>
					</button>
					<button type="button" class="assistant-panel__icon-button" :aria-label="isWidePanel ? '收起面板' : '展开面板'"
						:data-tooltip="isWidePanel ? '收起面板' : '展开面板'" @click="isWidePanel = !isWidePanel">
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
				</div>
			</header>

			<EnhancedTodoPanel v-show="activeTab === 'todo'" :active="activeTab === 'todo'"
				:aria-hidden="activeTab !== 'todo'" @select-project="handleProjectSelected" />
			<AiTaskBoard v-show="activeTab === 'board'" :aria-hidden="activeTab !== 'board'" />
			<div v-show="activeTab === 'assistant'" class="assistant-panel__body" :aria-hidden="activeTab !== 'assistant'">
				<div class="assistant-panel__stage-shell">
					<VideoDigitalHumanStage :state="status" :speech-result="speechResult" :autoplay-token="speechToken"
						@speech-complete="handleSpeechComplete" @speech-progress="handleSpeechProgress" />

					<section class="assistant-panel__chat-card">
						<header class="assistant-panel__chat-header">
							<StarFilled class="assistant-panel__greeting-icon" />
							<strong>你好，我是小绩！</strong>
						</header>

						<section ref="messagesRef" class="assistant-messages" :class="{ 'is-suggestion-mode': showSuggestions }">
							<section v-if="showSuggestions" class="assistant-suggestions">
								<small>试试这样问：</small>
								<button v-for="item in suggestions.slice(0, 2)" :key="item" type="button"
									class="assistant-suggestions__item" @click="sendText(item)">
									{{ item }}
								</button>
							</section>

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

								<div v-if="isMessageLoading(message)" class="assistant-message__loading" aria-live="polite">
									<span class="assistant-message__loading-spinner" aria-hidden="true"></span>
									<span>{{ getMessageLoadingText(message) }}</span>
								</div>

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

								<template v-if="message.renderMode === 'markdown' && message.content">
									<div v-for="block in getMessageRenderBlocks(message)" :key="block.id"
										class="assistant-message__content-block">
										<div v-if="block.type === 'markdown'" class="assistant-message__markdown"
											v-html="renderMessageHtml(block.content)"></div>
										<EChartsBlock v-else :option="block.option" :raw="block.raw" />
									</div>
								</template>
								<p v-else-if="message.content" class="assistant-message__plain">
									{{ message.content }}
								</p>

								<button v-if="message.routeCard" type="button" class="assistant-message__route-card"
									@click="navigateToRoute(message.routeCard.url)">
									<span>
										<strong>{{ message.routeCard.title }}</strong>
										<small>{{ message.routeCard.url }}</small>
									</span>
									<ArrowRightOutlined />
								</button>

								<section v-if="message.suggestions?.length" class="assistant-message__suggestions" aria-label="建议追问">
									<strong>建议追问</strong>
									<ul>
										<li v-for="suggestion in message.suggestions" :key="suggestion">{{ suggestion }}</li>
									</ul>
								</section>

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
									<button type="button" class="assistant-message__action-button" aria-label="重新生成" data-tooltip="重新生成"
										:class="{ 'is-active': messageActionStateMap[message.id] === 'regenerate' }"
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
					<div class="assistant-input__composer">
						<div v-if="selectedProjectContext" class="assistant-input__attachment" aria-label="当前项目附件">
							<span class="assistant-input__attachment-icon">
								<PaperClipOutlined />
							</span>
							<span class="assistant-input__attachment-content">
								<strong>针对绩效任务提问</strong>
								<small>{{ selectedProjectContext.projectName || '未知任务' }}</small>
							</span>
							<button type="button" aria-label="删除项目附件" data-tooltip="删除项目附件" @click="removeProject">
								<CloseOutlined />
							</button>
						</div>

						<div class="assistant-input__toolbar">
							<a-dropdown placement="topLeft" :trigger="['click']" overlay-class-name="assistant-agent-dropdown">
								<button type="button" class="assistant-agent-trigger" aria-label="选择智能体">
									<span>{{ selectedAgent.label }}</span>
									<DownOutlined />
								</button>
								<template #overlay>
									<div class="assistant-agent-menu" role="menu" @click.stop>
										<section v-for="group in agents" :key="group.label" class="assistant-agent-group">
											<header class="assistant-agent-group__title">
												<component :is="agentGroupIconMap[group.icon]" />
												<span>{{ group.label }}</span>
											</header>
											<button v-for="agent in group.options" :key="agent.value" type="button"
												class="assistant-agent-option" :class="{ 'is-selected': selectedAgent.value === agent.value }"
												:disabled="agent.disabled" role="menuitem" @click="selectAgent(agent)">
												<span class="assistant-agent-option__icon">
													<component :is="agentIconMap[agent.icon]" />
												</span>
												<span class="assistant-agent-option__content">
													<strong>{{ agent.label }}</strong>
													<small>{{ agent.description }}</small>
												</span>
											</button>
										</section>
									</div>
								</template>
							</a-dropdown>
							<a-button class="assistant-input__tool-button" type="text" aria-label="知识库" data-tooltip="知识库"
								@click="notifyDeveloping">
								<ReadOutlined />
							</a-button>
							<a-button class="assistant-input__tool-button" type="text" aria-label="上传文件" data-tooltip="上传文件"
								@click="notifyDeveloping">
								<FolderOpenOutlined />
							</a-button>
							<span></span>
							<a-button class="assistant-input__tool-button" type="text" aria-label="历史记录" data-tooltip="历史记录"
								:class="{ 'is-active': isHistoryPanelOpen }" @click="handleHistoryOpen">
								<HistoryOutlined />
							</a-button>
							<a-button class="assistant-input__tool-button" type="text" aria-label="近期项目" data-tooltip="近期项目"
								@click="isRecentProjectsOpen = true">
								<ProjectOutlined />
							</a-button>
							<a-button class="assistant-input__tool-button" type="text" aria-label="新建对话" data-tooltip="新建对话"
								@click="handleClearConversation">
								<CommentOutlined />
							</a-button>
						</div>

						<div class="assistant-input__field-wrap">
							<textarea v-model="inputText" class="assistant-input__field" rows="3" placeholder="输入问题..."
								:disabled="isRecording" @keydown="handleInputKeydown"></textarea>

							<a-button type="text" class="assistant-input__voice-icon" :class="{
								'is-recording': actionButtonMode === 'stop',
								'is-interrupt': actionButtonMode === 'interrupt',
							}" :aria-label="actionButtonLabel" :data-tooltip="actionButtonLabel" @click="handleActionButtonClick">
								<AudioOutlined v-if="actionButtonMode === 'record'" />
								<SendOutlined v-else-if="actionButtonMode === 'send'" />
								<StopOutlined v-else />
							</a-button>

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
					</div>
				</footer>
			</div>
		</div>
		<RecentProjectsModal v-model:open="isRecentProjectsOpen" @select-project="handleProjectSelected" />
		<ConversationHistoryModal v-model:open="isHistoryPanelOpen" @select-messages="handleHistoryMessagesSelected" />
	</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Button as AButton, Dropdown as ADropdown, message as antMessage } from 'ant-design-vue'
import {
	AlertOutlined,
	ApartmentOutlined,
	AppstoreOutlined,
	ArrowRightOutlined,
	AudioOutlined,
	BankOutlined,
	CloseOutlined,
	CommentOutlined,
	DownOutlined,
	FolderOpenOutlined,
	FundOutlined,
	HeartOutlined,
	HistoryOutlined,
	PaperClipOutlined,
	ProjectOutlined,
	RadarChartOutlined,
	ReadOutlined,
	SendOutlined,
	StarFilled,
	StopOutlined,
} from '@ant-design/icons-vue'
import type { DemoMessage } from '@/types/avatar-types'
import {
	markdownToPlainText,
	renderMarkdownToHtml,
	splitMarkdownRenderBlocks,
} from '@/utils/message-content'
import { useDigitalHumanDemo } from '@/hooks/useDigitalHumanDemo'
import VideoDigitalHumanStage from './VideoDigitalHumanStage.vue'
import EnhancedTodoPanel from './EnhancedTodoPanel.vue'
import AiTaskBoard from './AiTaskBoard.vue'
import ConversationHistoryModal from './ConversationHistoryModal.vue'
import EChartsBlock from './EChartsBlock.vue'
import RecentProjectsModal from './RecentProjectsModal.vue'
import {
	type GuideConversationMessage,
	type GuideConversationSummary,
	type GuideProjectCard,
} from '@/services/guide-api'
import {
	DIGITAL_HUMAN_AGENTS,
	DIGITAL_HUMAN_DEVELOPMENT_NOTICE,
	type DigitalHumanAgentIcon,
	type DigitalHumanAgentOption,
} from '@/config/demo-config'

const isRecentProjectsOpen = ref(false)
const {
	attachProject,
	clearConversation,
	handleSpeechComplete,
	handleSpeechProgress,
	hasInput,
	inputHint,
	inputText,
	interruptCurrentFlow,
	isBusy,
	isHistoryPanelOpen,
	isRecording,
	isSpeechSynthesizing,
	loadExternalConversationMessages,
	messages,
	readMessageAloud,
	regenerateAssistantMessage,
	removeProject,
	selectedProjectContext,
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
} = useDigitalHumanDemo({
	onOpenRecentProjects: () => {
		isRecentProjectsOpen.value = true
	},
})

const messagesRef = ref<HTMLElement | null>(null)
type AssistantTab = 'assistant' | 'todo' | 'board'
const activeTab = ref<AssistantTab>('assistant')
const agents = DIGITAL_HUMAN_AGENTS
const defaultAgent = agents[0].options[0]
const selectedAgent = ref<DigitalHumanAgentOption>(defaultAgent)
const agentGroupIconMap = {
	industry: ApartmentOutlined,
	decision: AppstoreOutlined,
}
const agentIconMap: Record<DigitalHumanAgentIcon, unknown> = {
	college: BankOutlined,
	'elderly-care': HeartOutlined,
	'policy-radar': RadarChartOutlined,
	'budget-allocation': FundOutlined,
	'project-risk': AlertOutlined,
	'fiscal-policy': BankOutlined,
}
const selectAgent = (agent: DigitalHumanAgentOption) => {
	if (!agent.disabled) {
		selectedAgent.value = agent
	}
}
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
const notifyDeveloping = () => antMessage.info(DIGITAL_HUMAN_DEVELOPMENT_NOTICE, 0.8)
const showSuggestions = computed(() =>
	suggestions.value.length > 0 && !messages.value.some((message) => message.role === 'user'),
)

const roleLabelMap: Record<DemoMessage['role'], string> = {
	user: '你',
	assistant: '小绩',
	system: '系统',
}

const isMessageLoading = (message: DemoMessage) =>
	message.role === 'assistant' &&
	(speechLoadingMessageId.value === message.id ||
		(message.pending && status.value === 'thinking'))

const getMessageLoadingText = (message: DemoMessage) =>
	speechLoadingMessageId.value === message.id ? '语音加载中...' : '小绩正在思考...'

// 统一渲染 Markdown 消息，保持模板中 v-html 来源可控。
const renderMessageHtml = (content: string) => renderMarkdownToHtml(content)

const getMessageRenderBlocks = (message: DemoMessage) =>
	message.renderBlocks?.length
		? message.renderBlocks
		: splitMarkdownRenderBlocks(message.content)

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

const parseGuideHistoryTimestamp = (value: string, fallback = Date.now()) => {
	const normalized = value.trim().replace(' ', 'T')
	const timestamp = normalized ? Date.parse(normalized) : Number.NaN
	return Number.isFinite(timestamp) ? timestamp : fallback
}

const handleHistoryMessagesSelected = (
	remoteMessages: GuideConversationMessage[],
	history: GuideConversationSummary,
) => {
	const replayMessages = remoteMessages
		.filter((message) => {
			const role = message.role.toUpperCase()
			return (role === 'USER' || role === 'ASSISTANT') && Boolean(message.content.trim())
		})
		.map<DemoMessage>((message, index) => {
			const isUserMessage = message.role.toUpperCase() === 'USER'
			const role: DemoMessage['role'] = isUserMessage ? 'user' : 'assistant'
			return {
				id: message.id || `${history.id}-${index}`,
				role,
				content: message.content,
				timestamp: parseGuideHistoryTimestamp(message.createdAt, Date.now() + index),
				pending: false,
				source: 'text',
				engine: 'guide',
				renderMode: role === 'user' ? 'plain' : 'markdown',
				thinkCollapsed: true,
			}
		})

	if (replayMessages.length) {
		loadExternalConversationMessages(replayMessages)
	}
}

const handleHistoryOpen = () => {
	isHistoryPanelOpen.value = true
}

const handleClearConversation = () => {
	clearConversation()
}

const handleProjectSelected = (project: GuideProjectCard) => {
	attachProject(project)
	activeTab.value = 'assistant'
	isRecentProjectsOpen.value = false
}

const navigateToRoute = (url: string) => {
	try {
		const targetUrl = new URL(url, window.location.origin)
		if (targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:') {
			window.location.assign(targetUrl.href)
			return
		}
		antMessage.warning('当前路由地址不可用')
	} catch {
		antMessage.warning('当前路由地址不可用')
	}
}

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
	position: relative;
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

.assistant-panel__icon-button.is-active {
	background: rgba(79, 120, 255, 0.18);
	color: #4267e8;
	box-shadow: inset 0 0 0 1px rgba(79, 120, 255, 0.18);
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

.assistant-history-panel {
	position: absolute;
	top: 62px;
	right: 16px;
	bottom: 14px;
	z-index: 35;
	display: grid;
	grid-template-rows: auto minmax(0, 1fr);
	width: min(326px, calc(100% - 32px));
	padding: 12px;
	border: 1px solid rgba(216, 228, 248, 0.92);
	border-radius: 20px;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98));
	box-shadow: 0 22px 56px rgba(70, 101, 150, 0.18);
	backdrop-filter: blur(16px);
	overflow: hidden;
}

.assistant-history-panel__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 2px 2px 10px;
	border-bottom: 1px solid rgba(223, 232, 248, 0.76);
}

.assistant-history-panel__header strong {
	display: block;
	color: #233352;
	font-size: 14px;
	line-height: 1.2;
}

.assistant-history-panel__header span {
	display: block;
	margin-top: 2px;
	color: #7786a0;
	font-size: 12px;
	line-height: 1.2;
}

.assistant-history-panel__close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: none;
	width: 30px;
	height: 30px;
	padding: 0;
	border: none;
	border-radius: 10px;
	background: rgba(96, 133, 239, 0.1);
	color: #5e83ef;
	cursor: pointer;
}

.assistant-history-panel__close:hover {
	background: rgba(96, 133, 239, 0.16);
	color: #4267e8;
}

.assistant-history-panel__close svg {
	width: 16px;
	height: 16px;
	fill: none;
	stroke: currentColor;
	stroke-width: 2;
	stroke-linecap: round;
}

.assistant-history-panel__content {
	min-height: 0;
	padding: 10px 2px 2px;
	overflow-y: auto;
}

.assistant-history-group+.assistant-history-group {
	margin-top: 14px;
	padding-top: 14px;
	border-top: 1px solid rgba(223, 232, 248, 0.76);
}

.assistant-history-group__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 0 2px;
}

.assistant-history-group__header strong {
	color: #40536f;
	font-size: 12px;
	line-height: 18px;
}

.assistant-history-group__header span {
	color: #95a0b3;
	font-size: 11px;
}

.assistant-history-panel__list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 0;
	padding: 8px 0 0;
	overflow: visible;
}

.assistant-history-item {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 30px;
	align-items: center;
	gap: 8px;
	padding: 9px;
	border: 1px solid rgba(216, 227, 247, 0.88);
	border-radius: 14px;
	background: rgba(248, 251, 255, 0.9);
	transition:
		border-color 0.18s ease,
		background 0.18s ease,
		box-shadow 0.18s ease;
}

.assistant-history-item:hover,
.assistant-history-item.is-active {
	border-color: rgba(111, 146, 255, 0.46);
	background: rgba(240, 246, 255, 0.96);
	box-shadow: 0 8px 18px rgba(79, 120, 255, 0.08);
}

.assistant-history-item__main {
	min-width: 0;
	padding: 0;
	border: none;
	background: transparent;
	text-align: left;
	cursor: pointer;
}

.assistant-history-item__main strong {
	display: block;
	max-width: 100%;
	color: #263852;
	font-size: 13px;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-history-item__main span {
	display: block;
	margin-top: 3px;
	color: #7b8ba6;
	font-size: 11px;
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-history-item.is-active .assistant-history-item__main strong {
	color: #4267e8;
}

.assistant-history-item--remote {
	grid-template-columns: minmax(0, 1fr);
}

.assistant-history-item__title-row {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.assistant-history-item__title-row strong {
	flex: 1;
	min-width: 0;
}

.assistant-history-item__type {
	flex: none;
	margin: 0 !important;
	padding: 1px 5px;
	border-radius: 999px;
	background: rgba(79, 120, 255, 0.1);
	color: #5376de !important;
	font-size: 9px !important;
	line-height: 15px !important;
}

.assistant-history-item__main small {
	display: block;
	margin-top: 4px;
	overflow: hidden;
	color: #94a0b4;
	font-size: 10px;
	line-height: 15px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-history-state {
	display: flex;
	min-height: 64px;
	align-items: center;
	justify-content: center;
	gap: 7px;
	padding: 10px;
	color: #8a98ad;
	font-size: 11px;
	text-align: center;
}

.assistant-history-state.is-compact {
	min-height: auto;
	margin-top: 7px;
	padding: 7px;
	border-radius: 8px;
	background: rgba(244, 247, 252, 0.82);
}

.assistant-history-state.is-error {
	flex-direction: column;
	color: #c75a4b;
}

.assistant-history-state button {
	padding: 3px 9px;
	border: 1px solid #cbd9ef;
	border-radius: 6px;
	background: #fff;
	color: #4384e8;
	font-size: 11px;
	cursor: pointer;
}

.assistant-history-item__delete {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	padding: 0;
	border: 1px solid transparent;
	border-radius: 10px;
	background: transparent;
	color: #8a98b0;
	cursor: pointer;
}

.assistant-history-item__delete:hover,
.assistant-history-item__delete:focus-visible {
	border-color: rgba(111, 146, 255, 0.24);
	background: rgba(79, 120, 255, 0.09);
	color: #4267e8;
}

.assistant-history-item__delete svg {
	width: 15px;
	height: 15px;
	fill: none;
	stroke: currentColor;
	stroke-width: 1.8;
	stroke-linecap: round;
	stroke-linejoin: round;
}

.assistant-history-panel__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 0;
	padding: 28px 16px;
	color: #7b8ba6;
	text-align: center;
}

.assistant-history-panel__empty span {
	width: 34px;
	height: 34px;
	margin-bottom: 10px;
	border-radius: 50%;
	background: rgba(79, 120, 255, 0.12);
	box-shadow: inset 0 0 0 1px rgba(79, 120, 255, 0.14);
}

.assistant-history-panel__empty strong {
	color: #40536f;
	font-size: 13px;
	line-height: 1.3;
}

.assistant-history-panel__empty p {
	margin: 4px 0 0;
	font-size: 12px;
	line-height: 1.4;
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
	scrollbar-gutter: stable;
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

.assistant-message__loading {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	margin: 0 0 9px;
	color: #697b9b;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.2;
}


.assistant-message__loading-spinner {
	box-sizing: border-box;
	width: 13px;
	height: 13px;
	border-radius: 50%;
	border: 2px solid rgba(93, 133, 239, 0.22);
	border-top-color: #5d85ef;
	animation: assistant-message-loading-spin 0.72s linear infinite;
}

@keyframes assistant-message-loading-spin {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.assistant-message__loading-spinner {
		animation: none;
	}
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

.assistant-message__content-block+.assistant-message__content-block {
	margin-top: 10px;
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

.assistant-message__markdown :deep(.markdown-table-scroll) {
	max-width: 100%;
	margin: 0 0 8px;
	overflow-x: auto;
	overflow-y: hidden;
}

.assistant-message__markdown :deep(.markdown-table-scroll table) {
	width: max-content;
	min-width: 100%;
	margin: 0;
	border-collapse: collapse;
	border: 1px solid rgba(197, 210, 235, 0.9);
	background: rgba(255, 255, 255, 0.72);
	font-size: 13px;
	line-height: 1.5;
}

.assistant-message__markdown :deep(th),
.assistant-message__markdown :deep(td) {
	padding: 7px 9px;
	border: 1px solid rgba(197, 210, 235, 0.9);
	text-align: left;
	vertical-align: top;
	white-space: nowrap;
}

.assistant-message__markdown :deep(th) {
	background: rgba(79, 120, 255, 0.08);
	color: #40536f;
	font-weight: 700;
}

.assistant-message.is-user .assistant-message__markdown :deep(.markdown-table-scroll table) {
	border-color: rgba(255, 255, 255, 0.36);
	background: rgba(255, 255, 255, 0.1);
}

.assistant-message.is-user .assistant-message__markdown :deep(th),
.assistant-message.is-user .assistant-message__markdown :deep(td) {
	border-color: rgba(255, 255, 255, 0.36);
}

.assistant-message.is-user .assistant-message__markdown :deep(th) {
	background: rgba(255, 255, 255, 0.16);
	color: inherit;
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
	fill: currentColor;
	stroke: none;
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

	.assistant-history-panel {
		top: 58px;
		right: 14px;
		bottom: 14px;
		width: calc(100% - 28px);
		border-radius: 18px;
	}
}

.assistant-panel__header {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 8px;
	margin-bottom: 14px;
	padding: 0 0 0 12px;
}

.assistant-tabs {
	display: flex;
	align-items: center;
	gap: 7px;
	min-width: 0;
}

.assistant-tabs button {
	min-width: 76px;
	padding: 7px 14px;
	border: 1px solid #dedbd4;
	border-radius: 999px;
	background: #fafaf8;
	color: #313b4c;
	font-size: 12px;
	font-weight: 500;
	line-height: 18px;
	white-space: nowrap;
	cursor: pointer;
	box-shadow: none;
	transition: none !important;
}

.assistant-tabs button.is-active {
	border-color: transparent;
	background: linear-gradient(106deg, #1888ff 15%, #6550ff 86%);
	color: #fff;
	font-weight: 500;
	box-shadow: none;
}

.assistant-tabs button:hover,
.assistant-tabs button:focus,
.assistant-tabs button:active {
	font-weight: 500;
	transform: none;
	transition: none !important;
}

.assistant-panel__actions {
	display: none;
}

.assistant-input__composer {
	position: relative;
	border: 1px solid #dfe3eb;
	border-radius: 18px;
	background: #fafaf8;
	box-shadow: 0 1px 3px rgba(50, 64, 88, .03);
}

.assistant-input__composer:focus-within {
	border-color: #cfd8e8;
	box-shadow: 0 0 0 2px rgba(82, 126, 255, .06);
}

.assistant-input__attachment {
	display: grid;
	grid-template-columns: 32px minmax(0, 1fr) 26px;
	align-items: center;
	gap: 9px;
	margin: 10px 12px 0;
	padding: 8px 9px;
	border: 1px solid #dce6f5;
	border-radius: 10px;
	background: #f5f8fe;
}

.assistant-input__attachment-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	background: #e8f1ff;
	color: #4f7fea;
	font-size: 16px;
}

.assistant-input__attachment-content {
	display: grid;
	min-width: 0;
}

.assistant-input__attachment-content strong,
.assistant-input__attachment-content small {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-input__attachment-content strong {
	color: #27364f;
	font-size: 12px;
	line-height: 18px;
}

.assistant-input__attachment-content small {
	color: #7d8798;
	font-size: 11px;
	line-height: 17px;
}

.assistant-input__attachment button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	padding: 0;
	border: 0;
	border-radius: 7px;
	background: transparent;
	color: #8c95a5;
	cursor: pointer;
}

.assistant-input__attachment button:hover {
	background: #e8eef8;
	color: #4f6381;
}

.assistant-input__toolbar {
	display: flex;
	align-items: center;
	gap: 9px;
	min-height: 48px;
	margin: 0;
	padding: 8px 14px 4px;
	border: 0;
	border-radius: 0;
	color: #495466;
	background: transparent;
}

.assistant-agent-trigger {
	flex: none;
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	width: fit-content;
	max-width: min(240px, calc(100% - 156px));
	height: 32px;
	padding: 0 10px;
	border: 0;
	border-radius: 999px;
	background: #f3f6fc;
	cursor: pointer;
}

.assistant-agent-trigger span {
	min-width: 0;
	overflow: hidden;
	background: linear-gradient(100deg, #1888ff 14%, #6550ff 87%);
	background-clip: text;
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	font-size: 13px;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-agent-trigger :deep(.anticon) {
	flex: none;
	color: #30343b;
	font-size: 12px;
}

.assistant-input__toolbar button:not(.assistant-agent-trigger) {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	padding: 0;
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: #252a31;
	font-size: 20px;
	cursor: pointer;
}

.assistant-input__toolbar button:not(.assistant-agent-trigger):hover,
.assistant-input__toolbar button:not(.assistant-agent-trigger).is-active {
	background: #eef5ff;
	color: #3f86f4;
}

.assistant-input__toolbar>span {
	flex: 1;
}

.assistant-suggestions {
	flex: none;
	display: grid;
	gap: 4px;
	min-width: 0;
	margin: 0 0 2px;
	padding: 8px 12px;
	overflow: visible;
	border-radius: 20px;
	background: linear-gradient(145deg, #f5f7fb 0%, #f8f9fb 100%);
	white-space: normal;
	mask-image: none;
}

.assistant-suggestions small {
	display: block;
	margin: 0;
	color: #9299a5;
	font-size: 11px;
	line-height: 16px;
}

.assistant-suggestions__item {
	width: 100%;
	min-height: 40px;
	padding: 8px 14px;
	border: 0;
	border-radius: 16px;
	background: #fff;
	box-shadow: 0 5px 15px rgba(77, 89, 112, .055);
	color: #343a44;
	text-align: left;
	font-size: 12px;
	line-height: 20px;
	cursor: pointer;
	transition: background-color .16s ease, color .16s ease, transform .16s ease;
}

.assistant-suggestions__item:hover {
	background: #fff;
	color: #357feb;
	transform: translateY(-1px);
}

.assistant-panel__body {
	gap: 3px;
}

.assistant-panel {
	background: #fafaf8;
}

.assistant-panel__body {
	background: #fafaf8;
}

.assistant-panel__stage-shell {
	grid-template-rows: minmax(245px, .58fr) minmax(180px, .42fr);
	border: 0;
	border-radius: 20px;
	background: #fafaf8;
	box-shadow: none;
}

.assistant-panel.is-wide .assistant-panel__stage-shell {
	border: 0;
	background: #fafaf8;
	box-shadow: none;
}

.assistant-panel__chat-card {
	position: relative;
	z-index: 1;
	min-height: 0;
	margin-top: 0;
	padding-top: 12px;
	border: 0;
	background: #fafaf8;
}

.assistant-panel.is-wide .assistant-panel__chat-card {
	border: 0;
	background: #fafaf8;
}

.assistant-panel__chat-header {
	flex: none;
	justify-content: flex-start;
	gap: 7px;
	color: #27344b;
}

.assistant-panel__chat-header strong {
	font-size: 15px;
	font-weight: 700;
}

.assistant-panel__greeting-icon {
	color: #527eff;
	font-size: 16px;
}

.assistant-messages {
	overscroll-behavior: contain;
}

.assistant-messages.is-suggestion-mode {
	overflow-y: hidden;
	padding-right: 0;
}

.assistant-message.is-system {
	display: none;
}

.assistant-message__route-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
	margin-top: 10px;
	padding: 11px 12px;
	border: 1px solid #d8e5f8;
	border-radius: 10px;
	background: #f4f8ff;
	color: #3d6fc6;
	text-align: left;
	cursor: pointer;
}

.assistant-message__route-card>span {
	display: grid;
	min-width: 0;
	gap: 2px;
}

.assistant-message__route-card strong,
.assistant-message__route-card small {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-message__route-card strong {
	color: #315a9f;
	font-size: 12px;
	line-height: 18px;
}

.assistant-message__route-card small {
	color: #7b8da9;
	font-size: 10px;
	line-height: 16px;
}

.assistant-message__route-card :deep(.anticon) {
	flex: none;
	font-size: 14px;
}

.assistant-message__suggestions {
	margin-top: 10px;
	padding: 10px 12px;
	border-radius: 10px;
	background: #f7f8fb;
}

.assistant-message__suggestions>strong {
	color: #68758a;
	font-size: 11px;
	line-height: 17px;
}

.assistant-message__suggestions ul {
	display: grid;
	gap: 5px;
	margin: 6px 0 0;
	padding-left: 17px;
	color: #4e596a;
	font-size: 11px;
	line-height: 18px;
}

:global(.assistant-agent-dropdown) {
	width: 280px;
}

:global(.assistant-agent-dropdown .assistant-agent-menu) {
	max-height: min(420px, calc(100vh - 28px));
	padding: 8px;
	overflow-y: auto;
	border: 1px solid #d9dde5;
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 12px 30px rgba(38, 51, 74, .16);
	scrollbar-color: #8f8f8f transparent;
	scrollbar-width: auto;
}

:global(.assistant-agent-dropdown .assistant-agent-menu::-webkit-scrollbar) {
	width: 10px;
}

:global(.assistant-agent-dropdown .assistant-agent-menu::-webkit-scrollbar-thumb) {
	border: 2px solid transparent;
	border-radius: 999px;
	background: #8f8f8f;
	background-clip: padding-box;
}

:global(.assistant-agent-dropdown .assistant-agent-group + .assistant-agent-group) {
	margin-top: 5px;
	padding-top: 7px;
	border-top: 1px solid #e4e6ea;
}

:global(.assistant-agent-dropdown .assistant-agent-group__title) {
	display: flex;
	align-items: center;
	gap: 6px;
	height: 26px;
	padding: 0 8px;
	color: #777e89;
	font-size: 12px;
	font-weight: 600;
}

:global(.assistant-agent-dropdown .assistant-agent-group__title .anticon) {
	color: #75859c;
	font-size: 13px;
}

:global(.assistant-agent-dropdown .assistant-agent-option) {
	display: grid;
	grid-template-columns: 34px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	width: 100%;
	min-height: 56px;
	margin: 1px 0;
	padding: 6px 8px;
	border: 0;
	border-radius: 10px;
	background: transparent;
	text-align: left;
	cursor: pointer;
}

:global(.assistant-agent-dropdown .assistant-agent-option.is-selected) {
	background: #f0f4fc;
}

:global(.assistant-agent-dropdown .assistant-agent-option:not(:disabled):hover) {
	background: #f5f7fb;
}

:global(.assistant-agent-dropdown .assistant-agent-option:disabled) {
	opacity: 1;
	cursor: not-allowed;
}

:global(.assistant-agent-dropdown .assistant-agent-option__icon) {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 34px;
	height: 34px;
	border-radius: 6px;
	background: #edf3ff;
	color: #718bb6;
	font-size: 14px;
}

:global(.assistant-agent-dropdown .assistant-agent-option__content) {
	display: block;
	min-width: 0;
}

:global(.assistant-agent-dropdown .assistant-agent-option__content strong),
:global(.assistant-agent-dropdown .assistant-agent-option__content small) {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

:global(.assistant-agent-dropdown .assistant-agent-option__content strong) {
	color: #111318;
	font-size: 13px;
	font-weight: 700;
	line-height: 19px;
}

:global(.assistant-agent-dropdown .assistant-agent-option__content small) {
	margin-top: 1px;
	color: #858c98;
	font-size: 11px;
	line-height: 17px;
}

.assistant-input {
	padding: 2px 11px 6px;
	overflow: visible;
	border: 0;
	border-radius: 18px;
	background: #fafaf8;
	box-shadow: none;
}

.assistant-input__field-wrap {
	padding: 0 14px 8px;
	border: 0;
	border-radius: 0 0 18px 18px;
	background: transparent;
}

.assistant-input__tool-button,
.assistant-input__voice-icon,
.assistant-panel__icon-button,
.assistant-message__action-button {
	position: relative;
}

.assistant-input__tool-button::after,
.assistant-input__voice-icon::after,
.assistant-panel__icon-button::after,
.assistant-message__action-button::after {
	content: attr(data-tooltip);
	position: absolute;
	left: 50%;
	right: auto;
	top: auto;
	bottom: calc(100% + 8px);
	z-index: 50;
	padding: 6px 9px;
	border-radius: 7px;
	background: rgba(32, 36, 44, .94);
	box-shadow: 0 4px 12px rgba(22, 28, 39, .16);
	color: #fff;
	font-size: 11px;
	font-weight: 400;
	line-height: 1;
	white-space: nowrap;
	opacity: 0;
	pointer-events: none;
	transform: translate(-50%, 3px);
	transition: opacity .14s ease, transform .14s ease;
}

.assistant-input__tool-button:hover::after,
.assistant-input__tool-button:focus-visible::after,
.assistant-input__voice-icon:hover::after,
.assistant-input__voice-icon:focus-visible::after,
.assistant-panel__icon-button:hover::after,
.assistant-panel__icon-button:focus-visible::after,
.assistant-message__action-button:hover::after,
.assistant-message__action-button:focus-visible::after {
	opacity: 1;
	transform: translate(-50%, 0);
}

@media (max-width: 430px) {
	.assistant-panel__header {
		padding-left: 20px;
	}

	.assistant-tabs {
		gap: 4px;
	}

	.assistant-tabs button {
		padding: 7px 9px;
		font-size: 11px;
	}

	:global(.assistant-agent-dropdown) {
		width: min(280px, calc(100vw - 24px));
	}
}
</style>
