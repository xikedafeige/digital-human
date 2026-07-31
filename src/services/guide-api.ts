// 智能引导接口客户端，集中管理联调地址、请求头和响应数据规范化。
import type {
  GuideCooperationItem,
  GuideDisambiguationCandidate,
  GuideProjectCard,
  GuideProjectContext,
  GuideProjectStage,
} from '@/types/avatar-types'

export type { GuideProjectCard } from '@/types/avatar-types'

const GUIDE_API_BASE_URL = 'http://172.16.7.53:8300'
const GUIDE_API_PREFIX = '/api/v1/guide'
const GUIDE_KNOWLEDGE_FILE_BASE_URL = 'http://172.16.7.54:9000'
const GUIDE_USER_ID = '1696097681761374208'
const GUIDE_REQUEST_ID = ''

// 联调阶段由后端要求固定身份 Header；所有智能引导请求统一复用，不扩散到其他服务。
const GUIDE_HEADERS: Record<string, string> = {
  token: 'd3827b17-0a24-44ea-bcde-43c69400b6a0',
  tenantid: '1',
  uapaccesstoken:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJXRUIiLCJuYmYiOjE3ODU0OTI5MjgsImRhdGEiOiJ7XCJkZXBhcnRtZW50SWRcIjoxNjYxNjM0MDUzMjM4OTUxOTM2LFwiZGVwYXJ0bWVudE5hbWVcIjpcIuWNj-S9nOWNleS9jVwiLFwiZW1haWxcIjpcIjE1MzA5MDU0NjUyQHFxLmNvbVwiLFwiZmlybUNvZGVcIjpcIjMxMjkxM1wiLFwiZmlybUlkXCI6MTcyOTgwMDc5MDc0MDA0NTgyNCxcImZpcm1OYW1lXCI6XCLlm5vlt53otKLnu4_ogYzkuJrlrabpmaJcIixcImdlbmRlclwiOjEsXCJpZFwiOjE2ODM2NjQ0NTY5OTY4ODQ0ODAsXCJtZXRhZGF0YVwiOnt9LFwicG9zaXRpb25JZHNcIjpcIjZcIixcInBvc2l0aW9uTmFtZXNcIjpcIueJuVwiLFwicmFua3NcIjpcIjIwN1wiLFwicmVhbE5hbWVcIjpcIuW8oOS4ieaWsFwiLFwic3RhdGVcIjoxLFwic3lzdGVtVHlwZVwiOjEsXCJ1c2VyTmFtZVwiOlwiemhhbmdzYW5cIixcInVzZXJUeXBlXCI6XCIxXCJ9IiwiaXNzIjoiVUFQX0FVVEgwIiwiZXhwIjoxNzg1NTI4OTI4LCJpYXQiOjE3ODU0OTI5MjgsImp0aSI6IjYzOWYwYzFmLWYwYmYtNDcwZS1hYjkwLTllZDE5ZjBkM2QxYSJ9.ggpTufvweXTwtTYOwxdvTXVVIfD3z_3Exg7_EpKyE2fvaG8S0cRdnIrr9eKVJdeJL1jnu-gO8dRULlvMvsQX7t5AmRVOvZE_8l1aDlmTpgxrKIzzOJOZPe2D3UMXMYtksk1xmDFIZnVDzxBHNLDYWyy6tf6XLRT8mFbbqlDuPMU',
  uaprefreshtoken: '6a0570f3-319d-4c13-989e-41ce1d5fd537',
}

interface GuideResponse<T> {
  code: number
  message?: string
  data: T | null
}

interface GuideProjectPayload {
  todoId?: unknown
  todo_id?: unknown
  type?: unknown
  title?: unknown
  projectName?: unknown
  project_name?: unknown
  commissionTaskId?: unknown
  commission_task_id?: unknown
  taskType?: unknown
  task_type?: unknown
  taskTypeName?: unknown
  task_type_name?: unknown
  currentStage?: unknown
  current_stage?: unknown
  currentStageName?: unknown
  current_stage_name?: unknown
  deadline?: unknown
  startDate?: unknown
  start_date?: unknown
  status?: unknown
  statusText?: unknown
  status_text?: unknown
  durationDesc?: unknown
  duration_desc?: unknown
  cardActions?: unknown
  bpmTaskId?: unknown
  bpm_task_id?: unknown
  id?: unknown
  businessKey?: unknown
  business_key?: unknown
  flowName?: unknown
  flow_name?: unknown
  name?: unknown
  todoCategory?: unknown
  todo_category?: unknown
  initiatorName?: unknown
  initiator_name?: unknown
  createTime?: unknown
  create_time?: unknown
  initiateTime?: unknown
  initiate_time?: unknown
  urgencyLevel?: unknown
  urgency_level?: unknown
  chargePersonName?: unknown
  charge_person_name?: unknown
  metrics?: unknown
  subtaskCount?: unknown
  subtask_count?: unknown
  subtasks?: unknown
  pointCount?: unknown
  point_count?: unknown
  points?: unknown
  scope?: unknown
  dimension?: unknown
  dimensionName?: unknown
  dimension_name?: unknown
  formUrl?: unknown
  form_url?: unknown
  businessPattern?: unknown
  business_pattern?: unknown
  [key: string]: unknown
}

interface GuideProjectListPayload {
  projects?: GuideProjectPayload[] | Record<string, GuideProjectPayload[]>
  total?: unknown
  page?: unknown
  rows?: unknown
}

interface GuideQueryProjectsPayload {
  projects?: GuideProjectPayload[] | Record<string, GuideProjectPayload[]>
  total?: unknown
  shown?: unknown
  metricLoaded?: unknown
  metric_loaded?: unknown
  scope?: unknown
  taskTypes?: unknown
  task_types?: unknown
  keywords?: unknown
  dimension?: unknown
  dimensionName?: unknown
  dimension_name?: unknown
  message?: unknown
}

export interface GuideTodoProjectGroups {
  all: GuideProjectCard[]
  groups: Record<string, GuideProjectCard[]>
  total: number
}

export interface GuideRecentProjectsPage {
  projects: GuideProjectCard[]
  total: number
  page: number
  rows: number
}

export interface GuideQueryProjectsPage {
  projects: GuideProjectCard[]
  total: number
  shown: number
  metricLoaded: number
  scope: string
  taskTypes: string[]
  keywords: string[]
  dimension: string
  dimensionName: string
  message?: string
}

export interface GuideConversationSummary {
  id: string
  conversationType: string
  title: string
  messageCount: number
  lastMessagePreview: string
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  commissionTaskId: string
  taskType: number | null
  stage: string
}

export interface GuideConversationMessage {
  id: string
  sequence: number | null
  role: 'USER' | 'ASSISTANT' | string
  content: string
  createdAt: string
  messageStatus: string
  answerSource: string
}

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }

    if (typeof value === 'bigint') {
      return String(value)
    }
  }

  return ''
}

const pickNumber = (...values: unknown[]) => {
  const value = values.find(
    (candidate) =>
      typeof candidate === 'number' ||
      (typeof candidate === 'string' && candidate.trim().length > 0),
  )
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const pickRecordArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const pickRecordObjects = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : []

const ACTION_LABELS: Record<string, string> = {
  qa: '提问',
  query: '问数',
  report: '写报告',
  review: '审核',
}

const DEFAULT_TODO_ACTIONS = ['提问', '写报告', '审核', '问数']
const DEFAULT_QUERY_ACTIONS = ['提问', '问数']

const TODO_STAGE_MAP: Record<string, GuideProjectStage> = {
  绩效目标申报: 'target_declaration',
  绩效目标: 'target_declaration',
  事前: 'pre_evaluation',
  事中: 'mid_monitoring',
  事后: 'post_evaluation',
}

const TASK_TYPE_STAGE_MAP: Record<number, GuideProjectStage> = {
  3: 'target_declaration',
  1: 'pre_evaluation',
  5: 'mid_monitoring',
  2: 'post_evaluation',
}

const resolveProjectStage = (
  taskType: number | null,
  category: string,
): GuideProjectStage | '' =>
  TODO_STAGE_MAP[category] ??
  (taskType === null ? '' : (TASK_TYPE_STAGE_MAP[taskType] ?? ''))

const normalizeProject = (
  raw: GuideProjectPayload,
  source: GuideProjectCard['source'],
  index: number,
  actionsOverride?: string[],
): GuideProjectCard => {
  const taskType = pickNumber(raw.taskType, raw.task_type)
  const category = pickString(
    raw.todoCategory,
    raw.todo_category,
    raw.taskTypeName,
    raw.task_type_name,
  )
  const stage = resolveProjectStage(taskType, category)
  const stageName =
    category || pickString(raw.currentStageName, raw.current_stage_name)
  const urgencyLevel = pickNumber(raw.urgencyLevel, raw.urgency_level)
  const statusText =
    source === 'todo'
      ? urgencyLevel !== null && urgencyLevel >= 4
        ? '紧急'
        : '普通'
      : pickString(raw.statusText, raw.status_text, raw.status, '进行中')
  const rawActions = pickRecordArray(raw.cardActions)
  const actions = actionsOverride?.length
    ? actionsOverride
    : rawActions.length
      ? rawActions
          .map((action) => ACTION_LABELS[action] ?? action)
          .filter(Boolean)
      : source === 'query'
        ? DEFAULT_QUERY_ACTIONS
        : DEFAULT_TODO_ACTIONS
  const projectName = pickString(
    raw.projectName,
    raw.project_name,
    raw.flowName,
    raw.flow_name,
    raw.title,
    `未知任务 ${index + 1}`,
  )
  const title = pickString(raw.title, raw.flowName, raw.flow_name, projectName)
  const commissionTaskId = pickString(
    raw.commissionTaskId,
    raw.commission_task_id,
    raw.businessKey,
    raw.business_key,
  )
  const id = pickString(
    raw.todoId,
    raw.todo_id,
    raw.bpmTaskId,
    raw.bpm_task_id,
    raw.id,
    commissionTaskId,
    `${source}-${index}`,
  )
  const todoId = pickString(
    raw.todoId,
    raw.todo_id,
    raw.id,
    raw.bpmTaskId,
    raw.bpm_task_id,
    id,
  )
  const currentStageName = pickString(
    raw.currentStageName,
    raw.current_stage_name,
    raw.name,
    raw.processDefinitionName,
    raw.process_definition_name,
    raw.taskTypeName,
    raw.task_type_name,
  )
  const durationDesc = pickString(raw.durationDesc, raw.duration_desc)
  const createTime = pickString(
    raw.createTime,
    raw.create_time,
    raw.initiateTime,
    raw.initiate_time,
    raw.startDate,
    raw.start_date,
  )
  const metrics = pickRecordObjects(raw.metrics)
    .map((item) => ({
      label: pickString(item.label),
      value: pickString(item.value),
    }))
    .filter((item) => item.label || item.value)
  const subtasks = pickRecordObjects(raw.subtasks)
    .map((item) => ({
      name: pickString(item.name),
      statusText: pickString(item.statusText, item.status_text, '进行中'),
      pointName: pickString(item.pointName, item.point_name),
      score: pickString(item.score),
    }))
    .filter(
      (item) => item.name || item.statusText || item.pointName || item.score,
    )
  const points = pickRecordObjects(raw.points)
    .map((item) => ({
      name: pickString(item.name),
      statusText: pickString(item.statusText, item.status_text, '进行中'),
    }))
    .filter((item) => item.name || item.statusText)

  return {
    id,
    todoId,
    title,
    projectName,
    taskType,
    taskTypeName: stageName,
    todoCategory: category,
    currentStageName,
    time: durationDesc || createTime || pickString(raw.deadline),
    deadline: pickString(raw.deadline),
    initiatorName: pickString(
      raw.initiatorName,
      raw.initiator_name,
      raw.startUserName,
      raw.chargePersonName,
      raw.charge_person_name,
    ),
    createTime,
    durationDesc,
    statusText,
    actions,
    isUrgent:
      source === 'todo'
        ? urgencyLevel !== null && urgencyLevel >= 4
        : /紧急|逾期|urgent|overdue/i.test(statusText),
    source,
    commissionTaskId,
    stage,
    stageName,
    chargePersonName: pickString(
      raw.chargePersonName,
      raw.charge_person_name,
      raw.initiatorName,
      raw.initiator_name,
    ),
    metrics: metrics.length ? metrics : undefined,
    subtaskCount: pickNumber(raw.subtaskCount, raw.subtask_count),
    subtasks: subtasks.length ? subtasks : undefined,
    pointCount: pickNumber(raw.pointCount, raw.point_count),
    points: points.length ? points : undefined,
    scope: pickString(raw.scope),
    dimension: pickString(raw.dimension),
    dimensionName: pickString(raw.dimensionName, raw.dimension_name),
    raw,
  }
}

const requestGuide = async <T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<T | null> => {
  const response = await fetch(
    `${GUIDE_API_BASE_URL}${GUIDE_API_PREFIX}${path}`,
    {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.method === 'POST'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...GUIDE_HEADERS,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    },
  )

  const payload = (await response
    .json()
    .catch(() => null)) as GuideResponse<T> | null

  if (!response.ok) {
    throw new Error(
      payload?.message || `智能引导接口请求失败（HTTP ${response.status}）`,
    )
  }

  if (!payload || payload.code !== 0) {
    throw new Error(payload?.message || '智能引导接口返回异常')
  }

  return payload.data
}

export const fetchRecentProjects = async (
  page = 1,
  rows = 200,
  signal?: AbortSignal,
): Promise<GuideRecentProjectsPage> => {
  const payload = await requestGuide<GuideProjectListPayload>(
    `/projects/recent?page=${encodeURIComponent(String(page))}&rows=${encodeURIComponent(String(rows))}`,
    { signal },
  )
  const projects = Array.isArray(payload?.projects) ? payload.projects : []
  const normalizedProjects = projects.map((project, index) =>
    normalizeProject(project, 'recent', index),
  )

  return {
    projects: normalizedProjects,
    total: pickNumber(payload?.total) ?? normalizedProjects.length,
    page: pickNumber(payload?.page) ?? page,
    rows: pickNumber(payload?.rows) ?? rows,
  }
}

export const fetchQueryProjects = async (
  query: string,
  signal?: AbortSignal,
  projectIds: string[] = [],
): Promise<GuideQueryProjectsPage> => {
  const payload = await requestGuide<GuideQueryProjectsPayload>(
    '/query/projects',
    {
      method: 'POST',
      body: {
        query,
        project_ids: projectIds,
        user_id: GUIDE_USER_ID,
      },
      signal,
    },
  )
  const rawProjects = payload?.projects
  const projectList = Array.isArray(rawProjects)
    ? rawProjects
    : rawProjects && typeof rawProjects === 'object'
      ? Object.values(rawProjects).flatMap((projects) =>
          Array.isArray(projects) ? projects : [],
        )
      : []
  const scope = pickString(payload?.scope)
  const dimension = pickString(payload?.dimension)
  const dimensionName = pickString(
    payload?.dimensionName,
    payload?.dimension_name,
  )
  const projects = projectList.map((project, index) => ({
    ...normalizeProject(project, 'query', index, DEFAULT_QUERY_ACTIONS),
    scope,
    dimension,
    dimensionName,
  }))
  const taskTypes = pickRecordArray(payload?.taskTypes).length
    ? pickRecordArray(payload?.taskTypes)
    : pickRecordArray(payload?.task_types)

  return {
    projects,
    total: pickNumber(payload?.total) ?? projects.length,
    shown: pickNumber(payload?.shown) ?? projects.length,
    metricLoaded:
      pickNumber(payload?.metricLoaded, payload?.metric_loaded) ??
      projects.filter((project) => project.metrics?.length).length,
    scope,
    taskTypes,
    keywords: pickRecordArray(payload?.keywords),
    dimension,
    dimensionName,
    message: pickString(payload?.message),
  }
}

export const fetchTodoProjects = async (signal?: AbortSignal) => {
  const payload = await requestGuide<GuideProjectListPayload>(
    '/projects/todos?page=1&rows=20',
    { signal },
  )
  const rawProjects = payload?.projects
  const groups: Record<string, GuideProjectCard[]> = {}

  if (Array.isArray(rawProjects)) {
    groups['全部'] = rawProjects.map((project, index) =>
      normalizeProject(project, 'todo', index),
    )
  } else if (rawProjects && typeof rawProjects === 'object') {
    Object.entries(rawProjects).forEach(([category, projects]) => {
      groups[category] = projects.map((project, index) =>
        normalizeProject(project, 'todo', index),
      )
    })
  }

  const all =
    groups['全部'] ??
    Object.entries(groups)
      .filter(([category]) => category !== '全部')
      .flatMap(([, projects]) => projects)
  const dedupedAll = Array.from(
    new Map(all.map((project) => [project.id, project])).values(),
  )

  return {
    all: dedupedAll,
    groups,
    total: Number(payload?.total) || dedupedAll.length,
  } satisfies GuideTodoProjectGroups
}

export interface GuideSearchRoute {
  id: string
  title: string
  url: string
  params: Record<string, unknown>
}

export interface GuideSearchResult {
  intent: string
  subIntent: string
  confidence: number | null
  description: string
  action: string
  conversationId: string
  guideStage: string
  route: GuideSearchRoute | null
  candidates: GuideDisambiguationCandidate[]
  cooperationItems: GuideCooperationItem[]
}

export interface GuideStreamResult {
  answer: string
  conversationId: string
  requestId: string
  source: string
  suggestions: string[]
}

export interface GuideQaStreamResult extends GuideStreamResult {}

export interface GuideProjectStreamResult extends GuideStreamResult {
  stage: string
  stageName: string
  commissionTaskId: string
}

interface GuideStreamHandlers {
  onText?: (answer: string, chunk: string) => void
  onConversationId?: (conversationId: string) => void
  onSuggestions?: (suggestions: string[]) => void
}

interface GuideSsePayload {
  conversation_id?: unknown
  conversationId?: unknown
  request_id?: unknown
  requestId?: unknown
  content?: unknown
  answer?: unknown
  source?: unknown
  suggestions?: unknown
  message?: unknown
  data?: Record<string, unknown> | null
}

const normalizeSearchResult = (
  raw: Record<string, unknown>,
): GuideSearchResult => {
  const rawRoute =
    raw.route && typeof raw.route === 'object'
      ? (raw.route as Record<string, unknown>)
      : null
  const rawParams =
    rawRoute?.params && typeof rawRoute.params === 'object'
      ? (rawRoute.params as Record<string, unknown>)
      : {}
  const candidates = Array.isArray(raw.candidates)
    ? raw.candidates
        .filter(
          (candidate): candidate is Record<string, unknown> =>
            Boolean(candidate) && typeof candidate === 'object',
        )
        .map((candidate, index) => {
          return {
            id: pickString(
              candidate.id,
              candidate.route_id,
              candidate.routeId,
              candidate.keyword,
              candidate.sub_intent,
              candidate.subIntent,
              candidate.label,
              index,
            ),
            label: pickString(candidate.label, candidate.name, candidate.title),
            intent: pickString(candidate.intent),
            subIntent: pickString(candidate.sub_intent, candidate.subIntent),
            routeId: pickString(candidate.route_id, candidate.routeId),
            keyword: pickString(candidate.keyword),
          }
        })
        .filter((candidate) => candidate.label)
    : []
  const cooperationItems = pickRecordObjects(raw.items)
    .map((item) => {
      const metadata =
        item.metadata && typeof item.metadata === 'object'
          ? (item.metadata as Record<string, unknown>)
          : {}

      return {
        title: pickString(item.title, metadata.title),
        content: pickString(item.content),
        score: pickNumber(item.score, metadata.score),
        downloadUrl: pickCooperationDownloadUrl(item, metadata),
        metadata,
      }
    })
    .filter((item) => item.title || item.content)

  return {
    intent: pickString(raw.intent),
    subIntent: pickString(raw.sub_intent, raw.subIntent),
    confidence: pickNumber(raw.confidence),
    description: pickString(raw.description),
    action: pickString(raw.action),
    conversationId: pickString(raw.conversation_id, raw.conversationId),
    guideStage: pickString(raw.guide_stage, raw.guideStage),
    route: rawRoute
      ? {
          id: pickString(rawRoute.id),
          title: pickString(rawRoute.title),
          url: pickString(rawRoute.url),
          params: rawParams,
        }
      : null,
    candidates,
    cooperationItems,
  }
}

export const searchGuide = async (
  query: string,
  conversationId = '',
  signal?: AbortSignal,
  selectedCandidate?: GuideDisambiguationCandidate,
) => {
  const payload = await requestGuide<Record<string, unknown>>('/search', {
    method: 'POST',
    body: {
      query,
      user_id: GUIDE_USER_ID,
      request_id: GUIDE_REQUEST_ID,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(selectedCandidate?.intent
        ? { chosen_intent: selectedCandidate.intent }
        : {}),
      ...(selectedCandidate?.subIntent
        ? { chosen_sub_intent: selectedCandidate.subIntent }
        : {}),
      ...(selectedCandidate?.routeId
        ? { chosen_route_id: selectedCandidate.routeId }
        : {}),
      ...(selectedCandidate?.keyword
        ? { chosen_keyword: selectedCandidate.keyword }
        : {}),
    },
    signal,
  })

  return normalizeSearchResult(payload ?? {})
}

const extractSseEvents = (buffer: string) => {
  const chunks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const pendingBuffer = chunks.pop() ?? ''

  return {
    events: chunks
      .map((chunk) => {
        let event = 'message'
        const dataLines: string[] = []

        chunk.split('\n').forEach((line) => {
          if (line.startsWith('event:')) {
            event = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        })

        return {
          event,
          data: dataLines.join('\n').trim(),
        }
      })
      .filter((item) => item.data),
    pendingBuffer,
  }
}

const parseSsePayload = (rawData: string) => {
  if (!rawData || rawData === '[DONE]') {
    return null
  }

  try {
    return JSON.parse(rawData) as GuideSsePayload
  } catch {
    return null
  }
}

const pickSseString = (payload: GuideSsePayload, ...keys: string[]) => {
  const nested = payload.data ?? {}
  return pickString(
    ...keys.flatMap((key) => [
      payload[key as keyof GuideSsePayload],
      nested[key],
    ]),
  )
}

const pickSseSuggestions = (payload: GuideSsePayload) => {
  const nested = payload.data ?? {}
  return pickRecordArray(payload.suggestions ?? nested.suggestions)
}

const buildGuideDownloadUrl = (value: string) => {
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value, GUIDE_KNOWLEDGE_FILE_BASE_URL)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
  } catch {
    return ''
  }

  return ''
}

const pickCooperationDownloadUrl = (
  item: Record<string, unknown>,
  metadata: Record<string, unknown>,
) =>
  buildGuideDownloadUrl(
    pickString(
      item.downloadUrl,
      item.download_url,
      item.fileUrl,
      item.file_url,
      item.url,
      item.path,
      metadata.downloadUrl,
      metadata.download_url,
      metadata.fileUrl,
      metadata.file_url,
      metadata.url,
      metadata.path,
    ),
  )

const streamGuideReply = async (
  path: string,
  body: Record<string, unknown>,
  conversationId = '',
  handlers: GuideStreamHandlers = {},
  signal?: AbortSignal,
): Promise<GuideStreamResult> => {
  const response = await fetch(
    `${GUIDE_API_BASE_URL}${GUIDE_API_PREFIX}${path}`,
    {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...GUIDE_HEADERS,
      },
      body: JSON.stringify({
        ...body,
        user_id: GUIDE_USER_ID,
        request_id: GUIDE_REQUEST_ID,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
      signal,
    },
  )

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(
      responseText || `智能引导问答请求失败（HTTP ${response.status}）`,
    )
  }

  if (!response.body) {
    throw new Error('智能引导问答未返回流式内容')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''
  let latestConversationId = conversationId
  let requestId = ''
  let source = ''
  let suggestions: string[] = []

  const applyEvent = (event: string, rawData: string) => {
    const payload = parseSsePayload(rawData)
    if (!payload) {
      return
    }

    const nextConversationId = pickSseString(
      payload,
      'conversation_id',
      'conversationId',
    )
    if (nextConversationId) {
      latestConversationId = nextConversationId
      handlers.onConversationId?.(nextConversationId)
    }

    const nextSuggestions = pickSseSuggestions(payload)
    if (nextSuggestions.length) {
      suggestions = nextSuggestions
      handlers.onSuggestions?.(nextSuggestions)
    }

    if (event === 'error') {
      throw new Error(
        pickSseString(payload, 'message') || '智能引导问答返回异常',
      )
    }

    if (event === 'delta') {
      const chunk = pickSseString(payload, 'content')
      if (chunk) {
        answer += chunk
        handlers.onText?.(answer, chunk)
      }
      return
    }

    if (event === 'done') {
      const finalAnswer = pickSseString(payload, 'answer')
      if (finalAnswer && finalAnswer !== answer) {
        answer = finalAnswer
        handlers.onText?.(answer, finalAnswer)
      }
      requestId = pickSseString(payload, 'request_id', 'requestId') || requestId
      source = pickSseString(payload, 'source') || source
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const parsed = extractSseEvents(buffer)
    buffer = parsed.pendingBuffer
    parsed.events.forEach(({ event, data }) => applyEvent(event, data))
  }

  buffer += decoder.decode()
  extractSseEvents(`${buffer}\n\n`).events.forEach(({ event, data }) =>
    applyEvent(event, data),
  )

  if (!answer.trim()) {
    throw new Error('智能引导问答返回内容为空')
  }

  return {
    answer,
    conversationId: latestConversationId,
    requestId,
    source,
    suggestions,
  }
}

export const streamGuideQa = (
  query: string,
  conversationId = '',
  handlers: GuideStreamHandlers = {},
  signal?: AbortSignal,
) => streamGuideReply('/qa/stream', { query }, conversationId, handlers, signal)

export const streamGuideProject = async (
  context: GuideProjectContext,
  query: string,
  conversationId = '',
  handlers: GuideStreamHandlers = {},
  signal?: AbortSignal,
) => {
  const result = await streamGuideReply(
    '/assistant/project/stream',
    {
      stage: context.stage,
      commission_task_id: context.commissionTaskId,
      project_name: context.projectName,
      query,
    },
    conversationId,
    handlers,
    signal,
  )
  return {
    ...result,
    stage: context.stage,
    stageName: context.stageName,
    commissionTaskId: context.commissionTaskId,
  } satisfies GuideProjectStreamResult
}

interface GuideConversationListPayload {
  conversations?: Array<Record<string, unknown>>
}

interface GuideConversationMessagesPayload {
  messages?: Array<Record<string, unknown>>
}

const normalizeConversation = (
  raw: Record<string, unknown>,
): GuideConversationSummary => ({
  id: pickString(raw.id),
  conversationType: pickString(raw.conversationType, raw.conversation_type),
  title: pickString(raw.title, '未命名会话'),
  messageCount: pickNumber(raw.messageCount, raw.message_count) ?? 0,
  lastMessagePreview: pickString(
    raw.lastMessagePreview,
    raw.last_message_preview,
  ),
  lastMessageAt: pickString(raw.lastMessageAt, raw.last_message_at),
  createdAt: pickString(raw.createdAt, raw.created_at),
  updatedAt: pickString(raw.updatedAt, raw.updated_at),
  commissionTaskId: pickString(raw.commissionTaskId, raw.commission_task_id),
  taskType: pickNumber(raw.taskType, raw.task_type),
  stage: pickString(raw.stage),
})

const normalizeConversationMessage = (
  raw: Record<string, unknown>,
): GuideConversationMessage => ({
  id: pickString(raw.id, raw.seqNo, raw.seq_no),
  sequence: pickNumber(raw.seqNo, raw.seq_no, raw.turnNo, raw.turn_no),
  role: pickString(raw.role),
  content: pickString(raw.content),
  createdAt: pickString(raw.createdAt, raw.created_at),
  messageStatus: pickString(raw.messageStatus, raw.message_status),
  answerSource: pickString(raw.answerSource, raw.answer_source),
})

export const fetchGuideConversations = async (signal?: AbortSignal) => {
  const payload = await requestGuide<GuideConversationListPayload>(
    `/assistant/conversations?user_id=${encodeURIComponent(GUIDE_USER_ID)}&conversation_type=&limit=50`,
    { signal },
  )
  return (payload?.conversations ?? [])
    .map(normalizeConversation)
    .filter((item) => item.id)
}

export const fetchGuideConversationMessages = async (
  conversationId: string,
  signal?: AbortSignal,
) => {
  const payload = await requestGuide<GuideConversationMessagesPayload>(
    `/assistant/conversation/${encodeURIComponent(conversationId)}/messages?user_id=${encodeURIComponent(GUIDE_USER_ID)}`,
    { signal },
  )
  return (payload?.messages ?? [])
    .map(normalizeConversationMessage)
    .filter((item) => item.content)
    .sort((left, right) => {
      if (left.sequence === null || right.sequence === null) {
        return 0
      }

      return left.sequence - right.sequence
    })
}
