<template>
  <a-modal
    :open="open"
    title="近期项目"
    :footer="null"
    :width="430"
    centered
    @cancel="close"
  >
    <div v-if="isLoading && !projects.length" class="recent-projects-state">正在加载近期项目...</div>
    <div v-else-if="errorMessage && !projects.length" class="recent-projects-state is-error">
      <span>{{ errorMessage }}</span>
      <button type="button" @click="loadProjects">重新加载</button>
    </div>
    <div v-else-if="!projects.length" class="recent-projects-state">暂无近期项目</div>

    <div v-else class="recent-projects-list">
      <article v-for="project in projects" :key="project.id" class="recent-project-card">
        <span class="recent-project-card__dot"></span>
        <div class="recent-project-card__main">
          <strong>{{ project.title }}</strong>
          <time>{{ project.time || project.deadline || '—' }}</time>
          <span class="recent-project-card__stage">{{ project.currentStageName || project.taskTypeName || '进行中' }}</span>
        </div>
        <span class="recent-project-card__badge" :class="{ 'is-urgent': project.isUrgent }">{{ project.statusText }}</span>
        <div class="recent-project-card__actions">
          <button v-for="action in project.actions" :key="action" type="button" @click="notifyDeveloping">
            <component :is="actionIconMap[action]" />
            <span>{{ action }}</span>
          </button>
        </div>
      </article>
    </div>

    <p v-if="isLoading && projects.length" class="recent-projects-refresh">正在刷新...</p>
    <p v-else-if="errorMessage && projects.length" class="recent-projects-refresh is-error">{{ errorMessage }}</p>
  </a-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Modal as AModal, message as antMessage } from 'ant-design-vue'
import {
  AuditOutlined,
  BarChartOutlined,
  EditOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons-vue'
import { DIGITAL_HUMAN_DEVELOPMENT_NOTICE } from '@/config/demo-config'
import { fetchRecentProjects, type GuideProjectCard } from '@/services/guide-api'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

const projects = ref<GuideProjectCard[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
let activeRequest: AbortController | null = null

const actionIconMap: Record<string, unknown> = {
  提问: QuestionCircleOutlined,
  写报告: EditOutlined,
  审核: AuditOutlined,
  问数: BarChartOutlined,
}

const close = () => emit('update:open', false)
const notifyDeveloping = () => antMessage.info(DIGITAL_HUMAN_DEVELOPMENT_NOTICE)

const loadProjects = async () => {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  isLoading.value = true
  errorMessage.value = ''

  try {
    const nextProjects = await fetchRecentProjects(controller.signal)
    if (!controller.signal.aborted) {
      projects.value = nextProjects
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      errorMessage.value = error instanceof Error ? error.message : '近期项目加载失败'
    }
  } finally {
    if (activeRequest === controller) {
      activeRequest = null
      isLoading.value = false
    }
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      void loadProjects()
      return
    }

    activeRequest?.abort()
    activeRequest = null
    isLoading.value = false
  },
)

onBeforeUnmount(() => activeRequest?.abort())
</script>

<style scoped lang="less">
.recent-projects-list { display: grid; gap: 12px; max-height: 58vh; overflow-y: auto; padding: 2px 2px 4px; }
.recent-project-card { position: relative; display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 7px 3px; min-height: 112px; padding: 14px 10px 11px; border: 1px solid #dfe2e7; border-radius: 8px; background: #fff; box-shadow: 0 2px 5px rgba(50, 59, 75, .045); }
.recent-project-card__dot { width: 5px; height: 5px; margin-top: 5px; border-radius: 50%; background: #ff3041; }
.recent-project-card__main { display: grid; grid-template-columns: minmax(0, 1fr) 64px; align-items: center; gap: 7px; padding-right: 70px; }
.recent-project-card__main strong { overflow: hidden; color: #111419; font-size: 13px; font-weight: 700; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.recent-project-card__main time { color: #aeb5bf; font-size: 11px; text-align: right; }
.recent-project-card__stage { grid-column: 1 / -1; width: fit-content; padding: 1px 8px; border: 1px solid #8ed7ff; border-radius: 4px; background: #effaff; color: #32a6ef; font-size: 10px; line-height: 18px; }
.recent-project-card__badge { position: absolute; top: -1px; right: -1px; padding: 5px 8px; border-radius: 4px 4px 0 4px; background: #2699f2; color: #fff; font-size: 11px; line-height: 15px; }
.recent-project-card__badge.is-urgent { background: #ff5b2d; }
.recent-project-card__actions { grid-column: 2; display: flex; gap: 5px; min-width: 0; overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
.recent-project-card__actions::-webkit-scrollbar { display: none; }
.recent-project-card__actions button { flex: none; display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border: 0; border-radius: 4px; background: #f5f6fa; color: #404752; font-size: 11px; cursor: pointer; }
.recent-project-card__actions button :deep(.anticon) { color: #637dff; font-size: 14px; }
.recent-projects-state { display: flex; min-height: 150px; align-items: center; justify-content: center; color: #8b929d; font-size: 12px; text-align: center; }
.recent-projects-state.is-error { flex-direction: column; gap: 10px; color: #d05b48; }
.recent-projects-state button { padding: 5px 12px; border: 1px solid #cbd9ef; border-radius: 6px; background: #fff; color: #4384e8; cursor: pointer; }
.recent-projects-refresh { margin: 8px 0 0; color: #8b929d; font-size: 11px; text-align: center; }
.recent-projects-refresh.is-error { color: #d05b48; }
</style>
