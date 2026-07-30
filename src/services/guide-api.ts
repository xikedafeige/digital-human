// 智能引导接口客户端，集中管理联调地址、请求头和响应数据规范化。
import type {
  GuideProjectContext,
  GuideProjectStage,
} from '@/types/avatar-types'

const GUIDE_API_BASE_URL = 'http://ffa56a44.natappfree.cc'
const GUIDE_API_PREFIX = '/api/v1/guide'
const GUIDE_USER_ID = '1696097681761374208'
const GUIDE_REQUEST_ID = ''

// 联调阶段由后端要求固定身份 Header；所有智能引导请求统一复用，不扩散到其他服务。
const GUIDE_HEADERS: Record<string, string> = {
  uapaccesstoken:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJXRUIiLCJuYmYiOjE3ODUzNzM2ODAsImRhdGEiOiJ7XCJkZXBhcnRtZW50SWRcIjoxNjYxNjM0MDUzMjM4OTUxOTM2LFwiZGVwYXJ0bWVudE5hbWVcIjpcIuWNj-S9nOWNleS9jVwiLFwiZW1haWxcIjpcIjE1MzA5MDU0NjUyQHFxLmNvbVwiLFwiZmlybUNvZGVcIjpcIjMxMjkxM1wiLFwiZmlybUlkXCI6MTcyOTgwMDc5MDc0MDA0NTgyNCxcImZpcm1OYW1lXCI6XCLlm5vlt53otKLnu4_ogYzkuJrlrabpmaJcIixcImdlbmRlclwiOjEsXCJpZFwiOjE2ODM2NjQ0NTY5OTY4ODQ0ODAsXCJtZXRhZGF0YVwiOnt9LFwicG9zaXRpb25JZHNcIjpcIjZcIixcInBvc2l0aW9uTmFtZXNcIjpcIueJuVwiLFwicmFua3NcIjpcIjIwN1wiLFwicmVhbE5hbWVcIjpcIuW8oOS4ieaWsFwiLFwic3RhdGVcIjoxLFwic3lzdGVtVHlwZVwiOjEsXCJ1c2VyTmFtZVwiOlwiemhhbmdzYW5cIixcInVzZXJUeXBlXCI6XCIxXCJ9IiwiaXNzIjoiVUFQX0FVVEgwIiwiZXhwIjoxNzg1NDA5NjgwLCJpYXQiOjE3ODUzNzM2ODAsImp0aSI6ImJmNmFjZDkwLTI0M2UtNDVhYy1iYjY0LWExMTRhY2NhZDdjNyJ9.MNHBaFN6jw6PvEm9qIHOBeoV3uj3SeQzxP9t-hN5ar2qe1SiU7myNIQ67zCzW25j6MOkJoqozfqzf14avNlfsRVqctUqY2n2LvBsFvXoL28sahtBcYcb3wpRNBF3KPdY242KiMssdB81ROePPePhHgyS6TvYJYNwvpFiK9WlutM',
  uaprefreshtoken: 'a103d7bc-faa0-458b-a31f-e8845e74842a',
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

export interface GuideProjectCard {
  id: string
  todoId: string
  title: string
  projectName: string
  taskType: number | null
  taskTypeName: string
  todoCategory: string
  currentStageName: string
  time: string
  deadline: string
  initiatorName: string
  createTime: string
  durationDesc: string
  statusText: string
  actions: string[]
  isUrgent: boolean
  source: 'recent' | 'todo'
  commissionTaskId: string
  stage: GuideProjectStage | ''
  stageName: string
  raw: GuideProjectPayload
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
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const ACTION_LABELS: Record<string, string> = {
  qa: '提问',
  query: '问数',
  report: '写报告',
  review: '审核',
}

const DEFAULT_TODO_ACTIONS = ['提问', '写报告', '审核', '问数']

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
  (taskType === null ? '' : TASK_TYPE_STAGE_MAP[taskType] ?? '')

const normalizeProject = (
  raw: GuideProjectPayload,
  source: GuideProjectCard['source'],
  index: number,
): GuideProjectCard => {
  const taskType = pickNumber(raw.taskType, raw.task_type)
  const category = pickString(
    raw.todoCategory,
    raw.todo_category,
    raw.taskTypeName,
    raw.task_type_name,
  )
  const stage = resolveProjectStage(taskType, category)
  const stageName = category || pickString(raw.currentStageName, raw.current_stage_name)
  const urgencyLevel = pickNumber(raw.urgencyLevel, raw.urgency_level)
  const statusText =
    source === 'todo'
      ? urgencyLevel !== null && urgencyLevel >= 4
        ? '紧急'
        : '普通'
      : pickString(raw.statusText, raw.status_text, raw.status, '进行中')
  const rawActions = pickRecordArray(raw.cardActions)
  const actions = rawActions.length
    ? rawActions.map((action) => ACTION_LABELS[action] ?? action).filter(Boolean)
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
  const todoId = pickString(raw.todoId, raw.todo_id, raw.id, raw.bpmTaskId, raw.bpm_task_id, id)
  const currentStageName = pickString(
    raw.currentStageName,
    raw.current_stage_name,
    raw.name,
    raw.processDefinitionName,
    raw.process_definition_name,
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
    initiatorName: pickString(raw.initiatorName, raw.initiator_name, raw.startUserName),
    createTime,
    durationDesc,
    statusText,
    actions,
    isUrgent: source === 'todo'
      ? urgencyLevel !== null && urgencyLevel >= 4
      : /紧急|逾期|urgent|overdue/i.test(statusText),
    source,
    commissionTaskId,
    stage,
    stageName,
    raw,
  }
}

const requestGuide = async <T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T | null> => {
  const response = await fetch(`${GUIDE_API_BASE_URL}${GUIDE_API_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...GUIDE_HEADERS,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  const payload = (await response.json().catch(() => null)) as GuideResponse<T> | null

  if (!response.ok) {
    throw new Error(payload?.message || `智能引导接口请求失败（HTTP ${response.status}）`)
  }

  if (!payload || payload.code !== 0) {
    throw new Error(payload?.message || '智能引导接口返回异常')
  }

  return payload.data
}

export const fetchRecentProjects = async (
  page = 1,
  rows = 6,
  signal?: AbortSignal,
): Promise<GuideRecentProjectsPage> => {
  const payload = await requestGuide<GuideProjectListPayload>(
    `/projects/recent?page=${encodeURIComponent(String(page))}&rows=${encodeURIComponent(String(rows))}`,
    { signal },
  )
  const projects = Array.isArray(payload?.projects) ? payload.projects : []
  const normalizedProjects = projects.map((project, index) => normalizeProject(project, 'recent', index))

  return {
    projects: normalizedProjects,
    total: pickNumber(payload?.total) ?? normalizedProjects.length,
    page: pickNumber(payload?.page) ?? page,
    rows: pickNumber(payload?.rows) ?? rows,
  }
}

export const fetchTodoProjects = async (signal?: AbortSignal) => {
  const payload = await requestGuide<GuideProjectListPayload>('/projects/todos?page=1&rows=20', { signal })
  const rawProjects = payload?.projects
  const groups: Record<string, GuideProjectCard[]> = {}

  if (Array.isArray(rawProjects)) {
    groups['全部'] = rawProjects.map((project, index) => normalizeProject(project, 'todo', index))
  } else if (rawProjects && typeof rawProjects === 'object') {
    Object.entries(rawProjects).forEach(([category, projects]) => {
      groups[category] = projects.map((project, index) => normalizeProject(project, 'todo', index))
    })
  }

  const all = groups['全部'] ?? Object.entries(groups)
    .filter(([category]) => category !== '全部')
    .flatMap(([, projects]) => projects)
  const dedupedAll = Array.from(new Map(all.map((project) => [project.id, project])).values())

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
}

export interface GuideQaStreamResult {
  answer: string
  conversationId: string
  requestId: string
  source: string
}

export interface GuideProjectAnswer {
  stage: string
  stageName: string
  commissionTaskId: string
  answer: string
  references: unknown[]
  suggestions: string[]
  source: string
  conversationId: string
}

interface GuideQaStreamHandlers {
  onText?: (answer: string, chunk: string) => void
  onConversationId?: (conversationId: string) => void
}

interface GuideSsePayload {
  conversation_id?: unknown
  conversationId?: unknown
  request_id?: unknown
  requestId?: unknown
  content?: unknown
  answer?: unknown
  source?: unknown
  message?: unknown
  data?: Record<string, unknown> | null
}

const normalizeSearchResult = (raw: Record<string, unknown>): GuideSearchResult => {
  const rawRoute = raw.route && typeof raw.route === 'object'
    ? raw.route as Record<string, unknown>
    : null
  const rawParams = rawRoute?.params && typeof rawRoute.params === 'object'
    ? rawRoute.params as Record<string, unknown>
    : {}

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
  }
}

export const searchGuide = async (
  query: string,
  conversationId = '',
  signal?: AbortSignal,
) => {
  const payload = await requestGuide<Record<string, unknown>>('/search', {
    method: 'POST',
    body: {
      query,
      user_id: GUIDE_USER_ID,
      request_id: GUIDE_REQUEST_ID,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    },
    signal,
  })

  return normalizeSearchResult(payload ?? {})
}

const extractSseEvents = (buffer: string) => {
  const chunks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const pendingBuffer = chunks.pop() ?? ''

  return {
    events: chunks.map((chunk) => {
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
    }).filter((item) => item.data),
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
    ...keys.flatMap((key) => [payload[key as keyof GuideSsePayload], nested[key]]),
  )
}

export const streamGuideQa = async (
  query: string,
  conversationId = '',
  handlers: GuideQaStreamHandlers = {},
  signal?: AbortSignal,
): Promise<GuideQaStreamResult> => {
  const response = await fetch(`${GUIDE_API_BASE_URL}${GUIDE_API_PREFIX}/qa/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...GUIDE_HEADERS,
    },
    body: JSON.stringify({
      query,
      user_id: GUIDE_USER_ID,
      request_id: GUIDE_REQUEST_ID,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    }),
    signal,
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `智能引导问答请求失败（HTTP ${response.status}）`)
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

  const applyEvent = (event: string, rawData: string) => {
    const payload = parseSsePayload(rawData)
    if (!payload) {
      return
    }

    const nextConversationId = pickSseString(payload, 'conversation_id', 'conversationId')
    if (nextConversationId) {
      latestConversationId = nextConversationId
      handlers.onConversationId?.(nextConversationId)
    }

    if (event === 'error') {
      throw new Error(pickSseString(payload, 'message') || '智能引导问答返回异常')
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
  extractSseEvents(`${buffer}\n\n`).events.forEach(({ event, data }) => applyEvent(event, data))

  if (!answer.trim()) {
    throw new Error('智能引导问答返回内容为空')
  }

  return {
    answer,
    conversationId: latestConversationId,
    requestId,
    source,
  }
}

export const askGuideProject = async (
  context: GuideProjectContext,
  query: string,
  conversationId = '',
  signal?: AbortSignal,
) => {
  const payload = await requestGuide<Record<string, unknown>>('/assistant/project', {
    method: 'POST',
    body: {
      stage: context.stage,
      commission_task_id: context.commissionTaskId,
      project_name: context.projectName,
      query,
      user_id: GUIDE_USER_ID,
      request_id: GUIDE_REQUEST_ID,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    },
    signal,
  })
  const raw = payload ?? {}

  return {
    stage: pickString(raw.stage, context.stage),
    stageName: pickString(raw.stage_name, raw.stageName, context.stageName),
    commissionTaskId: pickString(
      raw.commission_task_id,
      raw.commissionTaskId,
      context.commissionTaskId,
    ),
    answer: pickString(raw.answer),
    references: Array.isArray(raw.references) ? raw.references : [],
    suggestions: pickRecordArray(raw.suggestions),
    source: pickString(raw.source),
    conversationId: pickString(raw.conversation_id, raw.conversationId),
  } satisfies GuideProjectAnswer
}

interface GuideConversationListPayload {
  conversations?: Array<Record<string, unknown>>
}

interface GuideConversationMessagesPayload {
  messages?: Array<Record<string, unknown>>
}

const normalizeConversation = (raw: Record<string, unknown>): GuideConversationSummary => ({
  id: pickString(raw.id),
  conversationType: pickString(raw.conversationType, raw.conversation_type),
  title: pickString(raw.title, '未命名会话'),
  messageCount: pickNumber(raw.messageCount, raw.message_count) ?? 0,
  lastMessagePreview: pickString(raw.lastMessagePreview, raw.last_message_preview),
  lastMessageAt: pickString(raw.lastMessageAt, raw.last_message_at),
  createdAt: pickString(raw.createdAt, raw.created_at),
  updatedAt: pickString(raw.updatedAt, raw.updated_at),
  commissionTaskId: pickString(raw.commissionTaskId, raw.commission_task_id),
  taskType: pickNumber(raw.taskType, raw.task_type),
  stage: pickString(raw.stage),
})

const normalizeConversationMessage = (raw: Record<string, unknown>): GuideConversationMessage => ({
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
  return (payload?.conversations ?? []).map(normalizeConversation).filter((item) => item.id)
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
