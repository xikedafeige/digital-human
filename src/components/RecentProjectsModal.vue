<template>
  <a-modal
    :open="open"
    title="近期项目"
    :footer="null"
    :width="430"
    :body-style="recentProjectsModalBodyStyle"
    centered
    @cancel="close"
  >
    <div class="recent-projects-content">
      <div v-if="isInitialLoading" class="recent-projects-state">正在加载中，请耐心等待...</div>
      <div v-else-if="errorMessage && !projects.length" class="recent-projects-state is-error">
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadProjects(1)">重新加载</button>
      </div>
      <div v-else-if="!projects.length" class="recent-projects-state">暂无近期项目</div>

      <div v-else ref="projectsListRef" class="recent-projects-list" @scroll="handleProjectsScroll">
        <article v-for="project in projects" :key="project.id" class="recent-project-card">
          <span class="recent-project-card__dot"></span>
          <div class="recent-project-card__main">
            <a-tooltip :title="project.title">
              <strong>{{ project.title }}</strong>
            </a-tooltip>
            <a-tooltip :title="project.deadline || '—'">
              <time>{{ project.deadline || '—' }}</time>
            </a-tooltip>
            <div class="recent-project-card__meta">
              <a-tooltip :title="project.taskTypeName || '—'">
                <span class="recent-project-card__type">{{ project.taskTypeName || '—' }}</span>
              </a-tooltip>
              <a-tooltip :title="project.currentStageName || '进行中'">
                <span class="recent-project-card__stage">{{ project.currentStageName || '进行中' }}</span>
              </a-tooltip>
            </div>
          </div>
          <span class="recent-project-card__badge" :class="{ 'is-urgent': project.isUrgent }">{{ project.statusText }}</span>
          <div class="recent-project-card__actions">
            <button v-for="action in project.actions" :key="action" type="button" @click="handleAction(project, action)">
              <component :is="actionIconMap[action]" />
              <span>{{ action }}</span>
            </button>
          </div>
        </article>
        <div class="recent-projects-list__status" aria-live="polite">
          <span v-if="isLoadingMore">正在加载中，请耐心等待...</span>
          <span v-else-if="errorMessage">{{ errorMessage }}</span>
        </div>
      </div>

      <div v-if="isRefreshing" class="recent-projects-loading-mask" aria-live="polite">
        <span>正在加载中，请耐心等待...</span>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Modal as AModal, Tooltip as ATooltip, message as antMessage } from 'ant-design-vue'
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
  (event: 'select-project', project: GuideProjectCard): void
}>()

const projects = ref<GuideProjectCard[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const currentPage = ref(0)
const total = ref(0)
const hasMore = ref(true)
const loadingMode = ref<'initial' | 'refresh' | 'append' | ''>('')
const projectsListRef = ref<HTMLElement | null>(null)
let activeRequest: AbortController | null = null
const pageSize = 6
const recentProjectsModalBodyStyle = {
  height: 'clamp(260px, 58vh, 420px)',
  overflow: 'hidden',
}
const isInitialLoading = computed(() => isLoading.value && loadingMode.value === 'initial')
const isRefreshing = computed(() => isLoading.value && loadingMode.value === 'refresh')
const isLoadingMore = computed(() => isLoading.value && loadingMode.value === 'append')

const actionIconMap: Record<string, unknown> = {
  提问: QuestionCircleOutlined,
  写报告: EditOutlined,
  审核: AuditOutlined,
  问数: BarChartOutlined,
}

const close = () => emit('update:open', false)
const notifyDeveloping = () => antMessage.info(DIGITAL_HUMAN_DEVELOPMENT_NOTICE, 0.8)
const handleAction = (project: GuideProjectCard, action: string) => {
  if (action === '提问') {
    emit('select-project', project)
    close()
    return
  }

  notifyDeveloping()
}

const loadProjects = async (page: number) => {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  isLoading.value = true
  errorMessage.value = ''
  loadingMode.value = page === 1 ? (projects.value.length ? 'refresh' : 'initial') : 'append'

  try {
    const result = await fetchRecentProjects(page, pageSize, controller.signal)
    if (!controller.signal.aborted) {
      const nextProjects = page === 1
        ? result.projects
        : Array.from(new Map([...projects.value, ...result.projects].map((item) => [item.id, item])).values())
      projects.value = nextProjects
      currentPage.value = result.page
      total.value = result.total
      hasMore.value = result.projects.length > 0 && nextProjects.length < result.total
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      errorMessage.value = error instanceof Error ? error.message : '近期项目加载失败'
    }
  } finally {
    if (activeRequest === controller) {
      activeRequest = null
      isLoading.value = false
      loadingMode.value = ''
    }
  }
}

const loadNextPage = () => {
  if (isLoading.value || !hasMore.value) {
    return
  }

  void loadProjects(currentPage.value + 1)
}

const handleProjectsScroll = (event: Event) => {
  const element = event.currentTarget as HTMLElement
  if (element.scrollHeight - element.scrollTop - element.clientHeight <= 32) {
    loadNextPage()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      void loadProjects(1)
      return
    }

    activeRequest?.abort()
    activeRequest = null
    isLoading.value = false
    loadingMode.value = ''
  },
)

onBeforeUnmount(() => activeRequest?.abort())
</script>

<style scoped lang="less">
.recent-projects-content { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.recent-projects-list { display: grid; flex: 1; gap: 12px; min-height: 0; overflow-y: auto; padding: 2px 2px 4px; scrollbar-gutter: stable; }
.recent-project-card { position: relative; display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 7px 3px; min-height: 128px; padding: 14px 10px 11px; border: 1px solid #dfe2e7; border-radius: 8px; background: #fff; box-shadow: 0 2px 5px rgba(50, 59, 75, .045); }
.recent-project-card__dot { width: 5px; height: 5px; margin-top: 5px; border-radius: 50%; background: #ff3041; }
.recent-project-card__main { display: grid; grid-template-columns: minmax(0, 1fr) 96px; align-items: start; gap: 7px; padding-right: 70px; }
.recent-project-card__main :deep(.ant-tooltip-open) { display: block; min-width: 0; }
.recent-project-card__main strong { display: block; overflow: hidden; color: #111419; font-size: 13px; font-weight: 700; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.recent-project-card__main time { display: block; width: 96px; overflow: hidden; color: #aeb5bf; font-size: 11px; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.recent-project-card__meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 5px 6px; min-width: 0; }
.recent-project-card__meta :deep(.ant-tooltip-open) { display: inline-block; max-width: 100%; min-width: 0; }
.recent-project-card__meta span { display: block; max-width: 100%; overflow: hidden; padding: 1px 8px; border: 1px solid #e0e5ed; border-radius: 4px; color: #687386; font-size: 10px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.recent-project-card__meta .recent-project-card__type { border-color: #d8dff9; background: #f5f7ff; color: #5d71cc; }
.recent-project-card__meta .recent-project-card__stage { border-color: #8ed7ff; background: #effaff; color: #32a6ef; }
.recent-project-card__badge { position: absolute; top: -1px; right: -1px; padding: 5px 8px; border-radius: 4px 4px 0 4px; background: #2699f2; color: #fff; font-size: 11px; line-height: 15px; }
.recent-project-card__badge.is-urgent { background: #ff5b2d; }
.recent-project-card__actions { grid-column: 2; display: flex; gap: 5px; min-width: 0; overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
.recent-project-card__actions::-webkit-scrollbar { display: none; }
.recent-project-card__actions button { flex: none; display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border: 0; border-radius: 4px; background: #f5f6fa; color: #404752; font-size: 11px; cursor: pointer; }
.recent-project-card__actions button :deep(.anticon) { color: #637dff; font-size: 14px; }
.recent-projects-list__status { display: flex; min-height: 28px; align-items: center; justify-content: center; color: #8b929d; font-size: 11px; text-align: center; }
.recent-projects-state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #8b929d; font-size: 12px; text-align: center; }
.recent-projects-state.is-error { flex-direction: column; gap: 10px; color: #d05b48; }
.recent-projects-state button { padding: 5px 12px; border: 1px solid #cbd9ef; border-radius: 6px; background: #fff; color: #4384e8; cursor: pointer; }
.recent-projects-loading-mask { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(255, 255, 255, .72); color: #8b929d; font-size: 12px; text-align: center; }
</style>
