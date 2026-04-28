// 数字人 feature 统一出口，页面层通过这里引用稳定的公开能力。
export { default as DigitalHumanAssistant } from './components/DigitalHumanAssistant.vue'
export type {
  AvatarState,
  DemoMessage,
  SpeechSynthesisResult,
} from './types/avatar-types'
