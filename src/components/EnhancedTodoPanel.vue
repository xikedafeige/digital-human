<template>
	<section class="workspace-view workspace-view--todo" aria-label="增强待办">
		<nav class="workspace-source-tabs" aria-label="待办来源">
			<button v-for="source in sources" :key="source.key" type="button"
				:class="{ 'is-active': source.key === activeSource }" @click="handleSourceChange(source.key)">
				{{ source.label }}
			</button>
		</nav>
		<nav class="workspace-subtabs" aria-label="待办分类">
			<button v-for="item in filters" :key="item" type="button" :class="{ 'is-active': item === activeFilter }"
				@click="activeFilter = item">{{ item }}</button>
		</nav>
		<div class="workspace-view__content">
			<div v-if="isLoading && !hasTodos" class="workspace-state">正在加载待办项目...</div>
			<div v-else-if="errorMessage && !hasTodos" class="workspace-state is-error">
				<span>{{ errorMessage }}</span>
				<button type="button" @click="loadCurrentSource">重新加载</button>
			</div>
			<div v-else-if="!filteredTodos.length" class="workspace-state">暂无待办项目</div>
			<div v-else class="todo-list">
				<article v-for="item in filteredTodos" :key="item.id" class="todo-card">
					<span class="todo-card__dot"></span>
					<div class="todo-card__main">
						<a-tooltip :title="item.title">
							<strong>{{ item.title }}</strong>
						</a-tooltip>
						<a-tooltip :title="item.createTime || '—'">
							<time>{{ item.createTime || '—' }}</time>
						</a-tooltip>
						<div class="todo-card__meta">
							<a-tooltip :title="item.todoCategory || item.taskTypeName || '—'">
								<span class="todo-card__type">{{ item.todoCategory || item.taskTypeName || '—' }}</span>
							</a-tooltip>
							<a-tooltip :title="item.currentStageName || '待处理'">
								<span class="todo-card__start">{{ item.currentStageName || '待处理' }}</span>
							</a-tooltip>
							<a-tooltip :title="item.initiatorName || '—'">
								<span class="todo-card__creator">创建人：{{ item.initiatorName || '—' }}</span>
							</a-tooltip>
							<a-tooltip :title="item.durationDesc || '—'">
								<span class="todo-card__duration" :class="{ 'is-urgent': item.isUrgent }">停留时间：{{ item.durationDesc ||
									'—' }}</span>
							</a-tooltip>
						</div>
					</div>
					<span class="todo-card__badge" :class="item.isUrgent ? 'is-urgent' : 'is-normal'">{{ item.statusText }}</span>
					<div class="todo-card__actions">
						<button v-for="action in item.actions" :key="action" type="button" @click="handleAction(item, action)">
							<component :is="actionIconMap[action]" />
							<span>{{ action }}</span>
						</button>
						<button class="todo-card__more" type="button" aria-label="更多操作" @click="notifyDeveloping">
							<MoreOutlined />
						</button>
					</div>
				</article>
			</div>
			<p v-if="isLoading && hasTodos" class="workspace-refresh-tip">正在刷新...</p>
			<p v-else-if="errorMessage && hasTodos" class="workspace-refresh-tip is-error">{{ errorMessage }}</p>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Tooltip as ATooltip, message as antMessage } from 'ant-design-vue'
import {
	AuditOutlined,
	BarChartOutlined,
	EditOutlined,
	MoreOutlined,
	QuestionCircleOutlined,
} from '@ant-design/icons-vue'
import { DIGITAL_HUMAN_DEVELOPMENT_NOTICE, DIGITAL_HUMAN_TODO_FILTERS } from '@/config/demo-config'
import {
	fetchRecentTodoProjects,
	fetchTodoProjects,
	type GuideProjectCard,
	type GuideTodoProjectGroups,
} from '@/services/guide-api'

const props = defineProps<{
	active: boolean
}>()

const emit = defineEmits<{
	(event: 'select-project', project: GuideProjectCard): void
}>()

const filters = DIGITAL_HUMAN_TODO_FILTERS
const activeFilter = ref(filters[0])
const sources = [
	{ key: 'todos', label: '全部待办' },
	{ key: 'recent', label: '近期项目' },
] as const
type TodoSource = (typeof sources)[number]['key']

const activeSource = ref<TodoSource>('todos')
const todoGroups = ref<GuideTodoProjectGroups>({ all: [], groups: {}, total: 0 })
const recentGroups = ref<GuideTodoProjectGroups>({ all: [], groups: {}, total: 0 })
const loadingSource = ref<TodoSource | null>(null)
const errorBySource = ref<Record<TodoSource, string>>({ todos: '', recent: '' })
let activeRequest: AbortController | null = null
const actionIconMap: Record<string, unknown> = {
	提问: QuestionCircleOutlined,
	写报告: EditOutlined,
	审核: AuditOutlined,
	问数: BarChartOutlined,
}
const notifyDeveloping = () => antMessage.info(DIGITAL_HUMAN_DEVELOPMENT_NOTICE, 0.8)

const categoryMap: Record<string, string> = {
	全部任务: '全部',
	绩效目标: '绩效目标申报',
	事前: '事前',
	事中: '事中',
	事后: '事后',
	其他: '其他',
}

const currentGroups = computed(() =>
	activeSource.value === 'todos' ? todoGroups.value : recentGroups.value,
)
const isLoading = computed(() => loadingSource.value === activeSource.value)
const errorMessage = computed(() => errorBySource.value[activeSource.value])

const filteredTodos = computed(() => {
	if (activeFilter.value === filters[0]) {
		return currentGroups.value.all
	}

	return currentGroups.value.groups[categoryMap[activeFilter.value] ?? activeFilter.value] ?? []
})

const hasTodos = computed(() => currentGroups.value.all.length > 0)

const handleAction = (project: GuideProjectCard, action: string) => {
	if (action === '提问') {
		emit('select-project', project)
		return
	}

	notifyDeveloping()
}

const loadCurrentSource = async () => {
	activeRequest?.abort()
	const controller = new AbortController()
	activeRequest = controller
	const source = activeSource.value
	loadingSource.value = source
	errorBySource.value[source] = ''

	try {
		const projects = source === 'todos'
			? await fetchTodoProjects(controller.signal)
			: await fetchRecentTodoProjects(controller.signal)
		if (!controller.signal.aborted && activeSource.value === source) {
			if (source === 'todos') {
				todoGroups.value = projects
			} else {
				recentGroups.value = projects
			}
		}
	} catch (error) {
		if (!controller.signal.aborted && activeSource.value === source) {
			errorBySource.value[source] = error instanceof Error ? error.message : '待办项目加载失败'
		}
	} finally {
		if (activeRequest === controller) {
			activeRequest = null
			loadingSource.value = null
		}
	}
}

const handleSourceChange = (source: TodoSource) => {
	activeRequest?.abort()
	activeSource.value = source
	activeFilter.value = filters[0]
	if (props.active) {
		void loadCurrentSource()
	}
}

watch(
	() => props.active,
	(active) => {
		if (active) {
			void loadCurrentSource()
			return
		}

		activeRequest?.abort()
		activeRequest = null
		loadingSource.value = null
	},
	{ immediate: true },
)

onBeforeUnmount(() => activeRequest?.abort())
</script>

<style scoped lang="less">
.workspace-view {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	overflow: hidden;
	padding: 17px 12px 14px;
	color: #20242c;
	background: #fafaf8;
}

.workspace-source-tabs {
	flex: none;
	display: flex;
	align-items: center;
	gap: 16px;
	margin: 0 8px 10px;
	border-bottom: 1px solid #edf0f4;
}

.workspace-source-tabs button {
	position: relative;
	padding: 0 1px 8px;
	border: 0;
	background: transparent;
	color: #7d8796;
	font-size: 13px;
	line-height: 20px;
	cursor: pointer;
}

.workspace-source-tabs button.is-active {
	color: #2f85e8;
	font-weight: 600;
}

.workspace-source-tabs button.is-active::after {
	position: absolute;
	right: 0;
	bottom: -1px;
	left: 0;
	height: 2px;
	border-radius: 2px 2px 0 0;
	background: #3d9cff;
	content: '';
}

.workspace-subtabs {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin: 0 0 13px;
	padding: 0 8px;
	overflow-x: auto;
	scrollbar-width: none;
	white-space: nowrap;
}

.workspace-subtabs::-webkit-scrollbar {
	display: none;
}

.workspace-subtabs button {
	flex: none;
	min-width: 42px;
	padding: 5px 7px;
	border: 0;
	border-radius: 6px;
	background: transparent;
	color: #30343b;
	font-size: 12px;
	line-height: 18px;
	cursor: pointer;
}

.workspace-subtabs button.is-active {
	background: #edf7ff;
	color: #3d9cff;
	font-weight: 600;
}

.workspace-view__content {
	min-height: 0;
	flex: 1;
	overflow-y: auto;
	scrollbar-gutter: stable;
}

.workspace-state {
	display: flex;
	min-height: 150px;
	align-items: center;
	justify-content: center;
	gap: 10px;
	color: #8b929d;
	font-size: 12px;
	text-align: center;
}

.workspace-state.is-error {
	flex-direction: column;
	color: #d05b48;
}

.workspace-state button {
	padding: 5px 12px;
	border: 1px solid #cbd9ef;
	border-radius: 6px;
	background: #fff;
	color: #4384e8;
	cursor: pointer;
}

.workspace-refresh-tip {
	margin: 8px 8px 0;
	color: #8b929d;
	font-size: 11px;
	text-align: center;
}

.workspace-refresh-tip.is-error {
	color: #d05b48;
}

.todo-list {
	display: grid;
	gap: 20px;
	padding: 0 8px 24px;
}

.todo-card {
	position: relative;
	display: grid;
	grid-template-columns: 8px minmax(0, 1fr);
	grid-template-rows: auto auto;
	gap: 9px 3px;
	min-height: 156px;
	padding: 16px 11px 12px;
	border: 1px solid #dcdfe4;
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 2px 5px rgba(50, 59, 75, .045);
}

.todo-card__dot {
	width: 5px;
	height: 5px;
	margin-top: 5px;
	border-radius: 50%;
	background: #ff3041;
}

.todo-card__main {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 120px;
	align-items: start;
	gap: 8px;
	padding-right: 78px;
}

.todo-card__main :deep(.ant-tooltip-open) {
	display: block;
	min-width: 0;
}

.todo-card__main strong {
	display: block;
	overflow: hidden;
	color: #111419;
	font-size: 13px;
	font-weight: 700;
	line-height: 20px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.todo-card__main time {
	display: block;
	width: 120px;
	padding-top: 5px;
	overflow: hidden;
	color: #c2c5cc;
	font-size: 11px;
	text-align: right;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 10px;
}

.todo-card__meta {
	grid-column: 1 / -1;
	display: flex;
	flex-wrap: wrap;
	gap: 5px 6px;
	min-width: 0;
}

.todo-card__meta :deep(.ant-tooltip-open) {
	display: inline-block;
	max-width: 100%;
	min-width: 0;
}

.todo-card__meta span {
	display: block;
	max-width: 100%;
	overflow: hidden;
	padding: 1px 8px;
	border: 1px solid #e0e5ed;
	border-radius: 4px;
	color: #687386;
	font-size: 10px;
	line-height: 18px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.todo-card__meta .todo-card__type {
	border-color: #d8dff9;
	background: #f5f7ff;
	color: #5d71cc;
}

.todo-card__meta .todo-card__start {
	border-color: #8ed7ff;
	background: #effaff;
	color: #32a6ef;
}

.todo-card__meta .todo-card__creator {
	padding: 1px 0;
	border: 0;
	color: #7c8798;
}

.todo-card__meta .todo-card__duration {
	padding: 1px 0;
	border: 0;
	color: #ef8a2f;
}

.todo-card__meta .todo-card__duration.is-urgent {
	color: #e85a45;
}

.todo-card__badge {
	position: absolute;
	top: -1px;
	right: -8px;
	z-index: 1;
	min-width: 41px;
	padding: 5px 7px;
	border-radius: 4px 4px 0 4px;
	color: #fff;
	font-size: 11px;
	line-height: 15px;
	text-align: center;
}

.todo-card__badge::after {
	content: '';
	position: absolute;
	right: 0;
	bottom: -6px;
	width: 0;
	height: 0;
	border-right: 7px solid transparent;
}

.todo-card__badge.is-urgent {
	background: #ff5b2d;
}

.todo-card__badge.is-urgent::after {
	border-top: 6px solid #d9471d;
}

.todo-card__badge.is-normal {
	background: #2699f2;
}

.todo-card__badge.is-normal::after {
	border-top: 6px solid #167ecb;
}

.todo-card__actions {
	grid-column: 2;
	display: flex;
	align-items: center;
	gap: 5px;
	min-width: 0;
	margin-top: 0;
	overflow-x: auto;
	scrollbar-width: none;
	white-space: nowrap;
}

.todo-card__actions::-webkit-scrollbar {
	display: none;
}

.todo-card__actions button {
	flex: none;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	height: 27px;
	padding: 0 9px;
	border: 0;
	border-radius: 4px;
	background: #f5f6fa;
	color: #404752;
	font-size: 11px;
	cursor: pointer;
}

.todo-card__actions button :deep(.anticon) {
	color: #637dff;
	font-size: 14px;
}

.todo-card__actions button:hover {
	background: #eef3ff;
	color: #377eea;
}

.todo-card__actions .todo-card__more {
	width: 26px;
	padding: 0;
	justify-content: center;
	border: 1px solid #e2e5ea;
	background: #fff;
}

@media (max-width: 430px) {
	.workspace-subtabs {
		gap: 12px;
	}

	.todo-card__main {
		grid-template-columns: minmax(0, 1fr) 120px;
		padding-right: 58px;
	}
}
</style>
