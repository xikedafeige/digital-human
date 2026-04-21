# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导说明。

## 常用命令
- **安装依赖**：`pnpm install`（项目使用 pnpm，可见 `pnpm-lock.yaml` 文件）
- **启动开发服务器**：`pnpm dev`
- **构建生产版本**：`pnpm build`
- **预览生产构建**：`pnpm preview`
*（注：目前的 `package.json` scripts 中没有明确配置代码格式化 (Linting) 和测试 (Testing) 命令。）*

## 架构与目录结构
这是一个基于 Vite 和 Pinia 构建的 Vue 3 + TypeScript 项目。它主要作为“数字人”助手的演示（Demo）或前端交互界面。

- **`src/components/DigitalHuman/` 和 `src/components/digital-human/`**：数字人助手的核心逻辑和 UI 组件。
  - **`DigitalHuman.vue`**：助手 UI 的主入口组件。它处理展开/折叠状态，为不同的虚拟形象状态（待命 idle、聆听 listening、思考 thinking、说话 speaking）渲染视频，以及处理聊天输入界面。
  - **`demo-config.ts`**：包含模拟的大模型（LLM）响应、响应时序和建议问答。用于模拟真实的后端交互。
  - **`useDigitalHumanDemo.ts`**：主要的 Composable（组合式函数），负责管理交互状态，处理打字机动画、模拟语音合成时长，以及在思考、说话、待命等状态间的切换。
  - **`avatar-types.ts`**：核心的 TypeScript 类型定义，包含形象状态（`AvatarState`）、消息结构和 Live2D 相关的配置类型。
- **状态管理**：使用 Pinia（在 `main.ts` 中配置，可能存在于 `src/stores/digitalHuman`）。`DigitalHuman.vue` 组件直接与 Pinia Store 交互来管理其 UI 和对话状态。
- **静态资源/视频**：项目依赖 `.mp4` 视频文件来呈现数字人的不同状态（例如 `idle.mp4`, `speaking.mp4`）。这些文件通常存放在 `public/videos/` 目录下，或者在 `video-avatar-config.ts` 中进行路径映射。
- **Live2D 支持**：代码库中包含了 Live2D 集成的基础框架（引入了 `pixi-live2d-display`、`pixi.js` 依赖，并包含 `Live2DStage.vue` 组件），表明数字人可以在视频驱动和 Live2D 驱动之间进行切换。