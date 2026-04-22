# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导说明。

## 常用命令
- **安装依赖**：`pnpm install`（项目使用 pnpm，可见 `pnpm-lock.yaml` 文件）
- **启动开发服务器**：`pnpm dev`
- **构建生产版本**：`pnpm build`
- **预览生产构建**：`pnpm preview`
*（注：目前的 `package.json` scripts 中没有明确配置代码格式化 (Linting) 和测试 (Testing) 命令。）*

## 架构与目录结构
这是一个基于 Vite 的 Vue 3 + TypeScript 项目，当前只保留“视频数字人”这一条实现路线。

- **`src/components/digital-human/`**：数字人助手的核心逻辑和 UI 组件。
  - **`DigitalHumanAssistant.vue`**：当前页面的主入口，负责视频舞台、聊天记录、建议问题和输入区交互。
  - **`VideoDigitalHumanStage.vue`**：视频数字人舞台，负责不同状态视频切换和语音播放收尾。
  - **`demo-config.ts`**：包含模拟回复文本、建议问答和回复时序配置。
  - **`useDigitalHumanDemo.ts`**：主要的 Composable，负责 thinking / speaking / idle 状态切换、打字机动画、ASR/TTS 联动。
  - **`useSpeechRecognition.ts`**：WebSocket ASR 封装。
  - **`useSpeechSynthesis.ts`**：TTS 请求与音频 URL 处理封装。
  - **`runtime-config.ts`**：统一读取 `.env.developement` 中的 ASR、TTS、视频素材和时序参数。
- **环境配置**：运行参数通过 `.env.developement` / `env.developement.example` 管理，使用 `VITE_*` 变量为 ASR、TTS、视频素材和回复时序提供配置入口。
- **静态资源/视频**：项目依赖 `public/videos/` 下的状态视频素材来呈现数字人待命、聆听、思考和回答状态。
