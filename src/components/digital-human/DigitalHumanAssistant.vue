<template>
	<section class="assistant-demo">
		<div class="assistant-panel">
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
				</div>
			</header>

			<div class="assistant-panel__body">
				<div class="assistant-panel__stage-shell">
					<VideoDigitalHumanStage :state="status" :speech-result="speechResult" :autoplay-token="speechToken"
						@speech-complete="handleSpeechComplete" />

					<section class="assistant-panel__chat-card">
						<header class="assistant-panel__chat-header">
							<div class="assistant-panel__llm-chip">
								<span class="assistant-panel__llm-dot"></span>
								<span>Dify 已接入</span>
							</div>
							<p class="assistant-panel__runtime-tip">{{ statusHint }}</p>
						</header>

						<section ref="messagesRef" class="assistant-messages">
							<article v-for="message in messages" :key="message.id" class="assistant-message"
								:class="[`is-${message.role}`, { 'is-pending': message.pending }]">
								<header class="assistant-message__meta">
									<strong>{{ roleLabelMap[message.role] }}</strong>
									<time>{{ formatTime(message.timestamp) }}</time>
								</header>
								<p>{{ message.content }}</p>
							</article>
						</section>
					</section>
				</div>

				<section class="assistant-suggestions">
					<button v-for="item in suggestions" :key="item" type="button" class="assistant-suggestions__item"
						@click="sendText(item)">
						{{ item }}
					</button>
				</section>

				<footer class="assistant-input">
					<div class="assistant-input__field-wrap">
						<textarea v-model="inputText" class="assistant-input__field" rows="3" placeholder="输入问题..."
							:disabled="isRecording" @keydown="handleInputKeydown"></textarea>

						<button type="button" class="assistant-input__voice-icon" :class="{ 'is-recording': isRecording }"
							:aria-label="isRecording ? '停止录音' : '开始录音'" :title="isRecording ? '停止录音' : '开始录音'"
							@click="toggleVoiceInput">
							<svg v-if="!isRecording" viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M12 14.5c1.7 0 3-1.3 3-3V6.8c0-1.7-1.3-3-3-3s-3 1.3-3 3v4.7c0 1.7 1.3 3 3 3Z" />
								<path d="M6.5 11.2c0 3 2.4 5.5 5.5 5.5s5.5-2.5 5.5-5.5" />
								<path d="M12 16.7v3.2" />
								<path d="M9 19.9h6" />
							</svg>
							<svg v-else viewBox="0 0 24 24" aria-hidden="true">
								<path d="M9 8.5h6v7H9z" />
								<path d="M5.8 10.2v3.6" />
								<path d="M18.2 10.2v3.6" />
								<path d="M3.5 11.1v1.8" />
								<path d="M20.5 11.1v1.8" />
							</svg>
						</button>

						<span v-if="isBusy" class="assistant-input__busy-tip">发送新问题会中断当前生成和播报</span>
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
import { VIDEO_STATUS_LABELS } from './video-avatar-config'

const {
	clearConversation,
	handleSpeechComplete,
	inputText,
	isBusy,
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
		return '录音中，再次点击麦克风后将自动发起提问。'
	}

	if (status.value === 'speaking') {
		return '正在播报回复，请稍候。'
	}

	if (status.value === 'thinking') {
		return 'Dify 回复生成中，请稍候。'
	}

	return latestAssistantText.value
})

const roleLabelMap: Record<DemoMessage['role'], string> = {
	user: '你',
	assistant: '数字人',
	system: '系统',
}

const toggleVoiceInput = () => {
	if (isRecording.value) {
		stopVoiceInput()
		return
	}

	startVoiceInput()
}

const handleInputKeydown = (event: KeyboardEvent) => {
	if (event.isComposing) {
		return
	}

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
	inset: 0;
	z-index: 40;
	align-items: center;
	display: flex;
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

.assistant-panel__text-button {
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

.assistant-panel__body {
	flex: 1;
	display: grid;
	grid-template-rows: auto auto auto;
	gap: 12px;
	min-height: 0;
	overflow: hidden;
}

.assistant-panel__stage-shell {
	display: grid;
	grid-template-rows: minmax(210px, 0.58fr) minmax(136px, 0.42fr);
	height: clamp(360px, calc(100dvh - 260px), 560px);
	min-height: 0;
	overflow: hidden;
	border: 1px solid rgba(226, 233, 248, 0.82);
	border-radius: 26px;
	background: linear-gradient(180deg, #fafaf8 0%, #fafaf8 51%, #ffffff 51%, #f8fbff 100%);
	box-shadow:
		0 16px 34px rgba(88, 116, 156, 0.08),
		inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.assistant-panel__chat-card {
	display: grid;
	grid-template-rows: auto minmax(0, 1fr);
	gap: 8px;
	padding: 12px 12px 10px;
	padding-top: 30px;
	border-top: 1px solid rgba(220, 229, 246, 0.72);
	border-radius: 0;
	background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
	min-height: 0;
	overflow: hidden;
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
	min-width: 0;
	margin: 0;
	color: #60718e;
	font-size: 12px;
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.assistant-suggestions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-content: flex-start;
	padding: 2px 0 0;
	max-height: min(86px, 12dvh);
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
	padding: 12px;
	border-radius: 22px;
	border: 1px solid rgba(221, 230, 247, 0.95);
	background: linear-gradient(180deg, #ffffff, #f8fbff);
	box-shadow: 0 -10px 24px rgba(255, 255, 255, 0.92);
}

.assistant-input__field-wrap {
	position: relative;
	display: grid;
	gap: 8px;
}

.assistant-input__field {
	width: 100%;
	min-height: 78px;
	padding: 2px 54px 30px 0;
	border: none;
	resize: none;
	outline: none;
	background: transparent;
	color: #233352;
	font-size: 14px;
}

.assistant-input__voice-icon {
	position: absolute;
	right: 0;
	bottom: 0;
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

.assistant-input__voice-icon.is-recording svg {
	fill: currentColor;
}

.assistant-input__busy-tip {
	padding-right: 48px;
	color: #ef7e2f;
	font-size: 12px;
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

	.assistant-panel__header {
		margin-bottom: 10px;
	}

	.assistant-panel__body {
		grid-template-rows: auto auto auto;
		gap: 10px;
	}

	.assistant-panel__stage-shell {
		grid-template-rows: minmax(200px, 0.6fr) minmax(118px, 0.4fr);
		height: clamp(330px, calc(100dvh - 230px), 440px);
		border-radius: 20px;
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
		max-height: 46px;
	}

	.assistant-suggestions__item {
		padding: 7px 11px;
		font-size: 12px;
	}

	.assistant-message {
		padding: 9px 11px;
		border-radius: 14px;
	}

	.assistant-message__meta {
		margin-bottom: 5px;
	}

	.assistant-message p {
		font-size: 13px;
		line-height: 1.5;
	}

	.assistant-input {
		padding: 10px;
		border-radius: 18px;
	}

	.assistant-input__field {
		min-height: 56px;
		padding-right: 48px;
		padding-bottom: 28px;
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

	.assistant-panel__text-button {
		padding-inline: 10px;
	}
}
</style>
