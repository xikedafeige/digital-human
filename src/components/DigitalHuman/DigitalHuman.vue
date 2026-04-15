<template>
	<div class="digital-human" :class="{ 'is-expanded': isExpanded }">
		<button v-if="!isExpanded" type="button" class="assistant-trigger" aria-label="打开智能助手" @click="store.expand()">
			<span class="sr-only">智能助手</span>
		</button>

		<div v-else class="assistant-layer">
			<div class="assistant-layer__glow"></div>

			<section class="assistant-card">
				<header class="assistant-card__header">
					<button class="assistant-card__close" type="button" aria-label="关闭智能助手" @click="store.collapse()">
						×
					</button>

					<div class="assistant-card__title-group">
						<h2>智能助手</h2>

						<div class="assistant-card__meta">
							<span class="assistant-card__chip">LLM已接入</span>
							<span class="assistant-card__online">
								<i></i>
								在线
							</span>
						</div>
					</div>
				</header>

				<div class="assistant-stage" :class="`is-${visualVideoState}`">
					<div class="assistant-stage__backdrop">
						<div
							v-for="state in videoStates"
							:key="`backdrop-${state}`"
							class="assistant-stage__backdrop-layer"
							:class="[
								`is-${state}`,
								{ 'is-active': visualVideoState === state }
							]"
						></div>
						<div class="assistant-stage__backdrop-mesh"></div>
						<div class="assistant-stage__backdrop-floor"></div>
					</div>

					<div class="assistant-stage__media">
						<video
							v-for="state in videoStates"
							:key="state"
							:ref="(element) => setVideoRef(state, element as HTMLVideoElement | null)"
							class="assistant-stage__video"
							:class="{
								'is-active': visualVideoState === state,
								'is-ready': readyStates[state]
							}"
							:style="videoFrameStyles[state]"
							:src="videoSources[state]"
							muted
							loop
							autoplay
							playsinline
							preload="auto"
							@canplay="handleVideoReady(state)"
						></video>
					</div>

					<div v-if="!activeVideoReady" class="assistant-stage__loading">
						数字人资源加载中...
					</div>
				</div>

				<div class="assistant-greeting">
					<span class="assistant-greeting__sparkle">✦</span>
					<p>{{ assistantText }}</p>
				</div>

				<section class="assistant-prompts">
					<p class="assistant-prompts__label">试试这样问：</p>

					<button
						v-for="item in suggestions"
						:key="item"
						type="button"
						class="assistant-prompts__item"
						@click="handleSuggestion(item)"
					>
						{{ item }}
					</button>
				</section>

				<footer class="assistant-input" :class="{ 'has-input': hasInput }">
					<textarea
						v-model="inputText"
						class="assistant-input__field"
						placeholder="输入问题"
						rows="3"
						@keydown="handleInputKeydown"
					></textarea>

					<button
						type="button"
						class="assistant-input__mic"
						:class="{
							'is-left': hasInput,
							'is-right': !hasInput,
							'is-recording': isRecording
						}"
						aria-label="按住说话"
						@mousedown.prevent="store.startListening()"
						@mouseup.prevent="store.stopListening()"
						@mouseleave="handleMicLeave"
						@touchstart.prevent="store.startListening()"
						@touchend.prevent="store.stopListening()"
					>
						<span class="assistant-input__mic-icon"></span>
					</button>

					<button v-if="hasInput" type="button" class="assistant-input__send" aria-label="发送问题" @click="handleSend">
						<svg viewBox="0 0 20 20" aria-hidden="true">
							<path
								d="M4.79 3.64a1 1 0 0 1 1.08-.18l9.03 4.27a1 1 0 0 1 0 1.81L5.87 13.8a1 1 0 0 1-1.4-1.04l.58-3.1a.7.7 0 0 0 0-.25l-.58-3.1a1 1 0 0 1 .32-.97Z"
								fill="currentColor"
							/>
							<path d="M5.18 9.06h5.88" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
					</button>
				</footer>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { type ChatStatus, useDigitalHumanStore } from '../../stores/digitalHuman'

const store = useDigitalHumanStore()
const { assistantText, chatStatus, inputText, isExpanded, isRecording, suggestions } = storeToRefs(store)

const videoStates: ChatStatus[] = ['idle', 'listening', 'thinking', 'speaking']

const videoSources: Record<ChatStatus, string> = {
	idle: '/videos/idle.mp4',
	listening: '/videos/listening.mp4',
	thinking: '/videos/thinking.mp4',
	speaking: '/videos/speaking.mp4'
}

const createVideoFrameStyle = (
	objectPosition: string,
	activeScale: number,
	activeShiftY: string,
	restScale = activeScale + 0.04,
	restShiftY = '18px'
) =>
	({
		'--video-object-position': objectPosition,
		'--video-active-scale': String(activeScale),
		'--video-active-shift-y': activeShiftY,
		'--video-rest-scale': String(restScale),
		'--video-rest-shift-y': restShiftY
	}) as CSSProperties

const videoFrameStyles: Record<ChatStatus, CSSProperties> = {
	idle: createVideoFrameStyle('50% 57%', 1.08, '4px'),
	listening: createVideoFrameStyle('50.5% 57.4%', 1.1, '6px'),
	thinking: createVideoFrameStyle('49.8% 57.2%', 1.095, '5px'),
	speaking: createVideoFrameStyle('50.2% 57.1%', 1.105, '4px')
}

const videoRefs = reactive<Record<ChatStatus, HTMLVideoElement | null>>({
	idle: null,
	listening: null,
	thinking: null,
	speaking: null
})

const readyStates = reactive<Record<ChatStatus, boolean>>({
	idle: false,
	listening: false,
	thinking: false,
	speaking: false
})

const visualVideoState = ref<ChatStatus>('idle')
const pendingVideoState = ref<ChatStatus | null>(null)
const hasInput = computed(() => inputText.value.trim().length > 0)
const activeVideoReady = computed(() => readyStates[visualVideoState.value])

const setVideoRef = (state: ChatStatus, element: HTMLVideoElement | null) => {
	videoRefs[state] = element
}

const playVideo = async (video: HTMLVideoElement | null, restart = false) => {
	if (!video) {
		return
	}

	if (restart) {
		try {
			video.currentTime = 0
		} catch {
			// Ignore currentTime reset errors when metadata is not ready yet.
		}
	}

	try {
		await video.play()
	} catch {
		// Autoplay may still be deferred until the first interaction.
	}
}

const playAllVideos = () => {
	videoStates.forEach((state) => {
		void playVideo(videoRefs[state])
	})
}

const syncVisualState = (state: ChatStatus) => {
	void playVideo(videoRefs[state], state !== 'idle')

	if (state === visualVideoState.value) {
		pendingVideoState.value = null
		return
	}

	if (!readyStates[state]) {
		pendingVideoState.value = state
		return
	}

	pendingVideoState.value = null

	window.requestAnimationFrame(() => {
		visualVideoState.value = state
	})
}

const handleVideoReady = (state: ChatStatus) => {
	readyStates[state] = true
	void playVideo(videoRefs[state])

	if (pendingVideoState.value === state) {
		syncVisualState(state)
	}
}

const handleSuggestion = (text: string) => {
	store.sendMessage(text)
}

const handleSend = () => {
	if (!hasInput.value) {
		return
	}

	store.sendMessage(inputText.value)
}

const handleInputKeydown = (event: KeyboardEvent) => {
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault()
		handleSend()
	}
}

const handleMicLeave = () => {
	if (isRecording.value) {
		store.stopListening()
	}
}

watch(chatStatus, (state) => {
	syncVisualState(state)
})

onMounted(() => {
	store.initWelcome()

	nextTick(() => {
		visualVideoState.value = chatStatus.value
		playAllVideos()
		syncVisualState(chatStatus.value)
	})
})

onBeforeUnmount(() => {
	store.destroy()
})
</script>

<style lang="less" scoped>
.digital-human {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.digital-human.is-expanded {
	position: fixed;
	top: 0;
	right: 16px;
	z-index: 40;
	width: 374px;
}

.assistant-trigger {
	width: 174px;
	height: 61px;
	border: none;
	padding: 0;
	background: url('/design/assistant-pill.png') center / 100% 100% no-repeat;
	cursor: pointer;
	transition: transform 0.18s ease, filter 0.18s ease;

	&:hover {
		transform: translateY(-1px);
		filter: drop-shadow(0 8px 20px rgba(156, 171, 202, 0.26));
	}
}

.assistant-layer {
	position: relative;
	width: 100%;
}

.assistant-layer__glow {
	position: absolute;
	inset: -14px -16px -20px;
	border-radius: 38px;
	background:
		radial-gradient(circle at 50% 10%, rgba(83, 123, 255, 0.52), transparent 26%),
		linear-gradient(180deg, rgba(49, 96, 255, 0.64), rgba(61, 112, 255, 0.18) 42%, rgba(61, 112, 255, 0.62));
	filter: blur(18px);
	opacity: 0.88;
	pointer-events: none;
}

.assistant-card {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 0;
	min-height: 770px;
	padding: 14px 15px 16px;
	border-radius: 22px;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(252, 253, 255, 0.985));
	border: 1px solid rgba(230, 233, 243, 0.96);
	box-shadow: 0 18px 34px rgba(128, 149, 203, 0.26);
}

.assistant-card__header {
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 36px;
	padding: 1px 2px 0;
}

.assistant-card__close {
	flex: none;
	width: 22px;
	height: 22px;
	border: none;
	background: transparent;
	color: #2b3346;
	font-size: 24px;
	line-height: 1;
	cursor: pointer;
}

.assistant-card__title-group {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	h2 {
		color: #20283c;
		font-size: 17px;
		line-height: 1.2;
		font-weight: 800;
	}
}

.assistant-card__meta {
	display: flex;
	align-items: center;
	gap: 10px;
}

.assistant-card__chip {
	color: #a3dd64;
	font-size: 11px;
	font-weight: 700;
	white-space: nowrap;
}

.assistant-card__online {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	color: #2f384d;
	font-size: 11px;
	font-weight: 700;
	white-space: nowrap;

	i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #59c839;
	}
}

.assistant-stage {
	position: relative;
	margin-top: 8px;
	height: 356px;
	--stage-accent-rgb: 101, 137, 255;
	--stage-accent-soft: rgba(var(--stage-accent-rgb), 0.18);
	--stage-accent-mid: rgba(var(--stage-accent-rgb), 0.26);
	--stage-accent-strong: rgba(var(--stage-accent-rgb), 0.34);
	--stage-floor-shadow: rgba(63, 93, 164, 0.18);
	--video-edge-shadow: rgba(var(--stage-accent-rgb), 0.12);
}

.assistant-stage.is-idle {
	--stage-accent-rgb: 103, 140, 255;
}

.assistant-stage.is-listening {
	--stage-accent-rgb: 82, 166, 255;
}

.assistant-stage.is-thinking {
	--stage-accent-rgb: 97, 133, 255;
}

.assistant-stage.is-speaking {
	--stage-accent-rgb: 88, 156, 255;
}

.assistant-stage__backdrop {
	position: absolute;
	inset: 0 22px 0;
	border-radius: 32px;
	overflow: hidden;
	isolation: isolate;
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(245, 249, 255, 0.24) 55%, rgba(255, 255, 255, 0));
}

.assistant-stage__backdrop-layer,
.assistant-stage__backdrop-mesh,
.assistant-stage__backdrop-floor {
	position: absolute;
	inset: 0;
	border-radius: inherit;
	pointer-events: none;
}

.assistant-stage__backdrop-layer {
	opacity: 0;
	transform: scale(1.04);
	transition:
		opacity 480ms cubic-bezier(0.22, 1, 0.36, 1),
		transform 480ms cubic-bezier(0.22, 1, 0.36, 1),
		filter 480ms ease;
	filter: blur(18px) saturate(0.92);
}

.assistant-stage__backdrop-layer.is-active {
	opacity: 1;
	transform: scale(1);
	filter: blur(0) saturate(1);
}

.assistant-stage__backdrop-layer.is-idle {
	background:
		radial-gradient(circle at 50% 16%, rgba(126, 158, 255, 0.22), transparent 24%),
		radial-gradient(circle at 50% 72%, rgba(109, 155, 255, 0.15), transparent 28%),
		linear-gradient(180deg, rgba(251, 253, 255, 0.88), rgba(224, 235, 255, 0.54) 58%, rgba(244, 248, 255, 0.18));
}

.assistant-stage__backdrop-layer.is-listening {
	background:
		radial-gradient(circle at 50% 18%, rgba(84, 173, 255, 0.24), transparent 24%),
		radial-gradient(circle at 28% 60%, rgba(118, 193, 255, 0.12), transparent 24%),
		radial-gradient(circle at 72% 62%, rgba(88, 159, 255, 0.14), transparent 24%),
		linear-gradient(180deg, rgba(244, 251, 255, 0.89), rgba(214, 233, 255, 0.54) 58%, rgba(240, 247, 255, 0.18));
}

.assistant-stage__backdrop-layer.is-thinking {
	background:
		radial-gradient(circle at 50% 20%, rgba(118, 133, 255, 0.24), transparent 26%),
		radial-gradient(circle at 38% 58%, rgba(145, 167, 255, 0.12), transparent 22%),
		radial-gradient(circle at 66% 64%, rgba(99, 126, 255, 0.14), transparent 24%),
		linear-gradient(180deg, rgba(247, 249, 255, 0.9), rgba(224, 230, 255, 0.56) 58%, rgba(243, 245, 255, 0.2));
}

.assistant-stage__backdrop-layer.is-speaking {
	background:
		radial-gradient(circle at 50% 16%, rgba(92, 166, 255, 0.24), transparent 24%),
		radial-gradient(circle at 32% 62%, rgba(121, 197, 255, 0.12), transparent 24%),
		radial-gradient(circle at 70% 64%, rgba(84, 148, 255, 0.15), transparent 22%),
		linear-gradient(180deg, rgba(246, 251, 255, 0.9), rgba(218, 236, 255, 0.56) 58%, rgba(241, 248, 255, 0.2));
}

.assistant-stage__backdrop-mesh {
	background:
		radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.48), transparent 28%),
		linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
		repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.08) 0 10px, rgba(255, 255, 255, 0) 10px 24px);
	opacity: 0.72;
	mix-blend-mode: screen;
}

.assistant-stage__backdrop-floor {
	inset: auto 28px 18px;
	height: 72px;
	border-radius: 50%;
	background: radial-gradient(circle, var(--stage-floor-shadow) 0, rgba(76, 97, 150, 0.08) 38%, rgba(76, 97, 150, 0) 72%);
	filter: blur(10px);
	transform: scaleX(1.08);
	opacity: 0.9;
}

.assistant-stage__media {
	position: absolute;
	inset: -8px 6px 0;
	overflow: hidden;
	isolation: isolate;

	&::before {
		content: '';
		position: absolute;
		inset: 24px 44px 56px;
		border-radius: 999px;
		background:
			radial-gradient(circle at 50% 42%, var(--stage-accent-strong) 0, var(--stage-accent-mid) 22%, transparent 58%),
			radial-gradient(circle at 50% 76%, var(--stage-accent-soft) 0, transparent 62%);
		filter: blur(24px);
		opacity: 0.92;
		transform: scale(1.03);
		z-index: 0;
		transition:
			background 420ms ease,
			opacity 420ms ease,
			transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
	}
}

.assistant-stage__video {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: var(--video-object-position, 50% 57%);
	opacity: 0;
	transform: translate3d(0, var(--video-rest-shift-y, 18px), 0) scale(var(--video-rest-scale, 1.08));
	transform-origin: 50% 52%;
	transition:
		opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
		transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
		filter 420ms ease;
	filter: blur(10px) saturate(0.94) brightness(0.98) drop-shadow(0 20px 40px var(--video-edge-shadow));
	will-change: opacity, transform, filter;
	backface-visibility: hidden;
	z-index: 1;
	mask-image: radial-gradient(ellipse 64% 72% at 50% 48%, #000 0 58%, rgba(0, 0, 0, 0.94) 70%, transparent 88%);
	-webkit-mask-image: radial-gradient(ellipse 64% 72% at 50% 48%, #000 0 58%, rgba(0, 0, 0, 0.94) 70%, transparent 88%);
}

.assistant-stage__video.is-ready.is-active {
	opacity: 1;
	transform: translate3d(0, var(--video-active-shift-y, 0), 0) scale(var(--video-active-scale, 1.04));
	filter: blur(0) saturate(1) brightness(1) drop-shadow(0 24px 44px var(--video-edge-shadow));
}

.assistant-stage__loading {
	position: absolute;
	left: 50%;
	bottom: 30px;
	transform: translateX(-50%);
	min-width: 160px;
	height: 34px;
	padding: 0 14px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.92);
	color: #7a869f;
	font-size: 12px;
	font-weight: 600;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8px 20px rgba(184, 193, 214, 0.18);
}

.assistant-greeting {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 2px;
	padding: 0 4px;

	p {
		color: #2d3447;
		font-size: 15px;
		line-height: 1.5;
		font-weight: 800;
	}
}

.assistant-greeting__sparkle {
	color: #6b75ff;
	font-size: 12px;
}

.assistant-prompts {
	margin-top: 12px;
	padding: 14px 11px 12px;
	border-radius: 16px;
	background: linear-gradient(180deg, #f4f7fd, #f7f9fd);
	border: 1px solid rgba(234, 238, 247, 0.98);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.assistant-prompts__label {
	color: #bcc5d4;
	font-size: 12px;
	line-height: 1.2;
	margin-bottom: 10px;
}

.assistant-prompts__item {
	width: 100%;
	min-height: 44px;
	margin-top: 10px;
	padding: 0 18px;
	border: 1px solid rgba(241, 243, 248, 0.98);
	border-radius: 14px;
	background: #ffffff;
	color: #4c566b;
	font-size: 13px;
	line-height: 1.4;
	text-align: left;
	cursor: pointer;
	box-shadow: 0 6px 14px rgba(224, 228, 237, 0.18);
	transition: transform 0.18s ease, box-shadow 0.18s ease;

	&:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 18px rgba(210, 217, 232, 0.22);
	}
}

.assistant-input {
	position: relative;
	min-height: 102px;
	margin-top: 12px;
	padding: 13px 16px 14px;
	border-radius: 16px;
	border: 1px solid rgba(223, 229, 240, 0.98);
	background: #ffffff;
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.assistant-input__field {
	width: 100%;
	min-height: 72px;
	padding: 0;
	border: none;
	resize: none;
	outline: none;
	color: #3d4860;
	font-size: 13px;
	line-height: 1.6;
	background: transparent;

	&::placeholder {
		color: #c7ccd8;
	}
}

.assistant-input__mic,
.assistant-input__send {
	position: absolute;
	bottom: 8px;
	border: none;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.assistant-input__mic {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: linear-gradient(180deg, #f7f8fc, #eff2f8);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.assistant-input__mic.is-right {
	right: 8px;
}

.assistant-input__mic.is-left {
	left: 12px;
}

.assistant-input__mic.is-recording {
	background: linear-gradient(180deg, #fff6df, #ffe9ab);
	box-shadow: 0 0 0 8px rgba(255, 209, 105, 0.18);
}

.assistant-input__mic-icon {
	position: relative;
	width: 10px;
	height: 12px;
	border: 1.8px solid #596273;
	border-radius: 6px;

	&::before,
	&::after {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		background: #596273;
	}

	&::before {
		bottom: -4px;
		width: 8px;
		height: 1.5px;
		border-radius: 999px;
	}

	&::after {
		bottom: -8px;
		width: 1.5px;
		height: 5px;
	}
}

.assistant-input__send {
	right: 8px;
	width: 36px;
	height: 36px;
	border-radius: 12px;
	background: linear-gradient(180deg, #6f8dff, #4d6bff);
	color: #ffffff;
	box-shadow: 0 10px 24px rgba(91, 115, 255, 0.32);

	svg {
		width: 18px;
		height: 18px;
	}
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

@media (max-width: 1280px) {
	.digital-human.is-expanded {
		position: fixed;
		top: 0;
		right: 12px;
		width: 352px;
	}
}

@media (max-width: 560px) {
	.digital-human.is-expanded {
		left: 12px;
		right: 12px;
		width: auto;
	}

	.assistant-card {
		min-height: calc(100vh - 112px);
	}
}
</style>
