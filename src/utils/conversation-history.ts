// 本地历史对话存储工具，集中管理 localStorage 读写和历史摘要。
import type { ConversationHistory, DemoMessage } from '@/types/avatar-types'

const CONVERSATION_HISTORY_STORAGE_KEY = 'digital-human:conversation-history'
const MAX_CONVERSATION_HISTORY_COUNT = 30
const DEFAULT_CONVERSATION_TITLE = '新对话'
const MAX_CONVERSATION_TITLE_LENGTH = 24

// 判断当前运行环境是否可以访问浏览器本地存储。
const isBrowserStorageAvailable = () => typeof window !== 'undefined'

// 生成仅用于浏览器本地历史列表的会话 id。
const createHistoryId = () =>
  `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// 存入历史时移除临时生成状态，避免恢复后仍显示生成中。
const normalizeHistoryMessage = (message: DemoMessage): DemoMessage => ({
  ...message,
  pending: false,
  thinkCollapsed: message.thinkCollapsed ?? true,
})

// 规范历史记录结构，兼容旧数据缺字段或消息状态未收口的情况。
const normalizeHistory = (history: ConversationHistory): ConversationHistory => ({
  ...history,
  title: history.title || DEFAULT_CONVERSATION_TITLE,
  messages: history.messages.map(normalizeHistoryMessage),
})

// 合并内存历史和缓存历史，同 id 记录保留更新时间更新的一条。
const mergeConversationHistories = (
  leftHistories: ConversationHistory[],
  rightHistories: ConversationHistory[],
) => {
  const historyMap = new Map<string, ConversationHistory>()

  ;[...leftHistories, ...rightHistories].forEach((history) => {
    const normalizedHistory = normalizeHistory(history)
    const existingHistory = historyMap.get(normalizedHistory.id)

    if (
      !existingHistory ||
      normalizedHistory.updatedAt >= existingHistory.updatedAt
    ) {
      historyMap.set(normalizedHistory.id, normalizedHistory)
    }
  })

  return [...historyMap.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_CONVERSATION_HISTORY_COUNT)
}

// 解析 localStorage 中的历史列表，异常或非法数据直接回退为空列表。
const parseStoredHistories = (value: string | null): ConversationHistory[] => {
  if (!value) {
    return []
  }

  try {
    const parsedValue = JSON.parse(value)

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .filter((item): item is ConversationHistory => {
        const candidate = item as Partial<ConversationHistory>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.title === 'string' &&
          Array.isArray(candidate.messages) &&
          typeof candidate.createdAt === 'number' &&
          typeof candidate.updatedAt === 'number'
        )
      })
      .map(normalizeHistory)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_CONVERSATION_HISTORY_COUNT)
  } catch {
    return []
  }
}

// 从 localStorage 读取全部历史对话，按更新时间倒序返回。
export const loadConversationHistories = () => {
  if (!isBrowserStorageAvailable()) {
    return []
  }

  return parseStoredHistories(
    window.localStorage.getItem(CONVERSATION_HISTORY_STORAGE_KEY),
  )
}

// 将历史对话写入 localStorage，并统一排序和数量上限；写入失败时返回 false。
export const saveConversationHistories = (histories: ConversationHistory[]) => {
  if (!isBrowserStorageAvailable()) {
    return false
  }

  const nextHistories = histories
    .map(normalizeHistory)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_CONVERSATION_HISTORY_COUNT)

  try {
    window.localStorage.setItem(
      CONVERSATION_HISTORY_STORAGE_KEY,
      JSON.stringify(nextHistories),
    )
    return true
  } catch {
    return false
  }
}

// 根据首条用户消息生成历史标题，避免列表里出现大段正文。
export const buildConversationTitle = (messages: DemoMessage[]) => {
  const firstQuestion =
    messages.find((message) => message.role === 'user' && message.content.trim())
      ?.content ?? ''
  const normalizedTitle = firstQuestion.replace(/\s+/g, ' ').trim()

  if (!normalizedTitle) {
    return DEFAULT_CONVERSATION_TITLE
  }

  return normalizedTitle.length > MAX_CONVERSATION_TITLE_LENGTH
    ? `${normalizedTitle.slice(0, MAX_CONVERSATION_TITLE_LENGTH)}...`
    : normalizedTitle
}

// 新增或更新当前历史对话，写入前读取最新缓存，避免旧内存列表覆盖已有历史。
// 只有命中已有历史时才复用 historyId；未命中时生成新 id，避免新会话覆盖旧缓存。
export const upsertConversationHistory = (
  histories: ConversationHistory[],
  options: {
    historyId?: string
    difyConversationId?: string
    messages: DemoMessage[]
  },
) => {
  const now = Date.now()
  const latestHistories = mergeConversationHistories(
    loadConversationHistories(),
    histories,
  )
  const historyMessages = options.messages.map(normalizeHistoryMessage)
  const existingHistory = options.historyId
    ? latestHistories.find((history) => history.id === options.historyId)
    : null
  const nextHistory: ConversationHistory = {
    id: existingHistory?.id ?? createHistoryId(),
    difyConversationId:
      options.difyConversationId || existingHistory?.difyConversationId,
    title: buildConversationTitle(historyMessages),
    messages: historyMessages,
    createdAt: existingHistory?.createdAt ?? now,
    updatedAt: now,
  }
  const nextHistories = [
    nextHistory,
    ...latestHistories.filter((history) => history.id !== nextHistory.id),
  ]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_CONVERSATION_HISTORY_COUNT)

  const didSave = saveConversationHistories(nextHistories)

  return {
    history: nextHistory,
    histories: nextHistories,
    didSave,
  }
}

// 删除指定历史对话，并把最新列表同步回 localStorage。
export const deleteConversationHistoryById = (
  histories: ConversationHistory[],
  historyId: string,
) => {
  const nextHistories = mergeConversationHistories(
    loadConversationHistories(),
    histories,
  ).filter((history) => history.id !== historyId)
  const didSave = saveConversationHistories(nextHistories)

  if (!didSave) {
    return histories
  }

  return nextHistories
}
