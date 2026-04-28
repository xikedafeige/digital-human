// 数字人消息内容工具，负责 think 分离、Markdown 渲染和纯文本提取。
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const THINK_OPEN_TAG = '<think>'
const THINK_CLOSE_TAG = '</think>'

export interface ParsedReplyContent {
  rawText: string
  bodyMarkdown: string
  thinkMarkdown: string
  speechText: string
  hasThinkBlock: boolean
  thinkCompleted: boolean
}

// 统一换行符，避免 SSE 分片中不同平台换行影响解析。
const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, '\n')

// 清理 Markdown 首尾空白，保留正文内部格式。
const normalizeMarkdown = (value: string) => normalizeLineEndings(value).trim()

// 识别流式文本末尾可能尚未完整到达的 think 标签片段。
const getTrailingPartialTagLength = (text: string, candidates: string[]) => {
  let matchedLength = 0

  candidates.forEach((candidate) => {
    const maxLength = Math.min(candidate.length - 1, text.length)

    for (let length = maxLength; length > 0; length -= 1) {
      if (text.endsWith(candidate.slice(0, length))) {
        matchedLength = Math.max(matchedLength, length)
        return
      }
    }
  })

  return matchedLength
}

// 删除末尾未完整到达的标签片段，避免 UI 暂时显示半截标签。
const stripTrailingPartialTag = (text: string, candidates: string[]) => {
  const partialLength = getTrailingPartialTagLength(text, candidates)

  if (!partialLength) {
    return text
  }

  return text.slice(0, text.length - partialLength)
}

// 将 Dify 原始回复拆成思考区、正文区和可播报纯文本。
export const parseReplyContent = (rawText: string): ParsedReplyContent => {
  const normalizedRawText = normalizeLineEndings(rawText)
  const bodyParts: string[] = []
  const thinkParts: string[] = []

  let cursor = 0
  let insideThink = false
  let hasThinkBlock = false

  while (cursor < normalizedRawText.length) {
    if (insideThink) {
      if (normalizedRawText.startsWith(THINK_CLOSE_TAG, cursor)) {
        hasThinkBlock = true
        cursor += THINK_CLOSE_TAG.length
        insideThink = false
        continue
      }

      const closeIndex = normalizedRawText.indexOf(THINK_CLOSE_TAG, cursor)
      if (closeIndex === -1) {
        thinkParts.push(
          stripTrailingPartialTag(
            normalizedRawText.slice(cursor),
            [THINK_CLOSE_TAG],
          ),
        )
        break
      }

      thinkParts.push(normalizedRawText.slice(cursor, closeIndex))
      cursor = closeIndex + THINK_CLOSE_TAG.length
      insideThink = false
      continue
    }

    if (normalizedRawText.startsWith(THINK_OPEN_TAG, cursor)) {
      hasThinkBlock = true
      cursor += THINK_OPEN_TAG.length
      insideThink = true
      continue
    }

    if (normalizedRawText.startsWith(THINK_CLOSE_TAG, cursor)) {
      hasThinkBlock = true
      cursor += THINK_CLOSE_TAG.length
      continue
    }

    const openIndex = normalizedRawText.indexOf(THINK_OPEN_TAG, cursor)
    const closeIndex = normalizedRawText.indexOf(THINK_CLOSE_TAG, cursor)
    const nextTagIndex =
      openIndex === -1
        ? closeIndex
        : closeIndex === -1
          ? openIndex
          : Math.min(openIndex, closeIndex)

    if (nextTagIndex === -1) {
      bodyParts.push(
        stripTrailingPartialTag(
          normalizedRawText.slice(cursor),
          [THINK_OPEN_TAG, THINK_CLOSE_TAG],
        ),
      )
      break
    }

    bodyParts.push(normalizedRawText.slice(cursor, nextTagIndex))
    cursor = nextTagIndex
  }

  const bodyMarkdown = normalizeMarkdown(bodyParts.join(''))
  const thinkMarkdown = normalizeMarkdown(thinkParts.join(''))

  return {
    rawText: normalizedRawText,
    bodyMarkdown,
    thinkMarkdown,
    speechText: markdownToPlainText(bodyMarkdown),
    hasThinkBlock,
    thinkCompleted: hasThinkBlock && !insideThink,
  }
}

// 将 Markdown 渲染为经过净化的 HTML，供消息气泡安全展示。
export const renderMarkdownToHtml = (markdown: string) => {
  const normalizedMarkdown = normalizeMarkdown(markdown)
  if (!normalizedMarkdown) {
    return ''
  }

  const unsafeHtml = marked.parse(normalizedMarkdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string

  return DOMPurify.sanitize(unsafeHtml)
}

// 将 Markdown 转成纯文本，供 TTS 和状态摘要使用。
export const markdownToPlainText = (markdown: string) => {
  const safeHtml = renderMarkdownToHtml(markdown)
  if (!safeHtml) {
    return ''
  }

  if (typeof document === 'undefined') {
    return safeHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  }

  const container = document.createElement('div')
  container.innerHTML = safeHtml

  return (container.innerText || container.textContent || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
