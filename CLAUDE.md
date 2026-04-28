# CLAUDE.md

本文档用于指导 Claude Code 或其他代码助手在本仓库中安全、高效地协作。内容以当前项目真实结构为准。

## 项目概览

`digital-human` 是一个基于 Vite、Vue 3、TypeScript 的数字人助手项目。当前应用聚焦在一个独立的数字人交互面板，包含：

- 视频数字人舞台，支持 `idle`、`listening`、`thinking`、`speaking` 四种状态。
- 文本输入和语音输入。
- Dify 问答接入，支持流式响应解析。
- ASR 语音识别，通过 WebSocket 发送麦克风 PCM 音频。
- TTS 语音合成，通过 HTTP 接口生成音频。
- TTS 分段预合成队列和串行播放队列。
- 语音驱动文本展示、播报进度和消息渲染。

当前项目采用 `src/` 根级分层结构，不再使用 `features/digital-human` 或 `components/digital-human` 子目录。

## 常用命令

项目使用 `pnpm`，仓库内有 `pnpm-lock.yaml`。

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
npx vue-tsc --noEmit
```

命令说明：

- `pnpm dev`：以 `developement` mode 启动 Vite，本地端口为 `5186`。
- `pnpm build`：先执行 `vue-tsc -b`，再执行 `vite build --mode developement`。
- `pnpm preview`：预览生产构建结果。
- `npx vue-tsc --noEmit`：快速做类型检查，适合普通代码改动后执行。
- 当前 `package.json` 没有配置 lint 或单元测试脚本。

注意：项目脚本里的 mode 名称当前拼写为 `developement`。不要单独改成 `development`，除非同步调整脚本、环境文件和部署约定。

## 当前目录结构

```text
src/
  index.ts
  App.vue
  main.ts
  style.css
  vite-env.d.ts
  components/
    DigitalHumanAssistant.vue
    VideoDigitalHumanStage.vue
  hooks/
    useDigitalHumanDemo.ts
    useDifyChat.ts
    useSpeechRecognition.ts
    useSpeechSynthesis.ts
  config/
    demo-config.ts
    runtime-config.ts
    video-avatar-config.ts
  types/
    avatar-types.ts
  utils/
    message-content.ts
```

目录职责：

- `src/index.ts`：数字人模块公开入口，页面层从这里导入稳定能力。
- `src/components/`：只放 Vue 单文件组件。
- `src/hooks/`：放组合式逻辑、服务调用和主流程编排。
- `src/config/`：放运行配置、演示配置、视频资源映射和状态文案。
- `src/types/`：放跨模块共享类型。
- `src/utils/`：放纯工具方法，例如 Markdown 渲染和 `<think>` 解析。
- `src/style.css`：全局页面样式。

路径别名：

- `@` 指向 `src`。
- Vite 别名配置在 `vite.config.ts`。
- TypeScript 路径配置在 `tsconfig.json`。
- 跨目录 import 优先使用 `@/`，例如 `@/config/runtime-config`。
- 同目录文件之间可以继续使用相对路径，例如 hooks 内部引用 `./useDifyChat`。

## 公开入口

页面层推荐这样导入：

```ts
import { DigitalHumanAssistant } from '@/index'
```

`src/index.ts` 只应暴露稳定的页面级能力：

- `DigitalHumanAssistant`
- 核心共享类型，例如 `AvatarState`、`DemoMessage`、`SpeechSynthesisResult`

除非明确有外部消费需求，不要把内部 hooks 从 `src/index.ts` 暴露出去。

## 核心文件说明

### `src/components/DigitalHumanAssistant.vue`

数字人主面板组件，负责 UI 组合：

- 顶部身份区和操作按钮。
- 面板展开/收起状态。
- 视频舞台布局。
- 聊天消息列表。
- Markdown 消息渲染。
- 思考过程展开/折叠。
- 语音进度展示。
- 快捷建议。
- 输入框、helper 提示和录音/发送/停止/中断按钮。

维护规则：

- 样式保持 `<style scoped lang="less">`。
- 不要把 Dify、ASR、TTS 或队列编排逻辑放进组件。
- 输入区 helper 和右下角按钮布局比较敏感，修改时必须检查遮挡、跳动和对齐。
- 不要新增多个条件渲染 helper 行，避免输入区高度抖动。
- 按钮模式、helper 文案、顶部状态提示优先使用 computed。

### `src/components/VideoDigitalHumanStage.vue`

视频舞台和语音播放组件，负责：

- 四种数字人状态视频。
- 视频就绪状态管理。
- 状态视频切换。
- TTS 音频播放。
- 缺少音频 URL 时使用浏览器 `speechSynthesis` 兜底。
- 向父层回传 `speech-progress` 和 `speech-complete`。

维护规则：

- 只处理视频和播放，不调用 Dify、ASR、TTS 服务。
- 保持一次只播放一个 `SpeechSynthesisResult`。
- 播放队列由父层 hook 管理。

### `src/hooks/useDigitalHumanDemo.ts`

数字人主流程 hook，负责整体编排：

- 面板状态。
- 输入框文本和 helper 提示。
- 用户消息和数字人消息。
- Dify 流式问答。
- `<think>` 内容处理。
- TTS 分段。
- TTS 预合成队列。
- 播放队列。
- ASR 开始、停止和取消。
- 中断、关闭、新建对话的清理。

关键行为：

- Dify 文本可以快速流式接收，但可见正文需要和语音播放节奏协同。
- 首段语音更短，用于降低首次等待。
- 后续语音分段目标约 100 个有效字符，并优先在句末标点附近切分。
- TTS 请求串行执行，但可以和当前音频播放并行。
- 音频播放严格串行。
- 异步回调必须校验当前 flow，避免旧请求污染新会话。
- 中断、新建对话、关闭面板必须清理 Dify、TTS、ASR、定时器和播放状态。

修改时必须保持：

- 旧异步回调不能更新新会话。
- `<think>` 内容不能进入 TTS。
- Dify、TTS 队列、播放队列未完成前，不要把按钮提前恢复为空闲。
- 语音 blob URL 要及时释放。
- 中断后不能留下永久 pending 的消息。

### `src/hooks/useDifyChat.ts`

Dify 问答封装，负责：

- 发起 Dify chat 请求。
- 解析流式 SSE。
- 兼容 blocking JSON 响应。
- 提取 conversation id、task id、message id。
- 请求停止 Dify task。
- 将流式文本交给 `parseReplyContent` 解析。

维护规则：

- Dify 返回结构可能有多种字段形态，不要轻易简化成只读单一字段。
- 保留最终结果日志和错误日志，有助于排障。
- 不要恢复大量逐 chunk 调试日志，除非用户明确要求。

### `src/hooks/useSpeechRecognition.ts`

ASR 语音识别封装，负责：

- 麦克风采集。
- Float32 音频转换为 16-bit PCM。
- ASR WebSocket 生命周期。
- partial 和 final 识别文本。
- 停止录音后的兜底超时。

浏览器约束：

- 麦克风访问通常要求安全上下文，例如 `https`、`localhost`，或浏览器开发策略放行。
- 如果在线 WebSocket 测试工具可连通，但项目内不可用，应先检查页面安全上下文和麦克风权限，再判断 ASR 服务是否异常。

### `src/hooks/useSpeechSynthesis.ts`

TTS 语音合成封装，负责：

- 发起 TTS HTTP 请求。
- 组装 FormData 请求参数。
- 将返回 blob 转成 object URL。
- 探测音频真实时长。
- 释放 object URL。

维护规则：

- TTS 地址拼接放在 `runtime-config.ts`。
- 替换、清空或中断语音时要释放 blob URL。
- 必须尊重 abort signal，保证中断和新建对话能取消正在进行的 TTS。

### `src/utils/message-content.ts`

消息内容工具，负责：

- `<think>` 块解析。
- Markdown 规范化。
- Markdown 渲染为安全 HTML。
- Markdown 转纯文本，供 TTS 和状态摘要使用。

维护规则：

- Markdown 解析使用 `marked`。
- 注入 HTML 前必须经过 `DOMPurify`。
- 不要直接按 HTML 字符串下标切割标签。
- `<think>` 流式解析要兼容半截标签，避免 UI 显示原始标签碎片。

### `src/config/runtime-config.ts`

运行时配置，负责读取 Vite 环境变量并提供默认值。

当前重要默认值：

- ASR WebSocket：`ws://1.92.158.195:8001/ws/recognize`
- TTS base URL：`https://copilot.sino-bridge.com`
- TTS endpoint：`/xiren-api/v1/audio/speech`
- Dify chat URL：`https://copilot.sino-bridge.com:90/v1/chat-messages`
- Dify stop URL template：`https://copilot.sino-bridge.com:90/v1/chat-messages/{task_id}/stop`

维护规则：

- 继续保留 `ttsBaseUrl + ttsEndpoint` 的配置模型，除非用户明确要求改成完整 URL 字段。
- `VITE_*` 环境变量名不要随意修改。
- 不要把真实密钥写进源码。
- 本地真实配置使用 `.env.developement`。
- `env.developement.example` 已删除，项目运行不依赖它；环境变量字段以 `runtime-config.ts` 和 `vite-env.d.ts` 为准。

## 静态资源

静态资源位于 `public/`。

重要目录：

- `public/videos/`：数字人状态视频。
- `public/design/`：数字人视觉素材。

默认视频路径在 `runtime-config.ts` 中配置，例如：

- `/videos/idle.mp4`
- `/videos/listening.mp4`
- `/videos/thinking.mp4`
- `/videos/speaking.mp4`

仓库中也存在中文命名视频文件。Windows 终端可能出现中文文件名显示乱码，除非任务明确要求，不要重命名这些资源。

## 样式规范

- Vue 组件样式使用 Less：`<style scoped lang="less">`。
- `less` 已在 `devDependencies` 中声明。
- 全局样式放在 `src/style.css`。
- 组件私有样式放在组件 SFC 中。
- 不要从组件文件引入不必要的全局选择器。
- 输入区是重点稳定区域：
  - helper 提示出现、消失、切换时不能导致整体跳动。
  - helper 提示不能被右侧按钮遮挡。
  - 长 helper 文案应单行省略，不能撑宽面板。
  - suggestions 必须在输入区内部，不能与视频舞台重叠。

## 交互流程

文本问答流程：

1. 用户提交文本。
2. `useDigitalHumanDemo` 创建用户消息和数字人消息。
3. `useDifyChat` 流式接收 Dify 回复。
4. `message-content.ts` 拆分 think、body、speech text。
5. speech text 被分段。
6. 分段进入 TTS 队列。
7. TTS 结果进入播放队列。
8. `VideoDigitalHumanStage` 播放单段语音并回传进度。
9. hook 根据进度更新可见文本和进度条。
10. 所有队列完成后，消息收口，按钮恢复空闲。

语音问答流程：

1. 用户点击录音。
2. `useSpeechRecognition` 通过 WebSocket 发送 PCM 音频。
3. 用户停止录音。
4. ASR 最终文本或 partial 文本成为问题。
5. 后续复用文本问答流程。

中断行为：

- 中断必须取消 Dify、TTS、ASR、定时器和播放。
- 旧异步回调必须通过 flow id 被忽略。
- UI 必须回到稳定空闲态。

## Dify 流式说明

Dify 响应可能包含：

- SSE 流式 chunk。
- blocking JSON。
- `message_replace` 事件。
- `message_end` 事件。
- 嵌套字段，例如 `data.answer`、`data.text`、`data.delta`。

当前解析逻辑是为了兼容多种返回形态。除非后端协议已确认稳定，不要收窄成单一字段。

`<think>` 处理规则：

- think 内容渲染在独立折叠区域。
- think 内容不能进入 TTS。
- 流式过程中可能出现半截 `<think>` 或 `</think>`，不能让原始标签碎片显示到 UI。

## TTS 队列说明

当前策略：

- Dify 文本继续后台流式接收。
- speech text 分段。
- TTS 合成队列串行执行。
- 播放队列串行执行。
- TTS 合成可以和上一段音频播放并行。

分段默认值：

- 首段目标：40 个有效字符。
- 首段最大向后寻找：20 个有效字符。
- 后续段目标：100 个有效字符。
- 后续段最大向后寻找：40 个有效字符。
- 空白字符不计入有效字符。
- 优先用句末标点作为分段边界。

修改分段逻辑时：

- 保持 sequence 顺序。
- 保持 stale flow 校验。
- Dify 完成时必须补齐尾段。
- 短回复也必须能正常播报。

## ASR 说明

ASR 默认地址：

```text
ws://1.92.158.195:8001/ws/recognize
```

常见失败原因：

- 页面不是安全上下文，浏览器拒绝麦克风。
- 用户拒绝麦克风权限。
- WebSocket 被网络或浏览器策略拦截。
- ASR 服务期望的消息协议和当前实现不完全一致。

排查顺序：

1. 先检查麦克风权限和安全上下文。
2. 再检查 WebSocket 是否连接成功。
3. 最后检查 ASR 消息格式。
4. 不要把所有启动失败都归因于 WebSocket 不通。

## 环境变量

环境变量由 `.env.developement` 提供，本地真实值不要提交。

字段类型在 `src/vite-env.d.ts` 中声明，运行默认值在 `src/config/runtime-config.ts` 中维护。

重要变量：

```text
VITE_ASR_WS_URL
VITE_TTS_BASE_URL
VITE_TTS_ENDPOINT
VITE_TTS_MODEL
VITE_TTS_VOICE
VITE_TTS_RESPONSE_FORMAT
VITE_TTS_SPEED
VITE_DIFY_CHAT_MESSAGES_URL
VITE_DIFY_STOP_MESSAGE_URL_TEMPLATE
VITE_DIFY_API_KEY
VITE_DIFY_USER_PREFIX
VITE_DIFY_TIMEOUT_MS
VITE_VIDEO_IDLE_SRC
VITE_VIDEO_LISTENING_SRC
VITE_VIDEO_THINKING_SRC
VITE_VIDEO_SPEAKING_SRC
VITE_RESPONSE_THINKING_MS
VITE_RESPONSE_TYPING_INTERVAL_MS
VITE_RESPONSE_SPEAKING_TAIL_MS
VITE_RESPONSE_MIN_SPEAKING_MS
VITE_RESPONSE_MS_PER_CHARACTER
```

安全规则：

- 不要提交真实 Dify API Key。
- 本地真实密钥只放 `.env.developement`。
- 若需要恢复环境变量示例文件，必须确保示例值不包含真实密钥。

## 代码维护规则

- 工作区可能有未提交改动，不要回退用户未要求回退的文件。
- 修改尽量小而聚焦。
- 跨目录源码 import 使用 `@/`。
- hooks 不写 DOM 布局细节。
- components 不写服务编排逻辑。
- config 不写 UI 渲染逻辑。
- utils 尽量保持纯函数。
- 共享类型从 `src/types/avatar-types.ts` 引用，不要重复定义状态和消息结构。
- 除非任务明确要求，不要改变 Dify、ASR、TTS 协议和运行配置结构。

## 注释规范

数字人相关文件使用中文注释。

规范：

- 文件顶部注释说明文件职责。
- 方法说明使用单行 `// ...`。
- 普通方法说明不使用大块注释。
- 异步清理、队列、浏览器限制、服务协议相关逻辑需要保留注释。
- 不写只复述语法的低价值注释。

## 验证清单

普通代码改动后：

```bash
npx vue-tsc --noEmit
```

结构、构建、依赖、路径别名、Less 样式相关改动后：

```bash
pnpm build
```

文件移动后检查旧路径残留：

```bash
rg "features/digital-human|components/digital-human|composables" src vite.config.ts tsconfig.json
```

期望结果：无输出。

涉及 UI 或流程时手动检查：

- 页面能正常打开数字人面板。
- 展开/收起面板正常。
- 新建对话正常。
- 文本提问正常。
- Dify 流式或 fallback 回复正常。
- TTS 请求和播放状态正常。
- 进度显示不会按单段错误重置。
- 中断能停止当前流程。
- 语音输入只在允许麦克风的浏览器上下文中验证。

## 已知约束

- 当前没有路由。
- 当前没有测试框架。
- 当前没有 lint 脚本。
- 当前没有状态管理库。
- 数字人是当前主应用 UI，还不是独立 npm 包。
- 浏览器麦克风能力依赖安全上下文和权限。
- TTS 当前不提供词级时间戳，跟读/高亮只能根据播放进度估算。

## 推荐改动流程

小 UI 改动：

1. 只改相关 SFC。
2. 执行 `npx vue-tsc --noEmit`。
3. 如果改了 Less、模板结构或 import，再执行 `pnpm build`。

服务逻辑改动：

1. 先定位对应 hook。
2. 配置仍放在 `runtime-config.ts`。
3. UI 提示放在 `DigitalHumanAssistant.vue` 或 `useDigitalHumanDemo.ts`。
4. 检查 abort 和 stale flow 处理。

结构调整：

1. 先移动文件。
2. 再更新 import。
3. 如公开入口变化，更新 `src/index.ts`。
4. 搜索旧路径残留。
5. 执行 `npx vue-tsc --noEmit`。
6. 执行 `pnpm build`。
