<template>
  <section class="workspace-view workspace-view--todo" aria-label="增强待办">
    <nav class="workspace-subtabs" aria-label="待办分类">
      <button v-for="item in filters" :key="item" type="button" :class="{ 'is-active': item === activeFilter }" @click="activeFilter = item">{{ item }}</button>
    </nav>
    <div v-if="isLoading && !todos.length" class="workspace-state">正在加载待办项目...</div>
    <div v-else-if="errorMessage && !todos.length" class="workspace-state is-error">
      <span>{{ errorMessage }}</span>
      <button type="button" @click="loadTodos">重新加载</button>
    </div>
    <div v-else-if="!filteredTodos.length" class="workspace-state">暂无待办项目</div>
    <div class="todo-list">
      <article v-for="item in filteredTodos" :key="item.id" class="todo-card">
        <span class="todo-card__dot"></span>
        <div class="todo-card__main">
          <strong>{{ item.title }}</strong>
          <time>{{ item.time }}</time>
          <span class="todo-card__start">发起</span>
        </div>
        <span class="todo-card__badge" :class="item.isUrgent ? 'is-urgent' : 'is-normal'">{{ item.statusText }}</span>
        <div class="todo-card__actions">
          <button v-for="action in item.actions" :key="action" type="button" @click="notifyDeveloping">
            <component :is="actionIconMap[action]" />
            <span>{{ action }}</span>
          </button>
          <button class="todo-card__more" type="button" aria-label="更多操作" @click="notifyDeveloping">
            <MoreOutlined />
          </button>
        </div>
      </article>
    </div>
    <p v-if="isLoading && todos.length" class="workspace-refresh-tip">正在刷新...</p>
    <p v-else-if="errorMessage && todos.length" class="workspace-refresh-tip is-error">{{ errorMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import {
  AuditOutlined,
  BarChartOutlined,
  EditOutlined,
  MoreOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons-vue'
import { DIGITAL_HUMAN_DEVELOPMENT_NOTICE, DIGITAL_HUMAN_TODO_FILTERS } from '@/config/demo-config'
import { fetchTodoProjects, type GuideProjectCard } from '@/services/guide-api'

const props = defineProps<{
  active: boolean
}>()

const filters = DIGITAL_HUMAN_TODO_FILTERS
const activeFilter = ref(filters[0])
const todos = ref<GuideProjectCard[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
let activeRequest: AbortController | null = null
const actionIconMap: Record<string, unknown> = {
  提问: QuestionCircleOutlined,
  写报告: EditOutlined,
  审核: AuditOutlined,
  问数: BarChartOutlined,
}
const notifyDeveloping = () => antMessage.info(DIGITAL_HUMAN_DEVELOPMENT_NOTICE)

const resolveCategory = (taskType: number | null) => {
  if (taskType === 3) return '绩效目标'
  if (taskType === 1) return '事前'
  if (taskType === 5) return '事中'
  if (taskType === 2) return '事后'
  return '其他'
}

const filteredTodos = computed(() => {
  if (activeFilter.value === filters[0]) {
    return todos.value
  }

  return todos.value.filter((item) => resolveCategory(item.taskType) === activeFilter.value)
})

const loadTodos = async () => {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  isLoading.value = true
  errorMessage.value = ''

  try {
    const projects = await fetchTodoProjects(controller.signal)
    if (!controller.signal.aborted) {
      todos.value = projects
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      errorMessage.value = error instanceof Error ? error.message : '待办项目加载失败'
    }
  } finally {
    if (activeRequest === controller) {
      activeRequest = null
      isLoading.value = false
    }
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) {
      void loadTodos()
      return
    }

    activeRequest?.abort()
    activeRequest = null
    isLoading.value = false
  },
  { immediate: true },
)

onBeforeUnmount(() => activeRequest?.abort())
</script>

<style scoped lang="less">
.workspace-view { flex: 1; min-height: 0; overflow-y: auto; padding: 17px 12px 14px; color: #20242c; background: #fafaf8; }
.workspace-subtabs { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 13px; padding: 0 8px; overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
.workspace-subtabs::-webkit-scrollbar { display: none; }
.workspace-subtabs button { flex: none; min-width: 42px; padding: 5px 7px; border: 0; border-radius: 6px; background: transparent; color: #30343b; font-size: 12px; line-height: 18px; cursor: pointer; }
.workspace-subtabs button.is-active { background: #edf7ff; color: #3d9cff; font-weight: 600; }
.workspace-state { display: flex; min-height: 150px; align-items: center; justify-content: center; gap: 10px; color: #8b929d; font-size: 12px; text-align: center; }
.workspace-state.is-error { flex-direction: column; color: #d05b48; }
.workspace-state button { padding: 5px 12px; border: 1px solid #cbd9ef; border-radius: 6px; background: #fff; color: #4384e8; cursor: pointer; }
.workspace-refresh-tip { margin: 8px 8px 0; color: #8b929d; font-size: 11px; text-align: center; }
.workspace-refresh-tip.is-error { color: #d05b48; }
.todo-list { display: grid; gap: 20px; padding: 0 8px 24px; }
.todo-card { position: relative; display: grid; grid-template-columns: 8px minmax(0, 1fr); grid-template-rows: auto auto; gap: 9px 3px; min-height: 125px; padding: 16px 11px 12px; border: 1px solid #dcdfe4; border-radius: 8px; background: #fff; box-shadow: 0 2px 5px rgba(50, 59, 75, .045); }
.todo-card__dot { width: 5px; height: 5px; margin-top: 5px; border-radius: 50%; background: #ff3041; }
.todo-card__main { display: grid; grid-template-columns: minmax(0, 1fr) 54px; align-items: center; gap: 8px; padding-right: 78px; }
.todo-card__main strong { overflow: hidden; color: #111419; font-size: 13px; font-weight: 700; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.todo-card__main time { color: #c2c5cc; font-size: 11px; text-align: right; }
.todo-card__start { grid-column: 1 / -1; width: fit-content; padding: 1px 9px; border: 1px solid #8ed7ff; border-radius: 4px; background: #effaff; color: #32a6ef; font-size: 10px; line-height: 18px; }
.todo-card__badge { position: absolute; top: -1px; right: -8px; z-index: 1; min-width: 41px; padding: 5px 7px; border-radius: 4px 4px 0 4px; color: #fff; font-size: 11px; line-height: 15px; text-align: center; }
.todo-card__badge::after { content: ''; position: absolute; right: 0; bottom: -6px; width: 0; height: 0; border-right: 7px solid transparent; }
.todo-card__badge.is-urgent { background: #ff5b2d; }
.todo-card__badge.is-urgent::after { border-top: 6px solid #d9471d; }
.todo-card__badge.is-normal { background: #2699f2; }
.todo-card__badge.is-normal::after { border-top: 6px solid #167ecb; }
.todo-card__actions { grid-column: 2; display: flex; align-items: center; gap: 5px; min-width: 0; margin-top: 0; overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
.todo-card__actions::-webkit-scrollbar { display: none; }
.todo-card__actions button { flex: none; display: inline-flex; align-items: center; gap: 4px; height: 27px; padding: 0 9px; border: 0; border-radius: 4px; background: #f5f6fa; color: #404752; font-size: 11px; cursor: pointer; }
.todo-card__actions button :deep(.anticon) { color: #637dff; font-size: 14px; }
.todo-card__actions button:hover { background: #eef3ff; color: #377eea; }
.todo-card__actions .todo-card__more { width: 26px; padding: 0; justify-content: center; border: 1px solid #e2e5ea; background: #fff; }

@media (max-width: 430px) {
  .workspace-subtabs { gap: 12px; }
  .todo-card__main { padding-right: 58px; }
}
</style>
