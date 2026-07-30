// 智能引导接口客户端，集中管理联调地址、请求头和响应数据规范化。

const GUIDE_API_BASE_URL = 'http://ffa56a44.natappfree.cc'
const GUIDE_API_PREFIX = '/api/v1/guide'

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
  [key: string]: unknown
}

interface GuideProjectListPayload {
  projects?: GuideProjectPayload[]
  total?: unknown
  page?: unknown
  rows?: unknown
}

export interface GuideProjectCard {
  id: string
  title: string
  projectName: string
  taskType: number | null
  taskTypeName: string
  currentStageName: string
  time: string
  deadline: string
  statusText: string
  actions: string[]
  isUrgent: boolean
  source: 'recent' | 'todo'
  commissionTaskId: string
  raw: GuideProjectPayload
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

const normalizeProject = (
  raw: GuideProjectPayload,
  source: GuideProjectCard['source'],
  index: number,
): GuideProjectCard => {
  const taskType = pickNumber(raw.taskType, raw.task_type)
  const statusText = pickString(raw.statusText, raw.status_text, raw.status, '待处理')
  const rawActions = pickRecordArray(raw.cardActions)
  const actions = rawActions.length
    ? rawActions.map((action) => ACTION_LABELS[action] ?? action).filter(Boolean)
    : DEFAULT_TODO_ACTIONS
  const title = pickString(raw.title, raw.projectName, raw.project_name, `待办项目 ${index + 1}`)
  const commissionTaskId = pickString(raw.commissionTaskId, raw.commission_task_id)
  const id = pickString(
    raw.todoId,
    raw.todo_id,
    raw.bpmTaskId,
    raw.bpm_task_id,
    commissionTaskId,
    `${source}-${index}`,
  )

  return {
    id,
    title,
    projectName: pickString(raw.projectName, raw.project_name, title),
    taskType,
    taskTypeName: pickString(raw.taskTypeName, raw.task_type_name),
    currentStageName: pickString(raw.currentStageName, raw.current_stage_name),
    time: pickString(raw.durationDesc, raw.duration_desc, raw.startDate, raw.start_date, raw.deadline),
    deadline: pickString(raw.deadline),
    statusText,
    actions,
    isUrgent: /紧急|逾期|urgent|overdue/i.test(statusText),
    source,
    commissionTaskId,
    raw,
  }
}

const requestGuide = async <T>(path: string, signal?: AbortSignal): Promise<T | null> => {
  const response = await fetch(`${GUIDE_API_BASE_URL}${GUIDE_API_PREFIX}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...GUIDE_HEADERS,
    },
    signal,
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

export const fetchRecentProjects = async (signal?: AbortSignal) => {
  const payload = await requestGuide<GuideProjectListPayload>('/projects/recent?page=1&rows=6', signal)
  return (payload?.projects ?? []).map((project, index) => normalizeProject(project, 'recent', index))
}

export const fetchTodoProjects = async (signal?: AbortSignal) => {
  const payload = await requestGuide<GuideProjectListPayload>('/projects/todos?page=1&rows=20', signal)
  return (payload?.projects ?? []).map((project, index) => normalizeProject(project, 'todo', index))
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
  const payload = await requestGuide<GuideConversationListPayload>('/assistant/conversations?limit=50', signal)
  return (payload?.conversations ?? []).map(normalizeConversation).filter((item) => item.id)
}

export const fetchGuideConversationMessages = async (
  conversationId: string,
  signal?: AbortSignal,
) => {
  const payload = await requestGuide<GuideConversationMessagesPayload>(
    `/assistant/conversation/${encodeURIComponent(conversationId)}/messages`,
    signal,
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
